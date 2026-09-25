import type { ListingStatus, TransactionType } from "@prisma/client";
import { fail } from "./errors";
export const activeStatuses: ListingStatus[] = ["AVAILABLE", "DEPOSITED"];
export function isStale(status: ListingStatus, confirmedAt: Date | null, now = new Date()) {
  return activeStatuses.includes(status) && (!confirmedAt || confirmedAt.getTime() <= now.getTime() - 14 * 86400000);
}
export function validateTransition(type: TransactionType, from: ListingStatus, to: ListingStatus, reason: string, correction = false) {
  if ((type === "RENT" && to === "SOLD") || (type === "SALE" && to === "RENTED") || from === to) fail(400, "INVALID_TRANSITION", "Trạng thái không phù hợp loại giao dịch.");
  if (correction) {
    if (activeStatuses.includes(from) || !reason.trim()) fail(400, "INVALID_CORRECTION", "Chỉ sửa sai đợt đã kết thúc, phải có lý do.");
    return;
  }
  if (!activeStatuses.includes(from)) fail(400, "CYCLE_CLOSED", "Đợt đã kết thúc. Hãy tạo đợt mới hoặc nhờ quản trị viên sửa sai.");
  if ((to === "WITHDRAWN" || (from === "DEPOSITED" && to === "AVAILABLE")) && !reason.trim()) fail(400, "REASON_REQUIRED", "Vui lòng nhập lý do.");
}
