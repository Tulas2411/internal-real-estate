import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { admin, propertyAccess, visibleWhere, lockProperty, bumpProperty, type Actor } from "@/lib/policy";
import { audit, changes } from "@/lib/audit";
import { fail } from "@/lib/errors";
import { propertyCreate, propertyUpdate, ownerSchema, visibilitySchema, permissionSchema, assignSchema, searchSchema } from "@/lib/validation";
import { activeStatuses, isStale } from "@/lib/domain";

export const publicListingSelect = {
  id: true, propertyId: true, transactionType: true, cycleNumber: true, isLatest: true, status: true, priceMode: true, currency: true, amount: true, rentPeriod: true, saleAreaBasis: true,
  requiredDepositAmount: true, paymentCycle: true, minLeaseMonths: true, managementFee: true, electricityNote: true, waterNote: true, parkingFee: true, availableFrom: true, usageConditions: true,
  paymentTerms: true, taxFeeResponsibilityNote: true, expectedHandoverDate: true, transactionNotes: true, lastConfirmedAt: true, lastConfirmedById: true, version: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ListingSelect;
export const imageSelect = { id: true, caption: true, sortOrder: true, isCover: true, width: true, height: true } satisfies Prisma.PropertyImageSelect;

export async function listProperties(actor: Actor, raw: unknown) {
  const q = searchSchema.parse(raw);
  if (q.visibility === "ARCHIVED") admin(actor);
  const property: Prisma.PropertyWhereInput = { AND: [visibleWhere(actor)], ...(q.visibility ? { visibility: q.visibility } : { visibility: { not: "ARCHIVED" } }) };
  if (q.q) property.OR = ["code", "title", "provinceCity", "wardCommune", "addressLine", "projectBuilding"].map(k => ({ [k]: { contains: q.q, mode: "insensitive" } }));
  if (q.propertyType) property.propertyType = q.propertyType;
  if (q.region) property.provinceCity = { contains: q.region, mode: "insensitive" };
  if (q.responsibleUserId) property.responsibleUserId = q.responsibleUserId;
  if (q.mine === "true") property.permissions = { some: { userId: actor.id, canEdit: true } };
  if (q.bedrooms !== undefined) property.bedrooms = { gte: q.bedrooms };
  if (q.minArea || q.maxArea) property.usableArea = { ...(q.minArea ? { gte: q.minArea } : {}), ...(q.maxArea ? { lte: q.maxArea } : {}) };
  const where: Prisma.ListingWhereInput = { property, isLatest: true, transactionType: q.transactionType };
  if (q.status) where.status = q.status;
  if (q.minPrice || q.maxPrice) {
    where.amount = { ...(q.minPrice ? { gte: q.minPrice } : {}), ...(q.maxPrice ? { lte: q.maxPrice } : {}) };
    if (q.transactionType === "RENT") where.rentPeriod = q.rentPeriod;
  }
  if (q.stale === "true") where.AND = [{ status: { in: activeStatuses } }, { OR: [{ lastConfirmedAt: null }, { lastConfirmedAt: { lte: new Date(Date.now() - 14 * 86400000) } }] }];
  // Price ordering never mixes yearly and monthly rent prices.
  if (q.sort.startsWith("price") && q.transactionType === "RENT") where.rentPeriod = q.rentPeriod;
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = q.sort === "priceAsc" ? [{ amount: { sort: "asc", nulls: "last" } }, { id: "asc" }] : q.sort === "priceDesc" ? [{ amount: { sort: "desc", nulls: "last" } }, { id: "asc" }] : q.sort === "oldestConfirmed" ? [{ lastConfirmedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "asc" }];
  const [total, items] = await db.$transaction([
    db.listing.count({ where }),
    db.listing.findMany({ where, select: { ...publicListingSelect, property: { select: { id: true, code: true, title: true, propertyType: true, provinceCity: true, wardCommune: true, addressLine: true, usableArea: true, landArea: true, bedrooms: true, visibility: true, responsibleUser: { select: { name: true } }, images: { where: { isCover: true }, select: imageSelect, take: 1 } } } }, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { items: items.map(x => ({ ...x, stale: isStale(x.status, x.lastConfirmedAt) })), total, page: q.page, pageSize: q.pageSize, pages: Math.ceil(total / q.pageSize) };
}
export async function getProperty(actor: Actor, id: string) {
  return db.$transaction(async tx => {
    const { access } = await propertyAccess(tx, actor, id);
    const property = await tx.property.findUniqueOrThrow({ where: { id }, include: {
      responsibleUser: { select: { id: true, name: true } }, images: { orderBy: { sortOrder: "asc" }, select: imageSelect },
      listings: { orderBy: [{ transactionType: "asc" }, { cycleNumber: "desc" }], select: { ...publicListingSelect, ...(access.sensitive ? { commissionType: true, expectedCommissionAmount: true, expectedCommissionRate: true, commissionNote: true } : {}), ...(access.history ? { history: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } } } : {}) } },
      ...(access.sensitive ? { owner: true, documents: { select: { id: true, originalName: true, documentType: true, bytes: true, createdAt: true } } } : {}),
      ...(access.admin ? { permissions: { include: { user: { select: { id: true, name: true, email: true } } } } } : {}),
    } });
    const audits = access.history ? await tx.auditLog.findMany({ where: { propertyId: id, ...(access.sensitive ? {} : { sensitive: false }) }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } }) : undefined;
    return { ...property, access, ...(audits ? { audits } : {}), listings: property.listings.map(l => ({ ...l, stale: isStale(l.status, l.lastConfirmedAt), pricePerSquareMeter: l.transactionType === "SALE" && l.amount && property[l.saleAreaBasis === "landArea" ? "landArea" : "usableArea"] ? l.amount.div(property[l.saleAreaBasis === "landArea" ? "landArea" : "usableArea"]!).toFixed(2) : null })) };
  });
}
export async function createProperty(actor: Actor, raw: unknown) {
  admin(actor);
  const input = propertyCreate.parse(raw);
  return db.$transaction(async tx => {
    const property = await tx.property.create({ data: { ...input, createdById: actor.id, ...(input.legalStatus === "VERIFIED" ? { verifiedAt: new Date(), verifiedById: actor.id } : {}) } });
    await audit(tx, actor, "CREATE", "Property", property.id, property.id, changes({}, input));
    return property;
  });
}
export async function updateProperty(actor: Actor, id: string, raw: unknown) {
  const { expectedVersion, ...input } = propertyUpdate.parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, id);
    const { property } = await propertyAccess(tx, actor, id, "edit");
    await bumpProperty(tx, id, expectedVersion);
    const verified = input.legalStatus === "VERIFIED" && property.legalStatus !== "VERIFIED" ? { verifiedAt: new Date(), verifiedById: actor.id } : input.legalStatus && input.legalStatus !== "VERIFIED" ? { verifiedAt: null, verifiedById: null } : {};
    const result = await tx.property.update({ where: { id }, data: { ...input, ...verified } });
    if (property.visibility === "PUBLISHED") await assertPublishable(tx, id);
    await audit(tx, actor, "UPDATE", "Property", id, id, changes(property, { ...input, ...verified }));
    return result;
  });
}
async function assertPublishable(tx: Prisma.TransactionClient, id: string) {
  const p = await tx.property.findUniqueOrThrow({ where: { id }, include: { _count: { select: { images: true, listings: true } } } });
  if (!p.title || !p.provinceCity || !p.wardCommune || !p.addressLine || !p._count.images || !p._count.listings) fail(400, "PUBLISH_REQUIREMENTS", "Để hiển thị, cần tiêu đề, tỉnh/thành, phường/xã, địa chỉ, ít nhất một ảnh và một đợt giao dịch hợp lệ.");
}
export async function setVisibility(actor: Actor, id: string, raw: unknown) {
  admin(actor);
  const input = visibilitySchema.parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, id);
    const { property } = await propertyAccess(tx, actor, id);
    if (property.visibility === "ARCHIVED" && input.visibility !== "PAUSED") fail(400, "RESTORE_PAUSED", "Khôi phục hồ sơ về Tạm ngưng để kiểm tra.");
    if (input.visibility === "PUBLISHED") await assertPublishable(tx, id);
    await bumpProperty(tx, id, input.expectedVersion);
    const result = await tx.property.update({ where: { id }, data: { visibility: input.visibility, archivedAt: input.visibility === "ARCHIVED" ? new Date() : null } });
    await audit(tx, actor, property.visibility === "ARCHIVED" ? "RESTORE" : input.visibility === "ARCHIVED" ? "ARCHIVE" : "VISIBILITY", "Property", id, id, changes(property, { visibility: result.visibility }));
    return result;
  });
}
export async function updateOwner(actor: Actor, id: string, raw: unknown) {
  const { expectedVersion, ...input } = ownerSchema.parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, id);
    await propertyAccess(tx, actor, id, "editSensitive");
    await bumpProperty(tx, id, expectedVersion);
    const old = await tx.ownerContact.findUnique({ where: { propertyId: id } });
    const owner = await tx.ownerContact.upsert({ where: { propertyId: id }, create: { ...input, propertyId: id }, update: input });
    await audit(tx, actor, "OWNER_UPDATE", "OwnerContact", owner.id, id, changes(old ?? {}, input), true);
    return owner;
  });
}
export async function grantPermission(actor: Actor, id: string, raw: unknown) {
  admin(actor);
  const { expectedVersion, ...input } = permissionSchema.parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, id);
    await propertyAccess(tx, actor, id);
    await bumpProperty(tx, id, expectedVersion);
    const old = await tx.propertyPermission.findUnique({ where: { propertyId_userId: { propertyId: id, userId: input.userId } } });
    if (!input.canEdit && !input.canViewSensitive) await tx.propertyPermission.deleteMany({ where: { propertyId: id, userId: input.userId } });
    else await tx.propertyPermission.upsert({ where: { propertyId_userId: { propertyId: id, userId: input.userId } }, create: { ...input, propertyId: id, grantedById: actor.id }, update: { ...input, grantedById: actor.id } });
    await audit(tx, actor, "PERMISSION", "PropertyPermission", input.userId, id, changes(old ?? {}, input));
    return { ok: true };
  });
}
export async function assignProperty(actor: Actor, id: string, raw: unknown) {
  admin(actor);
  const { expectedVersion, responsibleUserId } = assignSchema.parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, id);
    const { property } = await propertyAccess(tx, actor, id);
    await bumpProperty(tx, id, expectedVersion);
    await tx.property.update({ where: { id }, data: { responsibleUserId } });
    await audit(tx, actor, "ASSIGN", "Property", id, id, changes(property, { responsibleUserId }));
    return { ok: true };
  });
}
export async function dashboard(actor: Actor) {
  const property = { AND: [visibleWhere(actor), { visibility: { not: "ARCHIVED" as const } }] };
  const [counts, stale, assigned, recent, drafts] = await Promise.all([
    db.listing.groupBy({ by: ["transactionType", "status"], where: { property, isLatest: true }, _count: true }),
    db.listing.groupBy({ by: ["transactionType"], where: { property, isLatest: true, status: { in: activeStatuses }, OR: [{ lastConfirmedAt: null }, { lastConfirmedAt: { lte: new Date(Date.now() - 14 * 86400000) } }] }, _count: true }),
    db.property.count({ where: { AND: [property], permissions: { some: { userId: actor.id, canEdit: true } } } }),
    db.auditLog.findMany({ where: { sensitive: false, property: { AND: [property, actor.role === "ADMIN" ? {} : { permissions: { some: { userId: actor.id, canEdit: true } } }] } }, select: { id: true, action: true, createdAt: true, actor: { select: { name: true } }, property: { select: { id: true, code: true, title: true } } }, take: 8, orderBy: { createdAt: "desc" } }),
    db.property.findMany({ where: { AND: [visibleWhere(actor)], visibility: "DRAFT" }, select: { id: true, code: true, title: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);
  return { counts, stale, assigned, recent, drafts };
}
