# Đăng nhập bằng số điện thoại

Đăng nhập bằng **số điện thoại + mật khẩu**. Admin tạo tài khoản bằng họ tên, số điện thoại, vai trò và mật khẩu tạm. Không yêu cầu email, không gửi SMS, không có đăng ký công khai. Mật khẩu tạm dùng một lần, phải đổi ngay; reset/khóa/đổi số/đổi role thu hồi session như trước.

## Cài đặt và chuyển dữ liệu cũ

```powershell
npm run db:generate
npm run db:deploy
```

Migration `202609300001_phone_auth` thêm số điện thoại unique và giữ nguyên mọi user/password/role/permission/audit hiện có. Tài khoản cũ để số điện thoại NULL, không tự suy diễn số từ email. **Cần gán số thật trước khi người dùng đăng nhập lại**. Admin còn phiên đăng nhập có thể vào Tài khoản → Sửa / khóa để nhập số; đổi số thu hồi mọi phiên của tài khoản đó.

Nếu chưa thể đăng nhập admin, người vận hành có quyền database chạy CLI:

```powershell
npm run user:set-phone -- --list
npm run user:set-phone -- --id <USER_ID> --phone <SO_DIEN_THOAI>
```

CLI `--list` chỉ hiển thị ID/tên/role/status các tài khoản chưa có số; gán số không sửa mật khẩu hoặc cấp quyền. Lưu audit `PHONE_MIGRATION_CLI` với nguồn `database-operator-cli`; actorId là tài khoản đích để đáp ứng schema, không đại diện một session đăng nhập. Không mở endpoint public cho thao tác này. Không chạy khi chưa kiểm tra đúng DATABASE_URL.

Admin đầu tiên cho DB mới: điền `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PHONE`, `BOOTSTRAP_ADMIN_PASSWORD` trong môi trường rồi `npm run admin:bootstrap`. `BOOTSTRAP_ADMIN_EMAIL` không còn được dùng.

## Định dạng

- Số di động Việt Nam 10 chữ số: `0900000001`, `84900000001`, `+84900000001` hoặc `0084900000001` đều lưu `+84900000001`. Khoảng trắng, dấu chấm/gạch nối/ngoặc được bỏ trước validation.
- Số quốc tế dùng `+` và mã quốc gia, tổng 8–15 chữ số. Kiểm tra cấu trúc, không xác nhận số đang được nhà mạng cấp/thuộc sở hữu người nhập. Admin chịu trách nhiệm gán đúng người.
- Unique constraint ở PostgreSQL chặn số trùng sau chuẩn hóa, kể cả request đồng thời. Rate limit dùng số đã chuẩn hóa để không thể lách bằng cách viết khác.
- `User.phoneNumber` nullable chỉ để chuyển đổi tài khoản cũ; tạo tài khoản mới bắt buộc số hợp lệ. Admin có thể sửa số; member không tự đổi số/role.

## Dữ liệu mẫu local

Điền `DEMO_PASSWORD` rồi `npm run db:seed`. Seed nâng cấp các tài khoản demo đã có số NULL; không ghi đè số đã được admin sửa, không thay password của tài khoản hiện có.

| Tài khoản | Số demo |
|---|---|
| Admin | 0900000001 |
| Chỉnh sửa | 0900000002 |
| Xem riêng tư | 0900000003 |
| Cả hai quyền | 0900000004 |
| Chỉ đọc | 0900000005 |
| Đã khóa | 0900000006 |

Các số chỉ dùng làm dữ liệu minh họa trong DB local, không gọi/gửi SMS đến các số này.

## Chi tiết tích hợp

Dùng [Phone Number plugin của Better Auth](https://better-auth.com/docs/plugins/phone-number), endpoint `/api/auth/sign-in/phone-number`. Auth tra cứu trực tiếp `phoneNumber`; `/sign-in/email` bị đóng và emailAndPassword.enabled=false. Credential account vẫn do Better Auth xác minh password và cấp cookie/session trong DB. OTP/verify/signup/self-service phone update không được expose.

Better Auth core vẫn yêu cầu cột email: user mới nhận metadata không gửi được thư dạng `<user-id>@accounts.invalid`; user cũ giữ email để tránh mất dữ liệu. Trường này không dùng để đăng nhập, tạo thành viên hoặc hiển thị trong danh sách tài khoản/phân quyền. Chưa xóa cột vì làm vậy sẽ phá schema thư viện.

Kiểm tra: `npm run test`, `npm run test:integration`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build`. Integration/E2E chỉ chạy với `TEST_DATABASE_URL` riêng có tên `_test`, không dùng database ứng dụng.
