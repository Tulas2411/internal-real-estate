import { z } from "zod";
export const propertyTypes = ["APARTMENT", "HOUSE", "LAND", "ROOM", "OFFICE", "RETAIL", "WAREHOUSE", "OTHER"] as const;
export const statuses = ["AVAILABLE", "DEPOSITED", "RENTED", "SOLD", "WITHDRAWN"] as const;
const text = z.string().trim().max(10000, "Tối đa 10.000 ký tự");
const short = z.string().trim().max(300, "Tối đa 300 ký tự");
const decimal = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/, "Nhập số dương, tối đa 2 chữ số thập phân");
const positive = decimal.refine(v => Number(v) > 0, "Phải lớn hơn 0").nullable();
const money = decimal.nullable();
const count = z.number().int().min(0).max(10000).nullable();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Ngày không hợp lệ").nullable();
export const versionSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const propertyFields = z.object({
  title: short, propertyType: z.enum(propertyTypes), provinceCity: short, wardCommune: short, addressLine: short,
  projectBuilding: short, mapUrl: z.union([z.literal(""), z.url().refine(v => /^https?:\/\//i.test(v), "Chỉ chấp nhận http/https")]),
  landArea: positive, usableArea: positive, bedrooms: count, bathrooms: count, floorNumber: count, totalFloors: count,
  frontage: positive, accessRoadWidth: positive, houseDirection: short, balconyDirection: short,
  furnishing: text, amenities: text, description: text, highlights: text, viewingNotes: text,
  legalSummary: text, legalStatus: z.enum(["UNKNOWN", "OWNER_PROVIDED", "VERIFIED"]), verificationNotes: text,
}).strict();
export const propertyCreate = propertyFields.partial();
export const propertyUpdate = propertyFields.partial().extend({ expectedVersion: z.number().int().positive() }).strict();
export const ownerSchema = z.object({ name: short, phone: short, zalo: short, source: short, sensitiveNotes: text, expectedVersion: z.number().int().positive() }).strict();
export const listingFields = z.object({
  priceMode: z.enum(["FIXED", "NEGOTIABLE", "ON_REQUEST"]), amount: positive, rentPeriod: z.enum(["MONTH", "YEAR"]).nullable(),
  saleAreaBasis: z.enum(["usableArea", "landArea"]), requiredDepositAmount: money, paymentCycle: short,
  minLeaseMonths: count, managementFee: money, electricityNote: short, waterNote: short, parkingFee: money,
  availableFrom: dateOnly, usageConditions: text, paymentTerms: text, taxFeeResponsibilityNote: text,
  expectedHandoverDate: dateOnly, transactionNotes: text,
}).strict();
export function validatePrice(data: { priceMode: string; amount: string | null; rentPeriod: string | null }, type: string) {
  return (data.priceMode !== "FIXED" || (data.amount !== null && Number(data.amount) > 0)) &&
    (data.priceMode !== "ON_REQUEST" || data.amount === null) && (type !== "RENT" || data.rentPeriod !== null) && (type !== "SALE" || data.rentPeriod === null);
}
export const listingCreate = listingFields.extend({ transactionType: z.enum(["RENT", "SALE"]), expectedVersion: z.number().int().positive() }).strict()
  .refine(v => validatePrice(v, v.transactionType), "Kiểm tra kiểu giá, số tiền và kỳ giá thuê.");
export const listingUpdate = listingFields.extend({ expectedVersion: z.number().int().positive() }).strict();
export const commissionSchema = z.object({ commissionType: z.enum(["NONE", "AMOUNT", "RATE"]), expectedCommissionAmount: money, expectedCommissionRate: decimal.refine(v => Number(v) <= 100, "Tỷ lệ từ 0 đến 100").nullable(), commissionNote: text, expectedVersion: z.number().int().positive() }).strict().refine(v =>
  v.commissionType === "NONE" ? v.expectedCommissionAmount === null && v.expectedCommissionRate === null : v.commissionType === "AMOUNT" ? v.expectedCommissionAmount !== null && v.expectedCommissionRate === null : v.expectedCommissionRate !== null && v.expectedCommissionAmount === null,
  "Chọn đúng một kiểu hoa hồng và giá trị tương ứng.");
export const statusSchema = z.object({ expectedVersion: z.number().int().positive(), status: z.enum(statuses), reason: short.default(""), correction: z.boolean().default(false), otherListingAction: z.enum(["KEEP", "WITHDRAW"]).optional(), otherListingReason: short.optional() }).strict();
export const visibilitySchema = z.object({ expectedVersion: z.number().int().positive(), visibility: z.enum(["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED"]) }).strict();
export const permissionSchema = z.object({ expectedVersion: z.number().int().positive(), userId: z.string().min(1), canEdit: z.boolean(), canViewSensitive: z.boolean() }).strict();
export const assignSchema = z.object({ expectedVersion: z.number().int().positive(), responsibleUserId: z.string().min(1).nullable() }).strict();
export const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12, "Mật khẩu ít nhất 12 ký tự").max(128) }).strict().refine(v => v.currentPassword !== v.newPassword, "Mật khẩu mới phải khác mật khẩu cũ.");
export const userCreate = z.object({ name: short.min(1), email: z.email().transform(v => v.toLowerCase().trim()), role: z.enum(["ADMIN", "MEMBER"]), temporaryPassword: z.string().min(12).max(128) }).strict();
export const userUpdate = z.object({ expectedVersion: z.number().int().positive(), name: short.min(1), role: z.enum(["ADMIN", "MEMBER"]), status: z.enum(["ACTIVE", "LOCKED"]) }).strict();
export const userReset = z.object({ expectedVersion: z.number().int().positive(), temporaryPassword: z.string().min(12).max(128) }).strict();
export const searchSchema = z.object({
  q: short.default(""), transactionType: z.enum(["RENT", "SALE"]).default("RENT"), propertyType: z.enum(propertyTypes).optional(), region: short.optional(), status: z.enum(statuses).optional(),
  minPrice: decimal.optional(), maxPrice: decimal.optional(), rentPeriod: z.enum(["MONTH", "YEAR"]).default("MONTH"), minArea: decimal.optional(), maxArea: decimal.optional(), bedrooms: z.coerce.number().int().min(0).optional(),
  responsibleUserId: short.optional(), mine: z.enum(["true", "false"]).optional(), stale: z.enum(["true", "false"]).optional(),
  visibility: z.enum(["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(["updated", "priceAsc", "priceDesc", "oldestConfirmed"]).default("updated"),
});
export type PropertyInput = z.infer<typeof propertyFields>;
export type ListingInput = z.infer<typeof listingFields>;
