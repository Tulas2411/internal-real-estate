import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { userCreate } from "../src/lib/validation";
async function main() {
  const parsed = userCreate.safeParse({ name: process.env.BOOTSTRAP_ADMIN_NAME, email: process.env.BOOTSTRAP_ADMIN_EMAIL, temporaryPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD, role: "ADMIN" });
  if (!parsed.success) throw new Error("Điền BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD (ít nhất 12 ký tự).");
  const { name, email, temporaryPassword } = parsed.data;
  const password = await hashPassword(temporaryPassword);
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(821731)`;
    if (await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } })) throw new Error("Đã có quản trị viên hoạt động; hãy dùng giao diện quản trị.");
    const id = randomUUID();
    await tx.user.create({ data: { id, name, email, role: "ADMIN", mustChangePassword: true, accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } } } });
    await tx.auditLog.create({ data: { actorId: id, action: "BOOTSTRAP", entity: "User", entityId: id, diff: { bootstrap: true } } });
  });
  console.log("Đã tạo admin. Đăng nhập và đổi mật khẩu tạm; xóa đầu vào bootstrap khỏi môi trường sau đó.");
}
main().catch(e => { console.error(e instanceof Error && !e.name.startsWith("Prisma") ? e.message : "Không thể tạo admin. Kiểm tra database và email trùng."); process.exitCode = 1; }).finally(() => db.$disconnect());
