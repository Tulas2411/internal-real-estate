import type { Prisma, User, Visibility } from "@prisma/client";
import { auth } from "./auth";
import { db } from "./db";
import { fail } from "./errors";
export type Actor = Pick<User, "id" | "name" | "email" | "role" | "status" | "mustChangePassword" | "version">;
export async function requireUser(headers: Headers, allowPasswordChange = false): Promise<Actor> {
  const session = await auth.api.getSession({ headers });
  if (!session) fail(401, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true, version: true } });
  if (!user || user.status !== "ACTIVE") fail(401, "UNAUTHENTICATED", "Phiên đăng nhập đã hết hiệu lực.");
  if (user.mustChangePassword && !allowPasswordChange) fail(403, "PASSWORD_CHANGE_REQUIRED", "Bạn cần đổi mật khẩu tạm trước khi tiếp tục.");
  return user;
}
export function admin(actor: Actor) { if (actor.role !== "ADMIN") fail(403, "FORBIDDEN", "Chỉ quản trị viên được thực hiện thao tác này."); }
export function rights(actor: Actor, visibility: Visibility, permission?: { canEdit: boolean; canViewSensitive: boolean } | null) {
  const isAdmin = actor.role === "ADMIN";
  const edit = isAdmin || !!permission?.canEdit;
  const sensitive = isAdmin || !!permission?.canViewSensitive;
  const view = isAdmin || (visibility !== "ARCHIVED" && (visibility !== "DRAFT" || edit));
  return { view, edit: view && edit, sensitive: view && sensitive, editSensitive: view && edit && sensitive, history: view && edit, admin: isAdmin };
}
export function visibleWhere(actor: Actor): Prisma.PropertyWhereInput {
  return actor.role === "ADMIN" ? {} : { OR: [{ visibility: { in: ["PUBLISHED", "PAUSED"] } }, { visibility: "DRAFT", permissions: { some: { userId: actor.id, canEdit: true } } }] };
}
export async function propertyAccess(tx: Prisma.TransactionClient, actor: Actor, propertyId: string, need: "view" | "edit" | "sensitive" | "editSensitive" | "history" = "view") {
  const property = await tx.property.findUnique({ where: { id: propertyId }, include: { permissions: { where: { userId: actor.id } } } });
  if (!property) fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ.");
  const access = rights(actor, property.visibility, property.permissions[0]);
  if (!access.view) fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ.");
  if (!access[need]) fail(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  return { property, access };
}
export async function lockProperty(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${id} FOR UPDATE`;
}
export async function bumpProperty(tx: Prisma.TransactionClient, id: string, version: number) {
  const result = await tx.property.updateMany({ where: { id, version }, data: { version: { increment: 1 } } });
  if (!result.count) fail(409, "CONFLICT", "Hồ sơ đã được người khác sửa. Tải lại để so sánh; bản nhập của bạn vẫn được giữ.");
}
