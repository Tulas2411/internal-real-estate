export const labels: Record<string, string> = {
  APARTMENT: "Căn hộ", HOUSE: "Nhà ở", LAND: "Đất", ROOM: "Phòng trọ", OFFICE: "Văn phòng", RETAIL: "Mặt bằng", WAREHOUSE: "Kho xưởng", OTHER: "Khác",
  RENT: "Cho thuê", SALE: "Mua bán", AVAILABLE: "Đang chào", DEPOSITED: "Đã đặt cọc", RENTED: "Đã cho thuê", SOLD: "Đã bán", WITHDRAWN: "Đã rút",
  DRAFT: "Bản nháp", PUBLISHED: "Đang hiển thị", PAUSED: "Tạm ngưng", ARCHIVED: "Đã lưu trữ", FIXED: "Giá cố định", NEGOTIABLE: "Thương lượng", ON_REQUEST: "Liên hệ giá",
  MONTH: "tháng", YEAR: "năm", UNKNOWN: "Chưa xác minh", OWNER_PROVIDED: "Chủ nhà cung cấp", VERIFIED: "Đã xác minh", ADMIN: "Quản trị viên", MEMBER: "Thành viên", ACTIVE: "Hoạt động", LOCKED: "Đã khóa", NONE: "Không có", AMOUNT: "Số tiền", RATE: "Tỷ lệ (%)",
  CREATE: "Tạo mới", UPDATE: "Cập nhật", STATUS: "Đổi trạng thái", CORRECTION: "Sửa sai trạng thái", CONFIRM: "Xác nhận tình trạng", PERMISSION: "Đổi phân quyền", ASSIGN: "Giao phụ trách", VISIBILITY: "Đổi hiển thị", ARCHIVE: "Lưu trữ", RESTORE: "Khôi phục", OWNER_UPDATE: "Cập nhật chủ nhà", COMMISSION: "Cập nhật hoa hồng", FILE_UPLOAD: "Tải tệp lên", FILE_DELETE: "Xóa tệp", GALLERY: "Sắp xếp ảnh", OTHER_LISTING_ACK: "Xem xét đợt còn lại", USER_CREATE: "Tạo tài khoản", USER_UPDATE: "Sửa tài khoản", PASSWORD_RESET: "Cấp lại mật khẩu", PASSWORD_CHANGE: "Đổi mật khẩu",
};
export const label = (value: string) => labels[value] ?? value;
export const date = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "Chưa xác nhận";
export const money = (value?: string | null) => value ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value))} ₫` : "Liên hệ giá";
