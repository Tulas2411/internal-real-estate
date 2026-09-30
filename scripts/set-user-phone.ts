import "dotenv/config";
import { parseArgs } from "node:util";
import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { phoneNumberSchema } from "../src/lib/phone";

async function main() {
  const { values } = parseArgs({ options: { id: { type: "string" }, phone: { type: "string" }, list: { type: "boolean" } } });
  if (values.list) {
    // Explicit operator command: no credentials or existing contact details printed.
    console.table(await db.user.findMany({ where: { phoneNumber: null }, select: { id: true, name: true, role: true, status: true } }));
    return;
  }
  const parsed = phoneNumberSchema.safeParse(values.phone);
  if (!values.id || !parsed.success) throw new Error("Dùng --id <user-id> --phone <số-điện-thoại-hợp-lệ>; --list để xem tài khoản chưa có số.");
  const id = values.id;
  const phoneNumber = parsed.data;
  await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    const result = await tx.user.updateMany({ where: { id, version: user.version }, data: { phoneNumber, phoneNumberVerified: false, version: { increment: 1 } } });
    if (!result.count) throw new Error("Tài khoản đã thay đổi, hãy chạy lại.");
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({ data: { actorId: id, action: "PHONE_MIGRATION_CLI", entity: "User", entityId: id, diff: { source: "database-operator-cli", phoneNumber: { old: user.phoneNumber, new: phoneNumber }, sessionsRevoked: true } } });
  });
  console.log("Đã gán số điện thoại và thu hồi phiên cũ. Mật khẩu, vai trò và quyền hồ sơ được giữ nguyên.");
}
main().catch(error => {
  console.error(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Số điện thoại đã được sử dụng." : error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Không thể gán số điện thoại. Kiểm tra kết nối database.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
