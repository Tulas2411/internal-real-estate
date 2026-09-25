import { describe, it, expect } from "vitest";
import { isStale, validateTransition } from "../../src/lib/domain";
import { propertyCreate, propertyUpdate, listingCreate, commissionSchema, searchSchema } from "../../src/lib/validation";
import { rights } from "../../src/lib/policy";
const member = { id: "m", name: "M", email: "m@example.test", role: "MEMBER" as const, status: "ACTIVE" as const, mustChangePassword: false, version: 1 };
describe("Phân quyền độc lập", () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])("edit=%s sensitive=%s", (canEdit, canViewSensitive) => {
    const r = rights(member, "PUBLISHED", { canEdit, canViewSensitive });
    expect(r.edit).toBe(canEdit); expect(r.sensitive).toBe(canViewSensitive); expect(r.editSensitive).toBe(canEdit && canViewSensitive); expect(r.history).toBe(canEdit);
  });
  it("sensitive-only không thấy nháp; member không thấy lưu trữ", () => {
    expect(rights(member, "DRAFT", { canEdit: false, canViewSensitive: true }).view).toBe(false);
    expect(rights(member, "ARCHIVED", { canEdit: true, canViewSensitive: true }).view).toBe(false);
  });
  it("admin không cần permission", () => expect(rights({ ...member, role: "ADMIN" }, "ARCHIVED").editSensitive).toBe(true));
});
describe("Vòng đời", () => {
  it.each(["RENTED", "DEPOSITED"] as const)("thuê AVAILABLE → %s", status => expect(() => validateTransition("RENT", "AVAILABLE", status, "")).not.toThrow());
  it("không trộn RENT và SOLD", () => expect(() => validateTransition("RENT", "AVAILABLE", "SOLD", "")).toThrow());
  it("hủy cọc và rút tin cần lý do", () => { expect(() => validateTransition("SALE", "DEPOSITED", "AVAILABLE", " ")).toThrow(); expect(() => validateTransition("SALE", "AVAILABLE", "WITHDRAWN", "")).toThrow(); });
  it("không lùi trạng thái đã kết thúc", () => expect(() => validateTransition("SALE", "SOLD", "AVAILABLE", "")).toThrow());
  it("correction riêng có lý do", () => { expect(() => validateTransition("SALE", "SOLD", "AVAILABLE", "Sửa nhầm", true)).not.toThrow(); expect(() => validateTransition("SALE", "SOLD", "AVAILABLE", "", true)).toThrow(); });
  it("stale chính xác mốc 14 ngày, không lấy updatedAt", () => {
    const now = new Date("2026-09-25T00:00:00Z");
    expect(isStale("AVAILABLE", new Date("2026-09-11T00:00:00Z"), now)).toBe(true);
    expect(isStale("AVAILABLE", new Date("2026-09-11T00:00:00.001Z"), now)).toBe(false);
    expect(isStale("AVAILABLE", null, now)).toBe(true); expect(isStale("SOLD", null, now)).toBe(false);
  });
});
describe("Validation và whitelist", () => {
  it("chặn field quyền và thông tin nhạy cảm trong DTO thường", () => {
    for (const field of ["role", "visibility", "createdById", "responsibleUserId", "owner", "permissions", "code", "version"]) expect(propertyUpdate.safeParse({ expectedVersion: 1, [field]: "ADMIN" }).success).toBe(false);
  });
  it("nháp thiếu trường được lưu; địa chỉ nguy hiểm bị chặn", () => { expect(propertyCreate.safeParse({}).success).toBe(true); expect(propertyCreate.safeParse({ mapUrl: "javascript:alert(1)" }).success).toBe(false); });
  it("diện tích và số lượng phải hợp lệ", () => { expect(propertyCreate.safeParse({ landArea: "0" }).success).toBe(false); expect(propertyCreate.safeParse({ bedrooms: -1 }).success).toBe(false); });
  it("không nhận sort tùy ý hoặc pageSize vô hạn", () => { expect(searchSchema.safeParse({ sort: "owner.phone" }).success).toBe(false); expect(searchSchema.safeParse({ pageSize: 1000 }).success).toBe(false); });
  it("hoa hồng có một kiểu và tỷ lệ tối đa 100%", () => expect(commissionSchema.safeParse({ commissionType: "RATE", expectedCommissionRate: "101", expectedCommissionAmount: null, commissionNote: "", expectedVersion: 1 }).success).toBe(false));
  const base = { transactionType: "RENT", expectedVersion: 1, priceMode: "FIXED", amount: "15000000", rentPeriod: "MONTH", saleAreaBasis: "usableArea", requiredDepositAmount: null, paymentCycle: "", minLeaseMonths: null, managementFee: null, electricityNote: "", waterNote: "", parkingFee: null, availableFrom: null, usageConditions: "", paymentTerms: "", taxFeeResponsibilityNote: "", expectedHandoverDate: null, transactionNotes: "" };
  it("giá FIXED cần >0, ON_REQUEST phải null, không nhầm kỳ giá", () => {
    expect(listingCreate.safeParse(base).success).toBe(true);
    for (const data of [{ ...base, amount: "0" }, { ...base, amount: null }, { ...base, priceMode: "ON_REQUEST" }, { ...base, transactionType: "SALE" }]) expect(listingCreate.safeParse(data).success).toBe(false);
    expect(listingCreate.safeParse({ ...base, priceMode: "ON_REQUEST", amount: null }).success).toBe(true);
    expect(listingCreate.safeParse({ ...base, priceMode: "NEGOTIABLE", amount: null }).success).toBe(true);
  });
});
