import "dotenv/config";
import { cleanupStorage } from "../src/services/files";
import { db } from "../src/lib/db";
cleanupStorage().then(v => console.log(`Đã xử lý ${v.processed} tác vụ; xóa ${v.deleted} object.`)).catch(() => { console.error("Dọn storage thất bại, hãy kiểm tra kết nối. Tác vụ sẽ được thử lại."); process.exitCode = 1; }).finally(() => db.$disconnect());
