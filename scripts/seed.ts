import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";
import { db } from "../src/lib/db";
import { putObject } from "../src/lib/storage";
import type { ListingStatus, PropertyType, Visibility } from "@prisma/client";
export async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Cấm seed demo trong production.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("Demo seed chỉ dùng database local.");
  const passwordInput = process.env.DEMO_PASSWORD;
  if (!passwordInput || passwordInput.length < 12) throw new Error("Điền DEMO_PASSWORD ít nhất 12 ký tự trong .env, chỉ dùng local.");
  const password = await hashPassword(passwordInput);
  const people = [
    { id: "demo-admin", name: "Quản trị Demo", email: "admin@demo.local", role: "ADMIN" as const },
    { id: "demo-editor", name: "Thành viên Chỉnh sửa", email: "editor@demo.local", role: "MEMBER" as const },
    { id: "demo-sensitive", name: "Thành viên Riêng tư", email: "sensitive@demo.local", role: "MEMBER" as const },
    { id: "demo-both", name: "Thành viên Đầy đủ", email: "both@demo.local", role: "MEMBER" as const },
    { id: "demo-reader", name: "Thành viên Chỉ đọc", email: "reader@demo.local", role: "MEMBER" as const },
    { id: "demo-locked", name: "Tài khoản Đã khóa", email: "locked@demo.local", role: "MEMBER" as const },
  ];
  for (const person of people) {
    await db.user.upsert({ where: { id: person.id }, update: {}, create: { ...person, mustChangePassword: false, status: person.id === "demo-locked" ? "LOCKED" : "ACTIVE", accounts: { create: { id: randomUUID(), accountId: person.id, providerId: "credential", password } } } });
  }
  const titles = ["Căn hộ vườn Ánh Dương · Dữ liệu mẫu", "Nhà phố Bình Yên · Dữ liệu mẫu", "Văn phòng Mây Xanh · Dữ liệu mẫu", "Mặt bằng Góc Phố · Dữ liệu mẫu", "Đất khu dân cư An Lành · Dữ liệu mẫu", "Phòng trọ Hoa Giấy · Dữ liệu mẫu", "Kho xưởng Phía Đông · Dữ liệu mẫu", "Căn hộ Ban Mai · Bản nháp mẫu"];
  const types: PropertyType[] = ["APARTMENT", "HOUSE", "OFFICE", "RETAIL", "LAND", "ROOM", "WAREHOUSE", "APARTMENT"];
  const visibilities: Visibility[] = ["PUBLISHED", "PUBLISHED", "PAUSED", "PUBLISHED", "PUBLISHED", "PUBLISHED", "ARCHIVED", "DRAFT"];
  const colors = ["#94b6a0", "#bcc8b2", "#9bafbe", "#d3bf9e", "#a2bd92", "#b7adc3", "#a8b9ba", "#b4cfbb"];
  for (let i = 0; i < titles.length; i++) {
    const id = `demo-property-${i + 1}`;
    if (await db.property.findUnique({ where: { id } })) continue;
    const image = await sharp(Buffer.from(`<svg width="1000" height="650" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="650" fill="#eef3ee"/><rect x="200" y="130" width="600" height="380" rx="8" fill="${colors[i]}"/><rect x="255" y="180" width="210" height="160" fill="#e3ece5"/><rect x="535" y="180" width="210" height="160" fill="#e3ece5"/><rect x="425" y="380" width="150" height="130" fill="#688473"/><text x="500" y="580" font-size="27" text-anchor="middle" fill="#597566">DEMO · ${i + 1} · MINH HOA</text></svg>`)).webp().toBuffer();
    const key = `${id}/${randomUUID()}`;
    await db.storageTask.create({ data: { objectKey: key, notBefore: new Date(Date.now() + 3600000) } });
    await putObject(key, image, "image/webp");
    await db.$transaction(async tx => {
      await tx.property.create({ data: { id, title: titles[i], propertyType: types[i], provinceCity: "TP. Hồ Chí Minh", wardCommune: "Phường mẫu", addressLine: `${20 + i} Đường Minh Họa (địa chỉ giả)`, projectBuilding: "Dự án Demo", usableArea: String(45 + i * 20), landArea: String(55 + i * 25), bedrooms: i % 4, bathrooms: 2, description: "Hồ sơ minh họa hoàn toàn giả, dùng để kiểm thử nghiệp vụ. Không phải nguồn hàng thực tế.", legalSummary: "Giấy tờ minh họa, chưa kiểm chứng", visibility: visibilities[i], archivedAt: i === 6 ? new Date() : null, createdById: "demo-admin", responsibleUserId: "demo-both", owner: { create: { name: "Chủ nhà giả lập", phone: "000-DEMO-ONLY", sensitiveNotes: "SENSITIVE_DEMO_ONLY" } }, images: { create: { objectKey: key, mime: "image/webp", bytes: image.length, width: 1000, height: 650, isCover: true, sortOrder: 0, caption: "Ảnh minh họa demo, không phải ảnh thực tế", uploaderId: "demo-admin" } }, permissions: { create: [
        { userId: "demo-editor", canEdit: true, canViewSensitive: false, grantedById: "demo-admin" }, { userId: "demo-sensitive", canEdit: false, canViewSensitive: true, grantedById: "demo-admin" }, { userId: "demo-both", canEdit: true, canViewSensitive: true, grantedById: "demo-admin" },
      ] } } });
      const rentStatus: ListingStatus = ["AVAILABLE", "DEPOSITED", "AVAILABLE", "RENTED", "WITHDRAWN", "AVAILABLE", "RENTED", "AVAILABLE"][i] as ListingStatus;
      for (const type of i === 0 ? ["RENT", "SALE"] as const : i === 4 ? ["SALE"] as const : ["RENT"] as const) {
        const status = type === "SALE" && i === 4 ? "SOLD" : type === "SALE" ? "AVAILABLE" : rentStatus;
        const listing = await tx.listing.create({ data: { propertyId: id, transactionType: type, cycleNumber: 1, status, priceMode: i === 2 ? "ON_REQUEST" : "FIXED", amount: i === 2 ? null : type === "SALE" ? "4500000000" : String((12 + i * 3) * 1000000), rentPeriod: type === "SALE" ? null : i === 5 ? "YEAR" : "MONTH", lastConfirmedAt: i % 2 === 0 ? null : new Date(Date.now() - 20 * 86400000), commissionType: "RATE", expectedCommissionRate: "2", commissionNote: "Hoa hồng minh họa" } });
        await tx.statusHistory.create({ data: { listingId: listing.id, fromStatus: null, toStatus: status, reason: "Dữ liệu mẫu local", actorId: "demo-admin" } });
      }
      await tx.auditLog.create({ data: { actorId: "demo-admin", action: "CREATE", entity: "Property", entityId: id, propertyId: id, diff: { demo: true, title: titles[i] } } });
      await tx.storageTask.delete({ where: { objectKey: key } });
    });
  }
  console.log("Seed demo hoàn tất. Mật khẩu lấy từ DEMO_PASSWORD; không in thông tin đăng nhập.");
}
seed().catch(e => { console.error(e instanceof Error && !e.name.startsWith("Prisma") ? e.message : "Seed thất bại. Kiểm tra DB/storage."); process.exitCode = 1; }).finally(() => db.$disconnect());
