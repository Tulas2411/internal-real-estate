# Sao lưu và khôi phục

Database backup **không chứa ảnh/giấy tờ S3**. Phải sao lưu cả hai, mã hóa backup, quyền đọc giới hạn và có bản ngoài máy chủ. Đề xuất DB hằng ngày (giữ 14 ngày), weekly 8 tuần; S3 versioning + backup hằng ngày cùng thời điểm. Tần suất/RPO cần chủ hệ thống chốt theo vận hành. Repo chưa cài scheduler backup thực tế.

## Backup local mẫu

Chạy `powershell -File scripts/backup-local.ps1`. Script chỉ backup các container của Compose này vào `backups/<UTC timestamp>/`, không xóa backup cũ. Dừng ghi/upload trong khoảng backup để DB và volume cùng mốc logic. Thư mục backups đã gitignore. Không mang credentials/data production vào repo.

Production dùng `pg_dump -Fc` qua libpq env/service file (không truyền password vào command line), S3 bucket versioning hoặc `aws s3 sync` đến bucket backup riêng không có quyền public, không dùng `--delete`. Kiểm tra exit code, checksum và log task; tự động hóa bằng scheduler ngoài app. Mã hóa nơi lưu và giữ encryption key tách khỏi backup.

## Diễn tập restore (môi trường riêng)

1. Tạo PostgreSQL trống có tên khác, credentials khác, network cô lập; giữ nguyên database và bucket nguồn. Không chạy lệnh reset/clean trên production.
2. Với dump local, copy dump vào PostgreSQL đích bằng `docker cp`, rồi `pg_restore --no-owner --no-privileges --exit-on-error -d <DB_TRONG_RIENG> <DUMP>`. Database phải mới tạo. Script backup không có bước restore tự động.
3. Tạo S3 bucket test riêng. Nếu backup từ S3 sync, copy objects giữ nguyên keys vào bucket đích. Với SeaweedFS volume tar local, khởi tạo **volume mới** rồi giải nén tar vào volume mới khi container đích dừng, dùng cùng phiên bản 4.40; không giải nén vào volume nguồn. Không chạy hai container cùng ghi một volume.
4. Đặt app thử nghiệm trỏ DB/bucket đích; xóa/thu hồi session ở bản phục hồi bằng quyền vận hành, giữ audit/history. Không kết nối email/dịch vụ thật.
5. So sánh counts property/listing/images/documents, kiểm tra objectKeys tồn tại, hash/bytes và gallery/document download bằng tài khoản đủ quyền, kiểm tra tài khoản không quyền bị chặn. Diễn tập đăng nhập, tìm tin, edit/version conflict, archive/restore. Ghi thời gian và kết quả, định kỳ ít nhất mỗi quý.

Không coi “backup thành công” chỉ vì tạo được file: cần `pg_restore --list`, checksum, thử phục hồi thật và kiểm tra S3 riêng. Nếu giữa DB và S3 lệch mốc, giữ bản object dư và đối chiếu; không chạy cleanup trước khi hoàn tất kiểm tra tham chiếu.
