# MASTER PROMPT — XÂY DỰNG WEB QUẢN LÝ BẤT ĐỘNG SẢN NỘI BỘ

Bạn là senior full-stack engineer. Hãy trực tiếp triển khai ứng dụng hoàn chỉnh trong repository hiện tại theo đặc tả dưới đây. Chủ dự án đã tạo bộ khung Next.js và đưa lên Git. Hãy kiểm tra thực tế trước khi sửa; không giả định code, dependencies hoặc database đã tồn tại.

## 1. Cách làm việc và kết quả yêu cầu

- Đọc AGENTS.md và hướng dẫn repository nếu có. Kiểm tra git status, nhánh, package.json, lockfile, cấu trúc src, cấu hình và phiên bản Node/framework.
- Giữ nguyên thay đổi có sẵn của người dùng. Không tạo lại ứng dụng, không xóa repository, không reset/force push, không thay stack tùy tiện.
- Lập kế hoạch ngắn rồi thực hiện đến khi hoàn thành; không dừng ở đề xuất, schema, giao diện giả hoặc một vài màn hình.
- Những quyết định nghiệp vụ dưới đây đã được chấp thuận. Không hỏi lại. Với chi tiết nhỏ còn thiếu, chọn phương án đơn giản, nhất quán và ghi trong docs/DECISIONS.md.
- Kiểm tra tài liệu chính thức tương ứng phiên bản đang dùng khi tích hợp thư viện; không trộn cách cấu hình Prisma, Next.js hoặc auth của các phiên bản khác nhau. Giữ lockfile và dùng npm nếu repo đang dùng npm.
- Không cần tự ý nâng major version của bộ khung. Chọn dependencies tương thích, bản ổn định; tránh thư viện thử nghiệm nếu không cần thiết.
- Nếu thiếu thông tin dịch vụ thật, vẫn hoàn thành bằng PostgreSQL và S3-compatible storage chạy local qua Docker Compose. Chỉ dùng credentials giả dành riêng local. Ghi rõ cấu hình production còn thiếu, không bịa rằng đã triển khai.
- Không tự mua dịch vụ, triển khai public, merge vào main hoặc push remote. Có thể tạo nhánh feat/property-management nếu đang ở main và phù hợp trạng thái repo; giữ nhánh làm việc hiện có nếu đã có. Cuối cùng cung cấp lệnh commit/push cho người dùng.
- Không đưa mật khẩu, secret, giấy tờ, dữ liệu thật hoặc ảnh upload vào Git. Không in secret ra log.
- Cập nhật tiến độ ngắn theo các mốc; nếu bị giới hạn ngữ cảnh, lưu docs/IMPLEMENTATION_STATUS.md với phần hoàn thành, phần còn thiếu, lỗi và bước tiếp theo để tiếp tục.

## 2. Mục tiêu và phạm vi

Web tiếng Việt dùng nội bộ cho khoảng 30 người môi giới cho thuê/mua bán bất động sản. Dùng trên máy tính và điện thoại, có thể truy cập Internet qua HTTPS khi triển khai, mọi dữ liệu đều yêu cầu đăng nhập.

Mục tiêu: tìm bất động sản nhanh, thông tin chính xác, nhiều ảnh, kiểm soát quyền sửa từng hồ sơ, bảo vệ thông tin chủ nhà và giấy tờ, biết ai thay đổi gì.

Triển khai một ứng dụng chứa frontend/backend, một PostgreSQL và object storage riêng tư. Không microservices, không multi-tenant, không Kubernetes.

Ngoài phạm vi phiên bản này: CRM khách hàng, lịch dẫn khách, hợp đồng điện tử, quản lý tiền thực tế, chia/thanh toán hoa hồng, xuất Excel, trang đăng tin công khai, marketplace, chat, bản đồ trả phí, AI gợi ý. Vẫn lưu được hoa hồng dự kiến và điều kiện giao dịch dưới dạng dữ liệu nội bộ.

## 3. Stack đã chốt

- Next.js App Router, React, TypeScript strict, Node.js runtime cho API cần database/storage/auth.
- PostgreSQL + Prisma; migrations có version và được commit.
- Tailwind CSS + shadcn/ui; React Hook Form + Zod cho form. Validation phía server là bắt buộc.
- Auth dùng thư viện ổn định tương thích stack, hỗ trợ email/password và database-backed session có khả năng thu hồi. Ưu tiên thư viện có chức năng cần thiết; không tự viết crypto hoặc dùng fake JWT/token.
- Cookie session HttpOnly, Secure ở production, SameSite phù hợp; chống CSRF theo cơ chế thư viện và kiểm tra origin cho mutation nếu cần. Không lưu bearer token ở localStorage.
- S3-compatible object storage private. Local có Docker Compose cho PostgreSQL và storage cùng quy trình tạo bucket tự động; production cấu hình bằng env.
- Chọn công cụ kiểm thử phù hợp: Vitest cho nghiệp vụ/integration và Playwright cho hành trình quan trọng; giữ công cụ tương đương nếu repo đã có.
- API Route Handlers gọi service dùng chung; Server Components nếu truy vấn trực tiếp cũng bắt buộc qua cùng kiểm tra quyền. Không chỉ bảo vệ ở middleware/proxy hoặc giao diện.

## 4. Vai trò và quyền

Hai vai trò ADMIN và MEMBER. Không có đăng ký công khai. ADMIN tạo tài khoản, cấp mật khẩu tạm dùng một lần và bắt buộc đổi khi đăng nhập đầu tiên; không phụ thuộc email service trong bản đầu. Luồng này cần thực sự hoạt động. Không có endpoint public cho phép tự tạo tài khoản hoặc tự chọn role.

Mỗi cặp user/property có hai quyền độc lập: canEdit và canViewSensitive. Unique(propertyId, userId). Chỉ ADMIN cấp/thu hồi. canEdit không suy ra canViewSensitive, và ngược lại. ADMIN có toàn quyền theo role, không phải tạo permission cho mỗi property.

| Thao tác | ADMIN | MEMBER |
|---|---|---|
| Xem kho và chi tiết thông thường của hồ sơ đang hiển thị/tạm ngưng | Tất cả | Tất cả |
| Xem bản nháp | Tất cả | Chỉ hồ sơ được canEdit |
| Tạo property và đợt giao dịch mới | Có | Không |
| Sửa thông tin thông thường, ảnh, giá, trạng thái giao dịch | Tất cả | canEdit trên property |
| Xem chủ nhà, số liên hệ, giấy tờ, hoa hồng, ghi chú nhạy cảm | Tất cả | canViewSensitive |
| Sửa thông tin nhạy cảm, upload/xóa giấy tờ | Tất cả | Đồng thời canEdit và canViewSensitive |
| Chuyển nháp/hiển thị/tạm ngưng | Có | Không |
| Lưu trữ/khôi phục hồ sơ | Có | Không |
| Cấp quyền, quản lý tài khoản | Có | Không |
| Xem lịch sử hồ sơ | Tất cả | canEdit; che phần nhạy cảm nếu thiếu canViewSensitive |
| Xem hồ sơ đã lưu trữ và nhật ký toàn hệ thống | Có | Không |

MEMBER chỉ xem nhãn/tóm tắt pháp lý không nhạy cảm; file giấy tờ, số giấy tờ, chi tiết chủ sở hữu không trả về khi thiếu quyền. Ghi chú dẫn khách thông thường tách khỏi ghi chú nhạy cảm.

Quy tắc bắt buộc:
- Tài khoản bị khóa không được đọc/ghi; thu hồi tất cả session ngay. Reset mật khẩu hoặc đổi role cần xử lý thu hồi session phù hợp.
- Thu hồi quyền có hiệu lực ở request tiếp theo; không tin quyền cũ trong client hoặc session claim đã lỗi thời.
- Không cho khóa/hạ quyền quản trị viên hoạt động cuối cùng, kể cả các request đồng thời.
- MEMBER không đổi role, permissions, người tạo, mã hệ thống, visibility hoặc ownership bằng cách gửi thêm field vào payload; dùng whitelist DTO.
- Kiểm tra quyền theo property sở hữu thực tế khi truy cập listing/image/document/history; không tin propertyId người dùng tự khai.
- Unauthorized fields phải vắng khỏi response, server-rendered payload, search snippets, audit diff, dashboard và log; không chỉ CSS-hide.
- Quyền xem nhạy cảm không cấp quyền sửa hoặc xem bản nháp nếu không có canEdit.
- Không cache response nhạy cảm dùng chung giữa người dùng; private pages/API phải cấu hình cache đúng.

## 5. Mô hình dữ liệu

Thiết kế schema có quan hệ, foreign keys, indexes và constraints phù hợp. Tên bảng có thể điều chỉnh nhưng giữ đủ ý nghĩa.

### User và auth
User: id, name, email normalized unique, role, status ACTIVE/LOCKED, mustChangePassword, timestamps; auth account/session/reset data theo thư viện. Không lưu mật khẩu plaintext. Admin đầu tiên tạo bằng bootstrap CLI với secret/env đầu vào, không endpoint public, không mật khẩu mặc định trong production.

### Property — tài sản vật lý
- id, mã tự sinh duy nhất an toàn khi concurrent, title.
- propertyType: APARTMENT, HOUSE, LAND, ROOM, OFFICE, RETAIL, WAREHOUSE, OTHER; label tiếng Việt.
- provinceCity, wardCommune, addressLine, projectBuilding, mapUrl tùy chọn. Không bắt buộc cấp quận/huyện hay hardcode danh mục hành chính lỗi thời; MVP cho nhập địa chỉ linh hoạt.
- landArea, usableArea, bedrooms, bathrooms, floorNumber, totalFloors, frontage, accessRoadWidth, houseDirection, balconyDirection.
- furnishing, amenities, description, highlights, viewingNotes thông thường.
- legalSummary/loại giấy tờ ở mức thông thường; trạng thái UNKNOWN, OWNER_PROVIDED, VERIFIED; ngày/người xác minh, ghi chú xác minh. Chi tiết hoặc bằng chứng có dữ liệu cá nhân thuộc phần sensitive.
- visibility DRAFT/PUBLISHED/PAUSED/ARCHIVED; createdBy, responsibleUserId, createdAt, updatedAt, archivedAt, version cho optimistic locking.
- Người phụ trách do ADMIN gán; không tự động cấp quyền từ responsibleUserId.
- Ngày kiểm tra còn hàng nằm ở listing vì bán và thuê có thể khác nhau; dashboard property có thể tổng hợp, không đánh đồng updatedAt với ngày xác nhận thực tế.

### Listing — một đợt chào giao dịch
- id, propertyId, transactionType RENT/SALE, cycleNumber, status, timestamps, version, lastConfirmedAt, lastConfirmedBy.
- Một property có thể có đồng thời một đợt RENT chưa hoàn tất và một đợt SALE chưa hoàn tất. Có nhiều đợt lịch sử. Chặn duplicate active cycle bằng database constraint/transaction phù hợp, không chỉ kiểm tra trước insert.
- RENT: AVAILABLE, DEPOSITED, RENTED, WITHDRAWN.
- SALE: AVAILABLE, DEPOSITED, SOLD, WITHDRAWN.
- RENTED/SOLD/WITHDRAWN là kết thúc đợt; đợt mới do ADMIN tạo, không ghi đè lịch sử cũ.
- priceMode FIXED/NEGOTIABLE/ON_REQUEST. FIXED cần amount > 0. NEGOTIABLE có thể có amount > 0 hoặc để trống; ON_REQUEST để amount null. Không dùng 0 để biểu diễn chưa có giá.
- currency VND, amount Decimal; RENT có rentPeriod MONTH/YEAR; không trộn đơn vị khi lọc. Lọc giá thuê mặc định theo giá quy đổi tháng và hiển thị rõ giá gốc, hoặc yêu cầu chọn kỳ giá nhất quán; ghi quyết định vào docs.
- SALE có pricePerSquareMeter tính từ diện tích được chọn rõ ràng, không chia khi thiếu/0 diện tích.
- RENT: requiredDepositAmount, paymentCycle, minLeaseMonths, managementFee, electricityNote, waterNote, parkingFee, availableFrom, usageConditions.
- SALE: negotiable/paymentTerms nếu không trùng priceMode, taxFeeResponsibilityNote, expectedHandoverDate, transactionNotes.
- expectedCommissionAmount/Rate, commissionNote là sensitive; kiểu hoa hồng rõ ràng, không âm, rate trong giới hạn hợp lệ.
- requiredDepositAmount chỉ là điều kiện; không tự chuyển sang DEPOSITED. Ứng dụng không xử lý thanh toán hoặc ghi nhận kế toán.

### Bảng liên quan
- PropertyPermission: propertyId, userId, canEdit, canViewSensitive, grantedBy, timestamps.
- OwnerContact: quan hệ riêng theo property để tránh sửa một contact làm ảnh hưởng hồ sơ ngoài quyền; name, phone, zalo, source, sensitiveNotes. Không xây danh bạ dùng chung trong MVP.
- PropertyImage: private objectKey, mime, bytes, width/height nếu có, caption, sortOrder, cover indicator, uploader. Cover tối đa một ảnh mỗi property, cover phải thuộc property đó.
- PropertyDocument: private objectKey, originalName được làm sạch, documentType, mime, bytes, uploader; luôn sensitive.
- StatusHistory: listingId, fromStatus, toStatus, reason, actorId, timestamp; append-only.
- AuditLog: actor, action, entity, timestamp, diff có cấu trúc và phân loại trường nhạy cảm; không chứa passwords, token, secret hoặc bytes file. API che diff theo quyền.
- Các quan hệ người dùng giữ lịch sử khi tài khoản khóa; không cascade xóa audit.

Thời gian lưu UTC, giao diện Asia/Ho_Chi_Minh; giá dùng Decimal chính xác, serialize an toàn; số đếm nguyên không âm; diện tích nếu có phải > 0. Với ngày chỉ có ý nghĩa ngày lịch, tránh dịch ngày do timezone.

## 6. Quy tắc vòng đời

- Tạo property mặc định DRAFT, ADMIN tạo ít nhất một listing trước khi publish.
- Nháp cho phép thiếu thông tin; publish yêu cầu title, type, vị trí cơ bản, ít nhất một ảnh và một listing hợp lệ có kiểu giá rõ ràng. Không bắt buộc biết mọi thông tin pháp lý mới lưu được.
- RENT: AVAILABLE → DEPOSITED → RENTED; cho phép AVAILABLE → RENTED nếu giao dịch không qua cọc.
- SALE: AVAILABLE → DEPOSITED → SOLD; cho phép AVAILABLE → SOLD.
- DEPOSITED → AVAILABLE khi hủy cọc, bắt buộc reason.
- AVAILABLE/DEPOSITED → WITHDRAWN khi dừng đợt chào, bắt buộc reason; khác với PAUSED chỉ tạm ẩn/tạm ngưng toàn hồ sơ.
- Khi hết thuê, ADMIN mở cycle RENT mới AVAILABLE; giữ nguyên cycle RENTED cũ. Mở lại đợt đã kết thúc cũng tạo cycle mới, không lùi trạng thái để xóa lịch sử.
- Cho phép ADMIN sửa sai trạng thái kết thúc qua hành động correction riêng có lý do và audit, không tạo active cycle trùng. UI phân biệt correction với mở đợt mới.
- MEMBER có canEdit được chuyển trạng thái giao dịch hợp lệ của đợt hiện tại; không tạo cycle mới hoặc đổi transactionType.
- Khi SOLD/RENTED mà loại giao dịch kia vẫn còn mở, trả warning và mở modal yêu cầu xem xét tin còn lại. Cho chọn giữ với lý do hoặc rút tin còn lại nếu có quyền; backend cũng enforce acknowledgement để gọi API trực tiếp không bỏ qua. Không tự đóng âm thầm.
- Mọi đổi trạng thái và history/audit ghi cùng transaction; lỗi thì rollback toàn bộ. State transition được xác thực từ trạng thái hiện tại trong DB, không tin fromStatus từ client.
- Archived chỉ ADMIN thấy và khôi phục. Khôi phục về PAUSED để kiểm tra trước publish; giữ nguyên listing/history, không reset giao dịch.
- Không có hard delete hồ sơ trong UI bản đầu.
- Nút “Đã xác nhận tình trạng” cho ADMIN/canEdit cập nhật listing.lastConfirmedAt/By, có audit. Không cho client tự backdate.
- Đánh dấu “Cần kiểm tra lại” cho đợt AVAILABLE/DEPOSITED không được xác nhận 14 ngày, hoặc chưa bao giờ xác nhận; có bộ lọc riêng.

## 7. Chức năng và màn hình

### Đăng nhập và tài khoản
Email/password, logout, đổi mật khẩu, bắt buộc thay mật khẩu tạm, thông báo lỗi không tiết lộ tài khoản tồn tại. Rate limit đăng nhập/reset/mutation nhạy cảm có cách chạy production được mô tả. ADMIN tạo/khóa/mở tài khoản, đổi role, reset mật khẩu tạm qua thao tác rõ ràng. Không gửi email thật tự động.

### Tổng quan
Số tin cho thuê/mua bán theo trạng thái, số cần kiểm tra lại, hồ sơ được giao, hoạt động gần đây trong quyền. Dùng dữ liệu DB thật, click vào số liệu dẫn đến bộ lọc tương ứng. Không lộ chỉ số của hồ sơ không được phép xem.

### Danh sách
Hai mục Cho thuê/Mua bán rõ ràng. Mỗi hàng/thẻ đại diện một listing và liên kết property; lịch sử đợt nằm ở chi tiết, mặc định liệt kê đợt mới nhất phù hợp, tránh trùng khó hiểu. Có bộ lọc đợt cũ nếu cần cho ADMIN, không lẫn vào kho hiện hành.

Tìm theo mã/title/địa chỉ/dự án; lọc type, khu vực, khoảng giá, diện tích, bedrooms, status, người phụ trách, “Tôi được giao”, cần kiểm tra lại. Không tìm trên phone hoặc field sensitive rồi vô tình lộ kết quả cho người không có quyền.

Server-side pagination, sorting whitelist, page size giới hạn, debounce tìm kiếm, filter sync URL, reset filter. Dạng bảng desktop, thẻ mobile; ảnh bìa, mã, tiêu đề, khu vực, diện tích, giá kèm đơn vị, trạng thái, lần xác nhận, người phụ trách. Không tải toàn bộ kho về browser để lọc.

### Chi tiết
Gallery nhiều ảnh với ảnh bìa, thumbnail và phóng to; thông tin tổng quan; tabs bán/thuê khi cùng tồn tại; giá/điều kiện; đặc điểm; mô tả; pháp lý thông thường; section sensitive theo quyền; lịch sử giao dịch và chỉnh sửa theo quyền.

Nút sửa/đổi trạng thái/xác nhận tình trạng hiện theo quyền. Không có quyền thì chỉ đọc. Có bảng cấp quyền cho ADMIN tại chi tiết: chọn user, bật canEdit/canViewSensitive độc lập, lưu/thu hồi; hiển thị người phụ trách riêng.

### Thêm/sửa
Form theo nhóm, field theo loại bất động sản và giao dịch; lưu nháp; kiểm tra server/client thống nhất; giữ nội dung khi lỗi, cảnh báo rời trang khi chưa lưu. Ảnh upload nhiều, preview, progress, đổi thứ tự, chọn cover, xác nhận xóa.

Đổi loại hình không tự xóa dữ liệu đã nhập mà không thông báo; nếu field không còn phù hợp, chuẩn hóa và giải thích trước lưu.

### Quản trị
Danh sách tài khoản, tạo/sửa/khóa/reset; danh sách phân quyền; danh sách archived/restore; audit toàn hệ thống có lọc actor/time/entity/action. Không tạo CMS quản lý mọi enum/settings ngoài phạm vi.

### Yêu cầu UX chung
Toàn bộ nhãn và lỗi tiếng Việt dễ hiểu; tên code tiếng Anh. Thiết kế sáng, gọn, màu trạng thái nhất quán; không dùng hình stock ngẫu nhiên thay dữ liệu thật. Có loading, empty, forbidden, not found, upload error, retry, modal xác nhận, toast. Điều hướng bàn phím, label/aria, focus modal, độ tương phản phù hợp. Hỗ trợ khoảng 360px và desktop, bảng không phá layout. Không nút giả hoặc đường dẫn chết.

## 8. Upload và bảo vệ dữ liệu

- Private bucket cho cả ảnh và giấy tờ; database lưu objectKey, không lưu URL public hoặc signed URL lâu dài.
- Ảnh chỉ JPEG/PNG/WebP; tối đa 20 ảnh/property, 10 MB/file. Tài liệu PDF/JPEG/PNG/WebP; tối đa 10 file/property, 20 MB/file. Có validation count trong điều kiện concurrent.
- Xác minh loại tệp phía server qua nội dung thực tế, không chỉ extension/MIME do browser báo. Không nhận SVG/HTML/script/executable. Không tin tên file để xây objectKey.
- ObjectKey random do server sinh, gắn với property và upload intent. Authorize khi upload, finalize, download, reorder, set cover, delete. Chặn attach file của property khác hoặc tự truyền objectKey tùy ý.
- Nếu upload trực tiếp bằng signed URL, có bước finalize kiểm tra object metadata/nội dung và quyền hiện tại trước tạo record. Dọn upload dang dở bằng cơ chế an toàn có grace period.
- Truy cập ảnh/tài liệu qua endpoint kiểm tra quyền; với tài liệu sensitive ưu tiên streaming/proxy để chặn request mới ngay sau thu hồi quyền. Nếu dùng signed URL ngắn hạn, giới hạn tối đa 60 giây và mô tả rõ URL đã cấp còn sống đến hết hạn. Không thể thu hồi bản đã tải xuống, không tuyên bố ngược lại.
- File riêng tư không đặt trong public/. Tài liệu có Content-Disposition phù hợp, nosniff, cache private/no-store. Không log signed URLs.
- Xóa ảnh phải cập nhật cover/order nhất quán. DB và object storage không có chung transaction: thiết kế cleanup có retry để không mất file hợp lệ hoặc treo record; không tuyên bố atomic giữa hai hệ thống.
- Mô tả dạng plain text ở MVP; nếu render rich text phải sanitize. Link bản đồ chỉ http/https, không tự fetch URL tùy ý từ server.

## 9. API, concurrency và tổ chức code

- Tách schema validation, policy/authorization, service nghiệp vụ, database access và UI; không nhét toàn bộ logic vào page hoặc route dài.
- Error format nhất quán với code/message/fieldErrors, HTTP 400/401/403/404/409 phù hợp; 500 không lộ stack/SQL/secrets. Pagination trả metadata rõ ràng.
- Mỗi mutation dùng expectedVersion hoặc cơ chế optimistic locking tương đương. Update với WHERE id + version và tăng version; không chỉ so sánh timestamp rồi update tách rời.
- Hai người sửa cùng bản: người sau nhận 409 cùng hướng dẫn reload/so sánh; không âm thầm ghi đè. UI giữ bản nhập chưa lưu để người dùng có thể xử lý.
- Áp dụng concurrency cho property, listing status và gallery ordering nơi có nguy cơ lost update. Sensitive update phải kiểm tra cả hai quyền trong cùng đường xử lý.
- Unique active cycle, unique email, code generation, status/history và bảo vệ admin cuối cùng phải xử lý an toàn khi cạnh tranh.
- Không nhận raw Prisma query hoặc sort field bất kỳ từ client. Tránh N+1, tạo index trên type/status/propertyId, permissions, khu vực, responsibleUser, timestamps theo query thật.
- Audit ghi old/new giá trị đã chuẩn hóa cho trường nghiệp vụ, actor lấy từ session server; ghi create/update/status/permission/archive/restore/user lock/reset và file actions. Không cho UI sửa/xóa audit. Sensitive diff bị redact theo người xem.

## 10. Local development, seed và vận hành

Cung cấp Docker Compose PostgreSQL + private object storage với persistent volumes và health checks, phiên bản image rõ ràng. App có thể chạy npm run dev trên host Windows; ghi cả CMD/PowerShell phù hợp và các lệnh Docker cần thiết. Không bắt người dùng phải có dịch vụ cloud để chạy local.

.env.example gồm toàn bộ biến cần thiết với placeholder: DATABASE_URL, auth secret/origin, S3 endpoint/region/bucket/access keys/path-style nếu cần, app URL, bootstrap admin input. Thực tế tên biến theo implementation; không để docs khác code. Local secrets là giá trị giả, production phải thay.

Scripts/documentation tối thiểu:
- install qua npm ci; dev, build, start, lint, typecheck, test và test:e2e.
- prisma generate, migration dev/deploy, seed với tên script rõ ràng.
- Bootstrap admin riêng an toàn, không mở đăng ký public.
- Demo seed idempotent chỉ môi trường development/test, dùng dữ liệu hoàn toàn giả; admin, member được sửa/không sensitive, member sensitive-only, member cả hai quyền, member chỉ đọc và locked user; properties đa dạng và một property vừa bán vừa thuê, các trạng thái, tin quá hạn xác nhận, archived.
- Demo ảnh hợp lệ có sẵn hoặc tự tạo fixture đơn giản và thực sự upload vào local storage; không phụ thuộc hotlink bên ngoài. Không commit file thật của người dùng.
- Demo credential chỉ dành local, được đánh dấu rõ; production seed không tạo các tài khoản này. Chặn demo seed nếu NODE_ENV=production.
- README tiếng Việt: yêu cầu máy, chạy từ clone sạch, env, services, migration, bootstrap/seed, khởi chạy, test, sửa lỗi thường gặp và tài khoản demo local.
- docs/DEPLOYMENT.md: một phương án chạy Node server + PostgreSQL + S3 private sau HTTPS, env, migrate deploy, healthcheck không lộ cấu hình, logs và rollback. Chỉ hướng dẫn, không tự deploy.
- docs/BACKUP_RESTORE.md và script ví dụ an toàn: pg_dump/restore và sao lưu object storage, retention đề xuất, kiểm tra khôi phục vào môi trường riêng, không restore đè production tự động. Database backup không thay thế backup ảnh/tệp. Nêu rõ lịch backup thực tế cần cấu hình khi vận hành; không báo đã tự động backup nếu mới viết script.
- Nếu có scheduler/cleanup, cung cấp cách chạy thực tế và idempotency, không chỉ TODO.

## 11. Kiểm thử và tiêu chí nghiệm thu

Viết test có ý nghĩa cho nghiệp vụ và bảo mật. Integration test cần DB thật riêng biệt; không chạy migration/reset trên database production. E2E cần tương tác UI và API/storage thực tế, không mock toàn bộ rồi kết luận hoàn thành.

Các trường hợp bắt buộc:
1. Chưa đăng nhập bị từ chối ở trang và API; đăng nhập/logout/đổi mật khẩu tạm chạy được; không có public signup.
2. MEMBER đọc hồ sơ PUBLISHED nhưng gọi API sửa trực tiếp không có canEdit bị chặn.
3. canEdit chỉ có tác dụng trên property được giao; thay id listing/file sang property khác bị chặn.
4. canEdit không canViewSensitive: sửa trường thường được, không đọc/sửa sensitive qua payload, SSR, audit hoặc file endpoint.
5. sensitive-only xem sensitive được nhưng sửa bị chặn; không xem draft nếu không canEdit.
6. ADMIN cấp/thu hồi quyền; request tiếp theo phản ánh thay đổi. Khóa user thu hồi session. Chặn khóa/hạ quyền admin cuối cùng.
7. MEMBER không tạo property/cycle, cấp quyền, đổi role, publish/archive bằng mass assignment.
8. Một property vừa RENT vừa SALE, giá/trạng thái độc lập; chặn active cycle trùng; publish validation đúng.
9. Hủy cọc cần lý do, transition sai bị chặn; hoàn tất và mở cycle mới giữ history; warning/acknowledgement tin còn lại thực sự hoạt động.
10. Hai update cùng version: một thành công, một 409; không mất dữ liệu, UI báo xung đột.
11. Gallery upload/reorder/cover/delete chạy được; giới hạn file, giả MIME, file forbidden và attach chéo property bị chặn; tài liệu không public.
12. Search/filter/pagination/sort và đơn vị giá chính xác; sensitive không lọt qua tìm kiếm; empty state hoạt động.
13. archived/restore đúng quyền và trạng thái; lastConfirmed không tự đổi khi sửa mô tả; stale filter đúng mốc 14 ngày.
14. Status change/history/audit rollback cùng nhau khi lỗi; secrets không xuất hiện trong audit/log/response.
15. Mobile khoảng 360px và desktop: đăng nhập → tìm tin → chi tiết → sửa được giao → đổi trạng thái; ADMIN quản lý quyền hoạt động end-to-end.

Chạy lint, typecheck, unit/integration tests, production build và E2E cốt lõi. Nếu môi trường thiếu Docker/browser/network, phân biệt rõ test đã chạy, test chưa chạy, lý do và lệnh để chạy; không bịa kết quả. Không bỏ hoặc làm yếu test chỉ để xanh.

Hoàn thành nghĩa là: dữ liệu lưu thật qua DB/storage, reload vẫn còn; auth và phân quyền enforce backend; UI đầy đủ cho luồng chính; migration/seed/docs đủ chạy từ clone sạch; không còn placeholder/TODO cho chức năng cốt lõi. Bất kỳ phần thiếu nào phải được ghi rõ, không gọi dự án hoàn tất nếu mới có mock UI.

## 12. Trình tự triển khai gợi ý và báo cáo cuối

1. Khảo sát repo, kế hoạch, ghi quyết định và giữ nguyên code người dùng.
2. Setup dependencies, Compose, env, schema/migrations, auth, bootstrap và policy.
3. Implement services/API: property/listing, permission, trạng thái/history, concurrency, private file storage và audit.
4. Implement toàn bộ UI và nối dữ liệu thật, mobile, loading/error/empty/conflict.
5. Seed, test quyền/nghiệp vụ/E2E; sửa lỗi, chạy build.
6. Hoàn thiện README, deployment, backup/restore và báo cáo.

Báo cáo cuối bằng tiếng Việt, gồm: chức năng đã làm; quyết định đáng chú ý; lệnh chạy chính xác; biến cần điền; cách tạo admin; kết quả từng nhóm kiểm tra đã chạy; phần còn thiếu và rủi ro thực tế; git diff summary và lệnh commit/push đề xuất. Không in secrets. Bắt đầu bằng việc đọc repository và triển khai ngay.
