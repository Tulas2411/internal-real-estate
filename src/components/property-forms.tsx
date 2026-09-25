"use client";
import { DataForm, mutate, options, type Field } from "./common";
import { propertyTypes, propertyCreate, propertyUpdate, listingFields, listingCreate } from "@/lib/validation";
import type { PropertyDTO, ListingDTO } from "@/lib/dto";
export const propertyFormFields: Field[] = [
  { name: "title", label: "Tiêu đề" }, { name: "propertyType", label: "Loại bất động sản", options: options(propertyTypes), hint: "Đổi loại hình vẫn giữ các thông số đã nhập. Hãy kiểm tra trường không còn phù hợp." },
  { name: "provinceCity", label: "Tỉnh / thành phố" }, { name: "wardCommune", label: "Phường / xã" }, { name: "addressLine", label: "Địa chỉ" }, { name: "projectBuilding", label: "Dự án / tòa nhà" }, { name: "mapUrl", label: "Liên kết bản đồ", hint: "Chỉ nhận liên kết http hoặc https" },
  ...[{ name: "landArea", label: "Diện tích đất (m²)" }, { name: "usableArea", label: "Diện tích sử dụng (m²)" }, { name: "bedrooms", label: "Phòng ngủ" }, { name: "bathrooms", label: "Phòng tắm" }, { name: "floorNumber", label: "Tầng" }, { name: "totalFloors", label: "Tổng số tầng" }, { name: "frontage", label: "Mặt tiền (m)" }, { name: "accessRoadWidth", label: "Đường vào (m)" }].map(f => ({ ...f, type: "number" as const })),
  { name: "houseDirection", label: "Hướng nhà" }, { name: "balconyDirection", label: "Hướng ban công" }, { name: "furnishing", label: "Nội thất" }, { name: "amenities", label: "Tiện ích" },
  { name: "description", label: "Mô tả", type: "textarea" }, { name: "highlights", label: "Điểm nổi bật", type: "textarea" }, { name: "viewingNotes", label: "Ghi chú dẫn khách (thông thường)", type: "textarea" },
  { name: "legalSummary", label: "Tóm tắt pháp lý (không chứa dữ liệu cá nhân)", type: "textarea" }, { name: "legalStatus", label: "Tình trạng pháp lý", options: options(["UNKNOWN", "OWNER_PROVIDED", "VERIFIED"]) }, { name: "verificationNotes", label: "Ghi chú xác minh (không nhạy cảm)", type: "textarea" },
];
export function normalizeFields(values: Record<string, string>, fields: Field[]) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const field = fields.find(f => f.name === key);
    if (field?.type === "number") return [key, value === "" ? null : ["bedrooms", "bathrooms", "floorNumber", "totalFloors", "minLeaseMonths"].includes(key) ? Number(value) : value];
    if (field?.type === "date") return [key, value || null];
    return [key, value];
  }));
}
export function PropertyForm({ property, done }: { property?: PropertyDTO; done?: () => void }) {
  return <DataForm fields={propertyFormFields} initial={property ?? { propertyType: "APARTMENT", legalStatus: "UNKNOWN" }} schema={property ? propertyUpdate : propertyCreate} transform={v => ({ ...normalizeFields(v, propertyFormFields), ...(property ? { expectedVersion: property.version } : {}) })} submit={async values => { const p = await mutate<{ id: string }>(property ? `properties/${property.id}` : "properties", values, property ? "PATCH" : "POST"); if (!property) window.location.assign(`/properties/${p.id}`); }} onDone={done} submitLabel={property ? "Lưu hồ sơ" : "Tạo bản nháp"} />;
}
export function listingFormFields(type: string): Field[] {
  return [{ name: "priceMode", label: "Kiểu giá", options: options(["FIXED", "NEGOTIABLE", "ON_REQUEST"]) }, { name: "amount", label: "Giá chào (VND)", type: "number", hint: "Để trống khi liên hệ giá. Không dùng số 0." }, ...(type === "RENT" ? [{ name: "rentPeriod", label: "Kỳ giá", options: options(["MONTH", "YEAR"]) }, { name: "requiredDepositAmount", label: "Tiền cọc yêu cầu (VND)", type: "number" as const, hint: "Chỉ là điều kiện, không ghi nhận thanh toán." }, { name: "paymentCycle", label: "Chu kỳ thanh toán" }, { name: "minLeaseMonths", label: "Thời hạn thuê tối thiểu (tháng)", type: "number" as const }, { name: "managementFee", label: "Phí quản lý (VND)", type: "number" as const }, { name: "parkingFee", label: "Phí gửi xe (VND)", type: "number" as const }, { name: "electricityNote", label: "Điện" }, { name: "waterNote", label: "Nước" }, { name: "availableFrom", label: "Có thể thuê từ", type: "date" as const }, { name: "usageConditions", label: "Điều kiện sử dụng", type: "textarea" as const }] : [{ name: "saleAreaBasis", label: "Diện tích tính đơn giá", options: [{ value: "usableArea", label: "Diện tích sử dụng" }, { value: "landArea", label: "Diện tích đất" }] }, { name: "paymentTerms", label: "Điều kiện thanh toán", type: "textarea" as const }, { name: "taxFeeResponsibilityNote", label: "Trách nhiệm thuế / phí", type: "textarea" as const }, { name: "expectedHandoverDate", label: "Ngày bàn giao dự kiến", type: "date" as const }, { name: "transactionNotes", label: "Ghi chú giao dịch", type: "textarea" as const }])];
}
export const listingDefaults = { priceMode: "ON_REQUEST", amount: null, rentPeriod: "MONTH", saleAreaBasis: "usableArea", requiredDepositAmount: null, paymentCycle: "", minLeaseMonths: null, managementFee: null, electricityNote: "", waterNote: "", parkingFee: null, availableFrom: null, usageConditions: "", paymentTerms: "", taxFeeResponsibilityNote: "", expectedHandoverDate: null, transactionNotes: "" };
export function ListingForm({ property, listing, type, done }: { property: PropertyDTO; listing?: ListingDTO; type: "RENT" | "SALE"; done: () => void }) {
  const fields = listingFormFields(type);
  return <DataForm fields={fields} initial={listing ?? listingDefaults} schema={listing ? undefined : listingCreate} transform={v => {
    const all = { ...listingDefaults, ...(listing ? Object.fromEntries(Object.keys(listingDefaults).map(k => [k, listing[k]])) : {}), ...normalizeFields(v, fields), rentPeriod: type === "SALE" ? null : v.rentPeriod };
    return { ...all, expectedVersion: listing?.version ?? property.version, ...(listing ? {} : { transactionType: type }) };
  }} submit={v => { listingFields.parse(Object.fromEntries(Object.entries(v).filter(([k]) => !["expectedVersion", "transactionType"].includes(k)))); return mutate(listing ? `listings/${listing.id}` : `properties/${property.id}/listings`, v, listing ? "PATCH" : "POST"); }} onDone={done} submitLabel={listing ? "Lưu điều kiện giao dịch" : "Tạo đợt mới"} />;
}
