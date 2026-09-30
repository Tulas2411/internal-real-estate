import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createUser, updateUser, listUsers, changePassword } from "../../src/services/users";
import { requireUser, type Actor } from "../../src/lib/policy";
import { POST as authPost } from "../../src/app/api/auth/[...all]/route";
import { internalAuthEmail } from "../../src/lib/phone";
import { hashPassword } from "better-auth/crypto";

const origin = "http://localhost:3100";
const tempPassword = "Phone-test-temporary-9248";
let admin: Actor;
const newPhone = () => `+1${BigInt("0x" + randomUUID().replaceAll("-", "").slice(0, 10)).toString().padStart(13, "0")}`;
async function signIn(phoneNumber: string, password: string) {
  return authPost(new Request(`${origin}/api/auth/sign-in/phone-number`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ phoneNumber, password }) }));
}
const cookieHeaders = (response: Response) => new Headers({ cookie: response.headers.getSetCookie().map(v => v.split(";")[0]).join("; ") });
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("Unsafe test database");
  const id = randomUUID();
  admin = await db.user.create({ data: { id, name: "Phone auth test admin", email: internalAuthEmail(id), phoneNumber: newPhone(), role: "ADMIN", mustChangePassword: false } });
});
afterAll(() => db.$disconnect());
beforeEach(async () => {
  // Independent scenarios share localhost. Isolate the IP rate-limit fixture,
  // while keeping real rate limiting enabled and explicitly tested below.
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("Unsafe test database");
  await db.rateLimit.deleteMany();
});

describe("Phone/password authentication against real DB", () => {
  it("admin tạo user không có email, đăng nhập bằng số và đổi mật khẩu tạm", async () => {
    const phoneNumber = newPhone();
    const user = await createUser(admin, { name: "Thành viên mới", phoneNumber, role: "MEMBER", temporaryPassword: tempPassword });
    expect(user).not.toHaveProperty("email"); expect(user.phoneNumber).toBe(phoneNumber);
    const login = await signIn(phoneNumber, tempPassword); expect(login.status).toBe(200);
    const headers = cookieHeaders(login);
    await expect(requireUser(headers)).rejects.toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    const actor = await requireUser(headers, true);
    expect((await signIn(phoneNumber, tempPassword)).status).toBe(401);
    const password = "Phone-test-permanent-7890";
    await changePassword(actor, { currentPassword: tempPassword, newPassword: password });
    await expect(requireUser(headers)).rejects.toMatchObject({ status: 401 });
    const again = await signIn(phoneNumber, password); expect(again.status).toBe(200);
    expect((await requireUser(cookieHeaders(again))).id).toBe(user.id);
  });
  it("chuẩn hóa local/+84 cùng tài khoản, chặn số trùng kể cả hai create đồng thời", async () => {
    const local = `09${String(parseInt(randomUUID().replaceAll("-", "").slice(0, 7), 16) % 100000000).padStart(8, "0")}`;
    const canonical = `+84${local.slice(1)}`;
    const input = { name: "Chuẩn hóa", role: "MEMBER", temporaryPassword: tempPassword };
    const results = await Promise.allSettled([createUser(admin, { ...input, phoneNumber: local }), createUser(admin, { ...input, phoneNumber: canonical })]);
    expect(results.filter(v => v.status === "fulfilled")).toHaveLength(1);
    expect(results.find(v => v.status === "rejected")).toMatchObject({ reason: { code: "P2002" } });
    const response = await signIn(`${local.slice(0, 3)} ${local.slice(3)}`, tempPassword);
    expect(response.status).toBe(200);
    expect((await requireUser(cookieHeaders(response), true)).phoneNumber).toBe(canonical);
  });
  it("đổi số thu hồi phiên, số cũ không đăng nhập được; user thường không được tạo tài khoản", async () => {
    const phoneNumber = newPhone(); const replacement = newPhone();
    const user = await createUser(admin, { name: "Đổi số", phoneNumber, role: "MEMBER", temporaryPassword: tempPassword });
    await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    const response = await signIn(phoneNumber, tempPassword); expect(response.status).toBe(200);
    const headers = cookieHeaders(response); const actor = await requireUser(headers);
    await expect(createUser(actor, {})).rejects.toMatchObject({ status: 403 });
    await updateUser(admin, user.id, { name: user.name, phoneNumber: replacement, role: user.role, status: user.status, expectedVersion: user.version });
    await expect(requireUser(headers)).rejects.toMatchObject({ status: 401 });
    expect((await signIn(phoneNumber, tempPassword)).status).toBe(401);
    expect((await signIn(replacement, tempPassword)).status).toBe(200);
    expect((await listUsers(admin)).find(u => u.id === user.id)?.phoneNumber).toBe(replacement);
  });
  it("tài khoản cũ được gán số mà không đổi password/role; không mở lại auth email hay OTP", async () => {
    const id = randomUUID();
    const passwordHash = await hashPassword(tempPassword);
    const legacy = await db.user.create({ data: { id, name: "Legacy", email: `${id}@legacy.invalid`, role: "MEMBER", mustChangePassword: false, accounts: { create: { id: randomUUID(), providerId: "credential", accountId: id, password: passwordHash } } } });
    await updateUser(admin, id, { name: legacy.name, phoneNumber: newPhone(), role: legacy.role, status: legacy.status, expectedVersion: legacy.version });
    const migrated = await db.user.findUniqueOrThrow({ where: { id } });
    expect(migrated.email).toBe(legacy.email); expect(migrated.role).toBe("MEMBER"); expect(migrated.phoneNumber).toBeTruthy();
    expect((await db.account.findFirstOrThrow({ where: { userId: id, providerId: "credential" } })).password).toBe(passwordHash);
    expect((await signIn(migrated.phoneNumber!, tempPassword)).status).toBe(200);
    for (const path of ["sign-in/email", "sign-up/email", "phone-number/send-otp", "phone-number/verify", "phone-number/request-password-reset"]) {
      expect((await authPost(new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { origin }, body: "{}" }))).status).toBe(404);
    }
  });
  it("sai password và số chưa tồn tại có cùng thông báo; user bị khóa không đăng nhập", async () => {
    const user = await createUser(admin, { name: "Locked", phoneNumber: newPhone(), role: "MEMBER", temporaryPassword: tempPassword });
    await db.user.update({ where: { id: user.id }, data: { status: "LOCKED" } });
    const wrong = await signIn(user.phoneNumber!, "wrong-password-123");
    const missing = await signIn(newPhone(), tempPassword);
    const locked = await signIn(user.phoneNumber!, tempPassword);
    expect(wrong.status).toBe(401); expect(missing.status).toBe(401); expect(locked.status).toBe(401);
    expect(await wrong.json()).toEqual(await missing.json());
    expect(await locked.json()).toMatchObject({ code: "LOGIN_FAILED" });
  });
  it("giới hạn thử đăng nhập hoạt động và dùng chung counter cho các cách viết số", async () => {
    const local = `09${String(parseInt(randomUUID().replaceAll("-", "").slice(0, 7), 16) % 100000000).padStart(8, "0")}`;
    const canonical = `+84${local.slice(1)}`;
    for (let i = 0; i < 5; i++) expect((await signIn(i % 2 ? canonical : local, tempPassword)).status).toBe(401);
    expect((await signIn(local, tempPassword)).status).toBe(429);
    const key = `login:${createHash("sha256").update(canonical).digest("hex")}`;
    expect((await db.requestLimit.findUniqueOrThrow({ where: { key } })).count).toBe(6);
  });
});
