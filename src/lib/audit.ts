import type { Prisma } from "@prisma/client";
import type { Actor } from "./policy";
export function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)); }
export function changes(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(after).filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v)).map(([k, v]) => [k, { old: before[k] ?? null, new: v }]));
}
export async function audit(tx: Prisma.TransactionClient, actor: Actor, action: string, entity: string, entityId: string, propertyId: string | null, diff: unknown, sensitive = false) {
  await tx.auditLog.create({ data: { actorId: actor.id, action, entity, entityId, propertyId, diff: json(diff), sensitive } });
}
