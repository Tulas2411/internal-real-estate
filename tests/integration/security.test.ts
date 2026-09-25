import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { type Actor, requireUser } from "../../src/lib/policy";
import { auth } from "../../src/lib/auth";
import { hashPassword } from "better-auth/crypto";
import { createProperty, getProperty, updateProperty, updateOwner, grantPermission, setVisibility, listProperties } from "../../src/services/properties";
import { createListing, changeStatus, confirmListing } from "../../src/services/listings";
import { updateUser, resetUserPassword, changePassword } from "../../src/services/users";
import { uploadFile, downloadFile, reorderImages, deleteFile, inspectFile, cleanupStorage } from "../../src/services/files";
import { storage, bucket } from "../../src/lib/storage";
import { CreateBucketCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { GET, PATCH, POST } from "../../src/app/api/app/[...path]/route";
import { POST as authPost } from "../../src/app/api/auth/[...all]/route";
const suffix = randomUUID();
let admin: Actor, editor: Actor, sensitive: Actor, both: Actor, reader: Actor;
const password = "Test-integration-2948";
const origin = "http://localhost:3100";
const listingData = { transactionType: "RENT", expectedVersion: 1, priceMode: "FIXED", amount: "15000000", rentPeriod: "MONTH", saleAreaBasis: "usableArea", requiredDepositAmount: null, paymentCycle: "", minLeaseMonths: null, managementFee: null, electricityNote: "", waterNote: "", parkingFee: null, availableFrom: null, usageConditions: "", paymentTerms: "", taxFeeResponsibilityNote: "", expectedHandoverDate: null, transactionNotes: "" };
async function fixture() {
  const p = await createProperty(admin, { title: `Test ${suffix}`, provinceCity: "HCM", wardCommune: "Mẫu", addressLine: "Địa chỉ giả", usableArea: "50" });
  await db.propertyPermission.createMany({ data: [{ propertyId: p.id, userId: editor.id, canEdit: true, canViewSensitive: false, grantedById: admin.id }, { propertyId: p.id, userId: sensitive.id, canEdit: false, canViewSensitive: true, grantedById: admin.id }, { propertyId: p.id, userId: both.id, canEdit: true, canViewSensitive: true, grantedById: admin.id }] });
  await db.property.update({ where: { id: p.id }, data: { visibility: "PAUSED" } });
  return p;
}
async function login(actor: Actor) {
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify({ email: actor.email, password }) }));
  expect(response.status).toBe(200);
  return new Headers({ cookie: response.headers.getSetCookie().map(v => v.split(";")[0]).join("; "), origin, "Content-Type": "application/json" });
}
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("Unsafe test database");
  const hashed = await hashPassword(password);
  const actors = [];
  for (const name of ["admin", "editor", "sensitive", "both", "reader"]) {
    const id = randomUUID();
    actors.push(await db.user.create({ data: { id, email: `${name}-${suffix}@example.test`, name, role: name === "admin" ? "ADMIN" : "MEMBER", mustChangePassword: false, accounts: { create: { id: randomUUID(), providerId: "credential", accountId: id, password: hashed } } } }));
  }
  [admin, editor, sensitive, both, reader] = actors;
});
afterAll(() => db.$disconnect());
describe("DB thật: policy và concurrency", () => {
  it("anonymous API bị 401; signup không tồn tại", async () => {
    const response = await GET(new Request(`${origin}/api/app/properties`), { params: Promise.resolve({ path: ["properties"] }) }); expect(response.status).toBe(401);
    expect((await authPost(new Request(`${origin}/api/auth/sign-up/email`, { method: "POST", headers: { origin } }))).status).toBe(404);
  });
  it("member gọi API trực tiếp không được sửa; không lộ owner/commission/audit", async () => {
    const p = await fixture(); await db.ownerContact.create({ data: { propertyId: p.id, phone: "SECRET_PHONE" } });
    const headers = await login(reader);
    const response = await PATCH(new Request(`${origin}/api/app/properties/${p.id}`, { method: "PATCH", headers, body: JSON.stringify({ expectedVersion: 1, title: "forbidden" }) }), { params: Promise.resolve({ path: ["properties", p.id] }) }); expect(response.status).toBe(403);
    const data = await getProperty(editor, p.id); expect(JSON.stringify(data)).not.toContain("SECRET_PHONE"); expect(data).not.toHaveProperty("owner"); expect(data).not.toHaveProperty("documents");
    await updateProperty(editor, p.id, { expectedVersion: 1, title: "Allowed" });
    await expect(updateOwner(editor, p.id, { expectedVersion: 2, name: "", phone: "secret", zalo: "", source: "", sensitiveNotes: "" })).rejects.toMatchObject({ status: 403 });
    await expect(updateProperty(sensitive, p.id, { expectedVersion: 2, title: "no" })).rejects.toMatchObject({ status: 403 });
    expect((await getProperty(sensitive, p.id)).owner?.phone).toBe("SECRET_PHONE");
  });
  it("sensitive-only không thấy draft; canEdit chỉ trên đúng property", async () => {
    const p = await createProperty(admin, {}); await db.propertyPermission.create({ data: { propertyId: p.id, userId: sensitive.id, canViewSensitive: true, grantedById: admin.id } });
    await expect(getProperty(sensitive, p.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateProperty(editor, p.id, { expectedVersion: 1, title: "no" })).rejects.toMatchObject({ status: 404 });
  });
  it("member không tạo property/cycle; mass assignment bị chặn", async () => {
    await expect(createProperty(editor, {})).rejects.toMatchObject({ status: 403 }); const p = await fixture();
    await expect(createListing(editor, p.id, listingData)).rejects.toMatchObject({ status: 403 });
    await expect(updateProperty(editor, p.id, { expectedVersion: 1, visibility: "PUBLISHED" })).rejects.toThrow();
  });
  it("thu hồi permission có hiệu lực ở request kế tiếp", async () => {
    const p = await fixture(); await grantPermission(admin, p.id, { expectedVersion: 1, userId: editor.id, canEdit: false, canViewSensitive: false });
    await expect(updateProperty(editor, p.id, { expectedVersion: 2, title: "no" })).rejects.toMatchObject({ status: 403 });
  });
  it("hai update cùng version chỉ một thành công", async () => {
    const p = await fixture(); const results = await Promise.allSettled([updateProperty(editor, p.id, { expectedVersion: 1, title: "A" }), updateProperty(both, p.id, { expectedVersion: 1, title: "B" })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
  });
  it("publish yêu cầu ảnh/listing, restore về PAUSED; lastConfirmed không thay khi sửa", async () => {
    const p = await fixture(); await expect(setVisibility(admin, p.id, { expectedVersion: 1, visibility: "PUBLISHED" })).rejects.toMatchObject({ status: 400 });
    await setVisibility(admin, p.id, { expectedVersion: 1, visibility: "ARCHIVED" }); await expect(getProperty(both, p.id)).rejects.toMatchObject({ status: 404 });
    await expect(setVisibility(admin, p.id, { expectedVersion: 2, visibility: "PUBLISHED" })).rejects.toMatchObject({ status: 400 });
    await setVisibility(admin, p.id, { expectedVersion: 2, visibility: "PAUSED" });
    const l = await createListing(admin, p.id, { ...listingData, expectedVersion: 3 }); await confirmListing(editor, l.id, { expectedVersion: 1 });
    const old = await db.listing.findUniqueOrThrow({ where: { id: l.id } }); await updateProperty(editor, p.id, { expectedVersion: 4, description: "Changed" });
    expect((await db.listing.findUniqueOrThrow({ where: { id: l.id } })).lastConfirmedAt).toEqual(old.lastConfirmedAt);
  });
  it("hai cycle RENT/SALE độc lập, duplicate bị DB chặn", async () => {
    const p = await fixture(); await createListing(admin, p.id, listingData); await createListing(admin, p.id, { ...listingData, transactionType: "SALE", rentPeriod: null, amount: "5000000000", expectedVersion: 2 });
    await expect(db.listing.create({ data: { propertyId: p.id, transactionType: "RENT", cycleNumber: 2, priceMode: "ON_REQUEST", rentPeriod: "MONTH", isLatest: false } })).rejects.toMatchObject({ code: "P2002" });
    expect(await db.listing.count({ where: { propertyId: p.id } })).toBe(2);
  });
  it("status/history/audit rollback nếu thiếu ACK; có ACK thì hoàn tất và tạo cycle mới", async () => {
    const p = await fixture(); const rent = await createListing(admin, p.id, listingData); await createListing(admin, p.id, { ...listingData, transactionType: "SALE", rentPeriod: null, expectedVersion: 2 });
    const before = await db.auditLog.count({ where: { propertyId: p.id } });
    await expect(changeStatus(editor, rent.id, { expectedVersion: 1, status: "RENTED" })).rejects.toMatchObject({ code: "OTHER_LISTING_OPEN" });
    expect((await db.listing.findUniqueOrThrow({ where: { id: rent.id } })).version).toBe(1); expect(await db.auditLog.count({ where: { propertyId: p.id } })).toBe(before); expect(await db.statusHistory.count({ where: { listingId: rent.id } })).toBe(1);
    await changeStatus(editor, rent.id, { expectedVersion: 1, status: "RENTED", otherListingAction: "KEEP", otherListingReason: "Chủ vẫn bán khi đang cho thuê" });
    await createListing(admin, p.id, { ...listingData, expectedVersion: 3 });
    expect(await db.listing.count({ where: { propertyId: p.id, transactionType: "RENT" } })).toBe(2);
    expect((await db.listing.findUniqueOrThrow({ where: { id: rent.id } })).status).toBe("RENTED");
  });
  it("giá thuê lọc theo kỳ, search không tìm sensitive, pagination giới hạn", async () => {
    const p = await fixture(); await createListing(admin, p.id, { ...listingData, rentPeriod: "YEAR" });
    const month = await listProperties(reader, { q: suffix, minPrice: "1", rentPeriod: "MONTH", pageSize: 1 }); expect(month.items.every(l => l.rentPeriod === "MONTH")).toBe(true); expect(month.items.length).toBeLessThanOrEqual(1);
    expect((await listProperties(reader, { q: "SECRET_PHONE" })).total).toBe(0);
  });
  it("khóa user thu hồi session; role/reset cũng thu hồi", async () => {
    const headers = await login(reader); await updateUser(admin, reader.id, { expectedVersion: 1, name: reader.name, role: "MEMBER", status: "LOCKED" });
    await expect(requireUser(headers)).rejects.toMatchObject({ status: 401 });
    await updateUser(admin, reader.id, { expectedVersion: 2, name: reader.name, role: "MEMBER", status: "ACTIVE" });
    const again = await login(reader); await resetUserPassword(admin, reader.id, { expectedVersion: 3, temporaryPassword: password }); await expect(requireUser(again)).rejects.toMatchObject({ status: 401 });
    const temporary = await login(reader); await expect(requireUser(temporary)).rejects.toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    const me = await requireUser(temporary, true); await changePassword(me, { currentPassword: password, newPassword: "New-test-password-6789" }); await expect(requireUser(temporary)).rejects.toMatchObject({ status: 401 });
  });
  it("origin giả bị chặn trước mutation", async () => {
    const headers = await login(editor); headers.set("origin", "https://evil.example"); const r = await POST(new Request(`${origin}/api/app/properties`, { method: "POST", headers, body: "{}" }), { params: Promise.resolve({ path: ["properties"] }) }); expect(r.status).toBe(403);
  });
});
describe("S3 thật: upload, bảo vệ file và cleanup", () => {
  it("reject MIME giả và SVG", async () => { await expect(inspectFile(Buffer.from("<svg>bad</svg>"), false)).rejects.toMatchObject({ status: 400 }); await expect(inspectFile(Buffer.from("<html>bad</html>"), true)).rejects.toMatchObject({ status: 400 }); });
  it("upload/reorder/cover/delete; chặn chéo property; tài liệu private", async () => {
    try { await storage.send(new CreateBucketCommand({ Bucket: bucket() })); } catch (e) { if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes((e as Error).name)) throw e; }
    const p = await fixture(); const other = await createProperty(admin, {}); const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#aabbcc" } }).png().toBuffer();
    const upload = async (pid: string, kind: string, expectedVersion: number, actor = editor) => { const data = new FormData(); data.set("kind", kind); data.set("file", new File([new Uint8Array(bytes)], "demo.png", { type: "image/png" })); data.set("expectedVersion", String(expectedVersion)); return uploadFile(actor, pid, new Request(`${origin}/upload`, { method: "POST", body: data })); };
    const a = await upload(p.id, "image", 1); const b = await upload(p.id, "image", 2); const foreign = await upload(other.id, "image", 1, admin);
    await expect(reorderImages(editor, p.id, { expectedVersion: 3, imageIds: [a.id, foreign.id], coverId: a.id })).rejects.toMatchObject({ status: 400 });
    await expect(downloadFile(editor, foreign.id, false)).rejects.toMatchObject({ status: 404 });
    await reorderImages(editor, p.id, { expectedVersion: 3, imageIds: [b.id, a.id], coverId: b.id });
    expect((await db.propertyImage.findUniqueOrThrow({ where: { id: b.id } })).isCover).toBe(true);
    const doc = await upload(p.id, "document", 4, both); await expect(downloadFile(editor, doc.id, true)).rejects.toMatchObject({ status: 403 });
    expect((await downloadFile(sensitive, doc.id, true)).headers.get("Content-Disposition")).toContain("attachment");
    const row = await db.propertyDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect((await fetch(`${process.env.S3_ENDPOINT}/${bucket()}/${row.objectKey}`)).status).toBe(403);
    await deleteFile(editor, b.id, false, { expectedVersion: 5 }); expect((await db.propertyImage.findUniqueOrThrow({ where: { id: a.id } })).isCover).toBe(true);
    await deleteFile(both, doc.id, true, { expectedVersion: 6 }); await cleanupStorage();
    await expect(storage.send(new HeadObjectCommand({ Bucket: bucket(), Key: row.objectKey }))).rejects.toBeDefined();
  });
});
