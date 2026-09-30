# Trạng thái triển khai

Đang triển khai và kiểm thử; chưa tuyên bố nghiệm thu hoàn tất.

Đã có: Prisma schema + 2 migrations áp dụng thành công vào PostgreSQL 17 local; auth Better Auth với session DB, password tạm; policy + service + API property/listing/permission/user/file/audit; UI tiếng Việt responsive; seed/bootstrap/cleanup; unit/integration/E2E specs.

Typecheck đã đạt sau khi cập nhật Next route types. Đang chạy unit, integration và chuẩn bị E2E/build. Docker PostgreSQL chạy; SeaweedFS 4.40 đang tải (thay MinIO do registry không tải được).

Cần tiếp tục: kết quả test và sửa lỗi, kiểm tra S3 private thực tế, E2E Chromium, format code, tài liệu README/decisions/deploy/backup. npm audit phát hiện dependency tooling; đang chọn bản vá tương thích, không dùng npm audit fix --force.
