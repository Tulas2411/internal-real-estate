# Triển khai production (hướng dẫn, chưa triển khai)

## Mô hình

Một Node server Next.js phía sau Nginx/Caddy HTTPS; PostgreSQL và S3 private riêng. Compose trong repo **chỉ dành cho local**, không đưa credentials demo hoặc SeaweedFS console/filer ra Internet. Dùng Node LTS tương thích (khuyến nghị Node 22.13+). Người vận hành cung cấp domain, TLS, database URL, bucket/credentials, auth secret ngẫu nhiên và nơi nhận log.

## Quy trình

1. Tạo PostgreSQL/database/user riêng, S3 bucket private. Cấp key ứng dụng chỉ truy cập bucket cần dùng; tách key backup, bật encryption/versioning/retention theo nhà cung cấp.
2. Đặt `NODE_ENV=production`, `APP_URL=https://ten-mien`, `BETTER_AUTH_SECRET` ngẫu nhiên ít nhất 32 byte, `DATABASE_URL`, các biến `S3_*` đúng `.env.example`. Không commit file env; không dùng default demo. `APP_URL` phải đúng origin, không có dấu `/` cuối. Cấu hình S3_FORCE_PATH_STYLE theo nhà cung cấp.
3. `npm ci`, `npm run db:generate`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` trong môi trường build. Chạy integration/E2E trên staging riêng.
4. Backup DB và object storage. Chạy `npm run db:deploy` với env production từ job release được kiểm soát. Không dùng `migrate dev`/`db push`/demo seed trong production.
5. Lần đầu điền ba biến `BOOTSTRAP_ADMIN_*`, chạy `npm run admin:bootstrap`, đăng nhập/đổi mật khẩu rồi xóa các giá trị bootstrap khỏi môi trường. CLI không ghi password ra log.
6. Chạy `npm run start -- --hostname 127.0.0.1 --port 3000` dưới systemd/PM2 hoặc Node container không root. Reverse proxy terminate HTTPS, giới hạn body 21 MB, timeout upload phù hợp, không cache `/api/*` hoặc trang đăng nhập/nội bộ; không log body/Cookie/Authorization.
7. Probe `GET /api/health` chỉ trả trạng thái DB (không lộ cấu hình). Giám sát S3 riêng bằng kiểm tra object synthetic với credentials vận hành, không dùng hồ sơ thật.

## Rate limit và proxy

Rate limit login theo email đã hash (8/phút) và cơ chế Better Auth (5/phút), mutations theo user (60/phút), password 5/phút, tạo/reset tài khoản 10/phút. Counters nằm trong PostgreSQL nên dùng chung giữa process. Tại reverse proxy thêm rate limit IP và giới hạn kết nối/body; chỉ trust forwarding headers do proxy ghi đè, không tin X-Forwarded-For từ Internet. Không bật cookieCache. Backend đọc user/permission hiện tại mỗi request; nội dung tải về trước khi bị thu hồi không thể bị xóa khỏi thiết bị người dùng.

## Worker dọn storage

Định kỳ 5 phút chạy `npm run storage:cleanup` từ thư mục release với cùng env (cron/systemd timer/Windows Task Scheduler). Ví dụ cron: `*/5 * * * * cd /srv/estate && /usr/bin/npm run storage:cleanup`. Script idempotent, tối đa 100 task/lần, bỏ qua key đang được tham chiếu; thất bại retry từ 1 phút đến 24 giờ. Theo dõi số task/attempt và cảnh báo backlog. Chạy lại thủ công bằng cùng lệnh. Repo cung cấp worker, **chưa cài lịch chạy trên máy chủ**.

## Log, backup và rollback

App chỉ log mã lỗi chung/loại lỗi, audit business trong DB. Không xuất request payload/secret/file bytes/signed URLs. Hạn chế quyền đọc backup và audit. Xem BACKUP_RESTORE.md.

Giữ artifact release cũ và migration history. Rollback app về artifact trước chỉ nếu schema tương thích. Migration SQL không có down tự động; nếu cần thay đổi phá hủy hãy dùng migration forward sửa lỗi hoặc phục hồi backup vào môi trường riêng, kiểm tra rồi mới chuyển traffic. Không tự restore đè production. Sau release kiểm tra login, quyền member, upload/download, DB và storage private qua tài khoản kiểm thử staging.
