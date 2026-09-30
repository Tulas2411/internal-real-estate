import { z } from "zod";

/** Local Vietnamese mobile numbers and international numbers share one stored identity. */
export function normalizePhoneNumber(value: string) {
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (/^0[35789]\d{8}$/.test(phone)) phone = `+84${phone.slice(1)}`;
  else if (/^84[35789]\d{8}$/.test(phone)) phone = `+${phone}`;
  return phone;
}

export function isCanonicalPhoneNumber(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone) && (!phone.startsWith("+84") || /^\+84[35789]\d{8}$/.test(phone));
}

export const phoneNumberSchema = z.string()
  .max(40, "Số điện thoại quá dài.")
  .transform(normalizePhoneNumber)
  .refine(isCanonicalPhoneNumber, "Nhập số di động Việt Nam 10 chữ số hoặc số quốc tế có mã quốc gia (+…).");

export const phoneLoginSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(128, "Mật khẩu quá dài."),
  rememberMe: z.boolean().optional(),
}).strict();

// Better Auth core still requires a unique email column. This non-deliverable value
// is metadata only: it is never accepted as a login identifier or shown in the UI.
export const internalAuthEmail = (userId: string) => `${userId.toLowerCase()}@accounts.invalid`;
