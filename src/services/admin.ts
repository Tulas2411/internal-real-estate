import { z } from "zod";
import { db } from "@/lib/db";
import { admin, type Actor } from "@/lib/policy";
export async function auditList(actor: Actor, raw: unknown) {
  admin(actor);
  const q = z.object({ actorId: z.string().optional(), entity: z.string().optional(), action: z.string().optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), page: z.coerce.number().int().min(1).default(1) }).parse(raw);
  const where = { ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.entity ? { entity: q.entity } : {}), ...(q.action ? { action: q.action } : {}), ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00+07:00`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999+07:00`) } : {}) } } : {}) };
  const [total, items] = await db.$transaction([db.auditLog.count({ where }), db.auditLog.findMany({ where, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * 25, take: 25 })]);
  return { items, total, page: q.page, pages: Math.ceil(total / 25) };
}
export async function permissionList(actor: Actor) {
  admin(actor);
  return db.propertyPermission.findMany({ include: { user: { select: { name: true, email: true } }, property: { select: { id: true, code: true, title: true } }, grantedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 500 });
}
export async function archivedList(actor: Actor) {
  admin(actor);
  return db.property.findMany({ where: { visibility: "ARCHIVED" }, select: { id: true, code: true, title: true, archivedAt: true, version: true }, orderBy: { archivedAt: "desc" }, take: 200 });
}
