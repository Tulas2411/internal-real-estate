import { describe, expect, it } from "vitest";
import { phoneNumberSchema, phoneLoginSchema } from "../../src/lib/phone";
import { userCreate, userUpdate } from "../../src/lib/validation";

describe("Định danh số điện thoại", () => {
  it.each(["0900000001", "+84900000001", "84900000001", "0084900000001", " 090 000 0001 ", "+84 (90) 000-0001"])("chuẩn hóa %s thành cùng một định danh", value => {
    expect(phoneNumberSchema.parse(value)).toBe("+84900000001");
  });
  it.each(["", "admin@example.com", "12345", "090000000", "+840900000001", "0900000001abc", "+1234567890123456", "++84900000001", 900000001, null])("từ chối số không hợp lệ %s", value => {
    expect(phoneNumberSchema.safeParse(value).success).toBe(false);
  });
  it("hỗ trợ số quốc tế có dấu +", () => expect(phoneNumberSchema.parse("+1 202 555 0123")).toBe("+12025550123"));
  it("tạo thành viên không cần email và chặn email/verified từ client", () => {
    const input = { name: "Thành viên", phoneNumber: "0900000001", role: "MEMBER", temporaryPassword: "Temporary-test-123" };
    expect(userCreate.parse(input).phoneNumber).toBe("+84900000001");
    expect(userCreate.safeParse({ ...input, email: "injected@example.test" }).success).toBe(false);
    expect(userCreate.safeParse({ ...input, phoneNumberVerified: true }).success).toBe(false);
    expect(userCreate.safeParse({ name: input.name, email: "old@example.test", role: input.role, temporaryPassword: input.temporaryPassword }).success).toBe(false);
  });
  it("đăng nhập chỉ nhận số điện thoại và mật khẩu", () => {
    expect(phoneLoginSchema.parse({ phoneNumber: "0900000001", password: "password" }).phoneNumber).toBe("+84900000001");
    expect(phoneLoginSchema.safeParse({ email: "old@example.test", password: "password" }).success).toBe(false);
    expect(phoneLoginSchema.safeParse({ phoneNumber: "0900000001", password: "" }).success).toBe(false);
  });
  it("đổi số điện thoại chuẩn hóa và vẫn yêu cầu version", () => {
    const input = { name: "Thành viên", role: "MEMBER", status: "ACTIVE", phoneNumber: "0900000001", expectedVersion: 1 };
    expect(userUpdate.parse(input).phoneNumber).toBe("+84900000001");
    expect(userUpdate.safeParse({ ...input, expectedVersion: undefined }).success).toBe(false);
  });
});
