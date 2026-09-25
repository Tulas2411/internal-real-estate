import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { admin, type Actor } from "@/lib/policy";
import { audit, changes } from "@/lib/audit";
import { fail } from "@/lib/errors";
import { passwordSchema, userCreate, userUpdate, userReset } from "@/lib/validation";
import { rateLimit } from "@/lib/http";
const userSelect = { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true, version: true, createdAt: true } as const;
export async function listUsers(actor: Actor) {
  admin(actor);
  return db.user.findMany({ select: userSelect, orderBy: { name: "asc" }, take: 200 });
}
export async function createUser(actor: Actor, raw: unknown) {
  admin(actor);
  await rateLimit(`account:${actor.id}`, 10);
  const { temporaryPassword, ...data } = userCreate.parse(raw);
  const password = await hashPassword(temporaryPassword);
  return db.$transaction(async tx => {
    const user = await tx.user.create({ data: { ...data, accounts: { create: { id: randomUUID(), accountId: data.email, providerId: "credential", password } } }, select: userSelect });
    // Better Auth credentials use the user id as accountId.
    await tx.account.updateMany({ where: { userId: user.id }, data: { accountId: user.id } });
    await audit(tx, actor, "USER_CREATE", "User", user.id, null, data);
    return user;
  });
}
export async function updateUser(actor: Actor, id: string, raw: unknown) {
  admin(actor);
  const { expectedVersion, ...data } = userUpdate.parse(raw);
  return db.$transaction(async tx => {
    // Single transaction-scoped lock protects the last active admin across concurrent requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(821731)`;
    const old = await tx.user.findUnique({ where: { id } });
    if (!old) fail(404, "NOT_FOUND", "Không tìm thấy tài khoản.");
    if (old.role === "ADMIN" && old.status === "ACTIVE" && (data.role !== "ADMIN" || data.status !== "ACTIVE")) {
      if (await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }) <= 1) fail(409, "LAST_ADMIN", "Không thể khóa hoặc hạ quyền quản trị viên hoạt động cuối cùng.");
    }
    const result = await tx.user.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (!result.count) fail(409, "CONFLICT", "Tài khoản đã thay đổi. Vui lòng tải lại.");
    if (old.role !== data.role || old.status !== data.status) await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, actor, "USER_UPDATE", "User", id, null, changes(old, data));
    return { ok: true };
  });
}
export async function resetUserPassword(actor: Actor, id: string, raw: unknown) {
  admin(actor);
  await rateLimit(`reset:${actor.id}`, 10);
  const { expectedVersion, temporaryPassword } = userReset.parse(raw);
  const password = await hashPassword(temporaryPassword);
  return db.$transaction(async tx => {
    const result = await tx.user.updateMany({ where: { id, version: expectedVersion }, data: { mustChangePassword: true, tempPasswordUsedAt: null, version: { increment: 1 } } });
    if (!result.count) fail(409, "CONFLICT", "Tài khoản đã thay đổi. Vui lòng tải lại.");
    await tx.account.updateMany({ where: { userId: id, providerId: "credential" }, data: { password } });
    await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, actor, "PASSWORD_RESET", "User", id, null, { sessionsRevoked: true, mustChangePassword: true });
    return { ok: true };
  });
}
export async function changePassword(actor: Actor, raw: unknown) {
  await rateLimit(`password:${actor.id}`, 5);
  const input = passwordSchema.parse(raw);
  const account = await db.account.findFirst({ where: { userId: actor.id, providerId: "credential" } });
  if (!account?.password || !await verifyPassword({ hash: account.password, password: input.currentPassword })) fail(400, "PASSWORD", "Mật khẩu hiện tại không đúng.");
  const password = await hashPassword(input.newPassword);
  return db.$transaction(async tx => {
    const updated = await tx.account.updateMany({ where: { id: account.id, password: account.password }, data: { password } });
    if (!updated.count) fail(409, "CONFLICT", "Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.");
    await tx.user.update({ where: { id: actor.id }, data: { mustChangePassword: false, tempPasswordUsedAt: null, version: { increment: 1 } } });
    await tx.session.deleteMany({ where: { userId: actor.id } });
    await audit(tx, actor, "PASSWORD_CHANGE", "User", actor.id, null, { sessionsRevoked: true });
    return { ok: true };
  });
}
