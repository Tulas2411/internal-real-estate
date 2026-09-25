import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { admin, propertyAccess, lockProperty, bumpProperty, type Actor } from "@/lib/policy";
import { audit, changes } from "@/lib/audit";
import { AppError, fail } from "@/lib/errors";
import { activeStatuses, validateTransition } from "@/lib/domain";
import { listingCreate, listingUpdate, statusSchema, versionSchema, commissionSchema, validatePrice } from "@/lib/validation";
import { publicListingSelect } from "./properties";
const dateFields = (v: { availableFrom: string | null; expectedHandoverDate: string | null }) => ({ availableFrom: v.availableFrom ? new Date(v.availableFrom) : null, expectedHandoverDate: v.expectedHandoverDate ? new Date(v.expectedHandoverDate) : null });
async function listingAccess(tx: Prisma.TransactionClient, actor: Actor, id: string, sensitive = false) {
  const initial = await tx.listing.findUnique({ where: { id }, select: { propertyId: true } });
  if (!initial) fail(404, "NOT_FOUND", "Không tìm thấy đợt giao dịch.");
  await lockProperty(tx, initial.propertyId);
  await propertyAccess(tx, actor, initial.propertyId, sensitive ? "editSensitive" : "edit");
  return tx.listing.findUniqueOrThrow({ where: { id } });
}
async function bump(tx: Prisma.TransactionClient, id: string, version: number) {
  const result = await tx.listing.updateMany({ where: { id, version }, data: { version: { increment: 1 } } });
  if (!result.count) fail(409, "CONFLICT", "Đợt giao dịch đã thay đổi. Tải lại để so sánh trước khi lưu.");
}
export async function createListing(actor: Actor, propertyId: string, raw: unknown) {
  admin(actor);
  const { expectedVersion, ...input } = listingCreate.parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, propertyId);
    await propertyAccess(tx, actor, propertyId, "edit");
    await bumpProperty(tx, propertyId, expectedVersion);
    const previous = await tx.listing.findFirst({ where: { propertyId, transactionType: input.transactionType }, orderBy: { cycleNumber: "desc" } });
    if (previous && activeStatuses.includes(previous.status)) fail(409, "ACTIVE_CYCLE", "Đã có một đợt giao dịch chưa kết thúc.");
    await tx.listing.updateMany({ where: { propertyId, transactionType: input.transactionType, isLatest: true }, data: { isLatest: false, version: { increment: 1 } } });
    const listing = await tx.listing.create({ data: { ...input, ...dateFields(input), propertyId, cycleNumber: (previous?.cycleNumber ?? 0) + 1 } });
    await tx.statusHistory.create({ data: { listingId: listing.id, toStatus: "AVAILABLE", reason: "Tạo đợt giao dịch", actorId: actor.id } });
    await audit(tx, actor, "CREATE", "Listing", listing.id, propertyId, changes({}, input));
    return { id: listing.id };
  });
}
export async function updateListing(actor: Actor, id: string, raw: unknown) {
  const { expectedVersion, ...input } = listingUpdate.parse(raw);
  return db.$transaction(async tx => {
    const listing = await listingAccess(tx, actor, id);
    if (!validatePrice(input, listing.transactionType)) fail(400, "PRICE", "Kiểm tra kiểu giá, số tiền và kỳ giá thuê.");
    if (!listing.isLatest || !activeStatuses.includes(listing.status)) fail(400, "CYCLE_CLOSED", "Chỉ sửa điều kiện của đợt hiện hành chưa kết thúc.");
    await bump(tx, id, expectedVersion);
    const result = await tx.listing.update({ where: { id }, data: { ...input, ...dateFields(input) }, select: publicListingSelect });
    await audit(tx, actor, "UPDATE", "Listing", id, listing.propertyId, changes(listing, { ...input, ...dateFields(input) }));
    return result;
  });
}
export async function updateCommission(actor: Actor, id: string, raw: unknown) {
  const { expectedVersion, ...input } = commissionSchema.parse(raw);
  return db.$transaction(async tx => {
    const listing = await listingAccess(tx, actor, id, true);
    await bump(tx, id, expectedVersion);
    await tx.listing.update({ where: { id }, data: input });
    await audit(tx, actor, "COMMISSION", "Listing", id, listing.propertyId, changes(listing, input), true);
    return { ok: true };
  });
}
export async function changeStatus(actor: Actor, id: string, raw: unknown) {
  const input = statusSchema.parse(raw);
  if (input.correction) admin(actor);
  return db.$transaction(async tx => {
    const listing = await listingAccess(tx, actor, id);
    validateTransition(listing.transactionType, listing.status, input.status, input.reason, input.correction);
    if (!listing.isLatest && activeStatuses.includes(input.status)) fail(409, "OLD_CYCLE", "Không mở lại đợt cũ khi đã có đợt mới hơn.");
    await bump(tx, id, input.expectedVersion);
    if (["SOLD", "RENTED"].includes(input.status)) {
      const other = await tx.listing.findFirst({ where: { propertyId: listing.propertyId, transactionType: listing.transactionType === "RENT" ? "SALE" : "RENT", status: { in: activeStatuses } } });
      if (other) {
        if (!input.otherListingAction || !input.otherListingReason?.trim()) throw new AppError(409, "OTHER_LISTING_OPEN", "Hồ sơ vẫn có đợt giao dịch khác đang mở. Chọn giữ hoặc rút và ghi lý do.", { otherListingId: other.id, transactionType: other.transactionType });
        if (input.otherListingAction === "WITHDRAW") {
          await tx.listing.update({ where: { id: other.id }, data: { status: "WITHDRAWN", version: { increment: 1 } } });
          await tx.statusHistory.create({ data: { listingId: other.id, fromStatus: other.status, toStatus: "WITHDRAWN", reason: input.otherListingReason, actorId: actor.id } });
        }
        await audit(tx, actor, "OTHER_LISTING_ACK", "Listing", other.id, listing.propertyId, { action: input.otherListingAction, reason: input.otherListingReason, status: { old: other.status, new: input.otherListingAction === "WITHDRAW" ? "WITHDRAWN" : other.status } });
      }
    }
    await tx.listing.update({ where: { id }, data: { status: input.status } });
    await tx.statusHistory.create({ data: { listingId: id, fromStatus: listing.status, toStatus: input.status, reason: input.reason, actorId: actor.id } });
    await audit(tx, actor, input.correction ? "CORRECTION" : "STATUS", "Listing", id, listing.propertyId, { ...changes(listing, { status: input.status }), reason: input.reason });
    return { ok: true };
  });
}
export async function confirmListing(actor: Actor, id: string, raw: unknown) {
  const { expectedVersion } = versionSchema.parse(raw);
  return db.$transaction(async tx => {
    const listing = await listingAccess(tx, actor, id);
    if (!activeStatuses.includes(listing.status)) fail(400, "CYCLE_CLOSED", "Đợt giao dịch đã kết thúc.");
    await bump(tx, id, expectedVersion);
    const lastConfirmedAt = new Date();
    await tx.listing.update({ where: { id }, data: { lastConfirmedAt, lastConfirmedById: actor.id } });
    await audit(tx, actor, "CONFIRM", "Listing", id, listing.propertyId, changes(listing, { lastConfirmedAt, lastConfirmedById: actor.id }));
    return { ok: true };
  });
}
