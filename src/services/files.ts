import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { propertyAccess, lockProperty, bumpProperty, type Actor } from "@/lib/policy";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/errors";
import { putObject, getObject, deleteObject } from "@/lib/storage";
import { versionSchema } from "@/lib/validation";
import { boundedBody } from "@/lib/request-body";
const imageMimes = ["image/jpeg", "image/png", "image/webp"];
export async function inspectFile(bytes: Buffer, document: boolean) {
  const type = await fileTypeFromBuffer(bytes);
  if (!type || !(document ? [...imageMimes, "application/pdf"] : imageMimes).includes(type.mime)) fail(400, "FILE_TYPE", "Chỉ nhận JPEG, PNG, WebP và PDF cho giấy tờ. Loại tệp được kiểm tra từ nội dung.");
  if (imageMimes.includes(type.mime)) {
    // Decode and re-encode, stripping metadata and trailing executable/polyglot content.
    const image = sharp(bytes, { limitInputPixels: 40000000, animated: false });
    const metadata = await image.metadata();
    const clean = await image.rotate().webp({ quality: 88 }).toBuffer();
    return { bytes: clean, mime: "image/webp", width: metadata.width, height: metadata.height };
  }
  if (!bytes.subarray(-2048).toString("latin1").includes("%%EOF")) fail(400, "FILE_TYPE", "Tệp PDF không hợp lệ.");
  return { bytes, mime: type.mime, width: undefined, height: undefined };
}
export async function uploadFile(actor: Actor, propertyId: string, request: Request) {
  if (Number(request.headers.get("content-length")) > 21 * 1024 * 1024) fail(413, "FILE_SIZE", "Tệp vượt quá giới hạn.");
  const raw = await boundedBody(request, 21 * 1024 * 1024);
  const form = await new Response(raw, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  const document = form.get("kind") === "document";
  const version = z.coerce.number().int().positive().parse(form.get("expectedVersion"));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) fail(400, "FILE_REQUIRED", "Vui lòng chọn tệp.");
  if (file.size > (document ? 20 : 10) * 1024 * 1024) fail(413, "FILE_SIZE", `Tệp vượt quá ${document ? 20 : 10} MB.`);
  await propertyAccess(db, actor, propertyId, document ? "editSensitive" : "edit");
  const content = await inspectFile(Buffer.from(await file.arrayBuffer()), document);
  const key = `${propertyId}/${randomUUID()}`;
  // Durable cleanup intent is committed before S3. An interrupted upload leaves a retryable task.
  await db.storageTask.create({ data: { objectKey: key, notBefore: new Date(Date.now() + 3600000) } });
  await putObject(key, content.bytes, content.mime);
  return db.$transaction(async tx => {
    await lockProperty(tx, propertyId);
    await propertyAccess(tx, actor, propertyId, document ? "editSensitive" : "edit");
    await bumpProperty(tx, propertyId, version);
    const count = document ? await tx.propertyDocument.count({ where: { propertyId } }) : await tx.propertyImage.count({ where: { propertyId } });
    if (count >= (document ? 10 : 20)) fail(400, "FILE_COUNT", `Tối đa ${document ? 10 : 20} tệp cho mỗi hồ sơ.`);
    const common = { propertyId, objectKey: key, mime: content.mime, bytes: content.bytes.length, uploaderId: actor.id };
    const originalName = file.name.replace(/[\x00-\x1f\x7f/\\"<>]/g, "_").slice(0, 180);
    const record = document ? await tx.propertyDocument.create({ data: { ...common, originalName, documentType: z.string().max(100).parse(form.get("documentType") ?? "Giấy tờ") } }) : await tx.propertyImage.create({ data: { ...common, width: content.width, height: content.height, sortOrder: count, isCover: count === 0, caption: z.string().max(300).parse(form.get("caption") ?? "") } });
    await tx.storageTask.delete({ where: { objectKey: key } });
    await audit(tx, actor, "FILE_UPLOAD", document ? "PropertyDocument" : "PropertyImage", record.id, propertyId, { fileId: record.id, mime: content.mime, bytes: content.bytes.length }, document);
    return { id: record.id, version: version + 1 };
  });
}
async function findFile(id: string, document: boolean) {
  const file = document ? await db.propertyDocument.findUnique({ where: { id } }) : await db.propertyImage.findUnique({ where: { id } });
  if (!file) fail(404, "NOT_FOUND", "Không tìm thấy tệp.");
  return file;
}
export async function downloadFile(actor: Actor, id: string, document: boolean) {
  const file = await findFile(id, document);
  await propertyAccess(db, actor, file.propertyId, document ? "sensitive" : "view");
  const object = await getObject(file.objectKey);
  if (!object.Body) fail(404, "NOT_FOUND", "Tệp không còn trong kho lưu trữ.");
  const filename = "originalName" in file ? file.originalName : `${id}.webp`;
  return new Response(object.Body.transformToWebStream(), { headers: { "Content-Type": file.mime, "Content-Length": String(file.bytes), "Content-Disposition": `${document ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
}
export async function deleteFile(actor: Actor, id: string, document: boolean, raw: unknown) {
  const { expectedVersion } = versionSchema.parse(raw);
  const file = await findFile(id, document);
  return db.$transaction(async tx => {
    await lockProperty(tx, file.propertyId);
    const { property } = await propertyAccess(tx, actor, file.propertyId, document ? "editSensitive" : "edit");
    await bumpProperty(tx, file.propertyId, expectedVersion);
    if (document) await tx.propertyDocument.delete({ where: { id } });
    else {
      if (property.visibility === "PUBLISHED" && await tx.propertyImage.count({ where: { propertyId: file.propertyId } }) <= 1) fail(400, "COVER_REQUIRED", "Hồ sơ đang hiển thị cần ít nhất một ảnh.");
      await tx.propertyImage.delete({ where: { id } });
      const images = await tx.propertyImage.findMany({ where: { propertyId: file.propertyId }, orderBy: { sortOrder: "asc" } });
      const cover = images.find(x => x.isCover)?.id ?? images[0]?.id;
      for (let i = 0; i < images.length; i++) await tx.propertyImage.update({ where: { id: images[i].id }, data: { sortOrder: i, isCover: images[i].id === cover } });
    }
    await tx.storageTask.upsert({ where: { objectKey: file.objectKey }, create: { objectKey: file.objectKey, notBefore: new Date() }, update: {} });
    await audit(tx, actor, "FILE_DELETE", document ? "PropertyDocument" : "PropertyImage", id, file.propertyId, { fileId: id }, document);
    return { ok: true };
  });
}
export async function reorderImages(actor: Actor, id: string, raw: unknown) {
  const input = z.object({ expectedVersion: z.number().int().positive(), imageIds: z.array(z.string()).min(1).max(20), coverId: z.string(), captions: z.record(z.string(), z.string().max(300)).optional() }).strict().parse(raw);
  return db.$transaction(async tx => {
    await lockProperty(tx, id);
    await propertyAccess(tx, actor, id, "edit");
    await bumpProperty(tx, id, input.expectedVersion);
    const images = await tx.propertyImage.findMany({ where: { propertyId: id }, orderBy: { sortOrder: "asc" } });
    if (new Set(input.imageIds).size !== images.length || input.imageIds.length !== images.length || images.some(x => !input.imageIds.includes(x.id)) || !input.imageIds.includes(input.coverId)) fail(400, "IMAGE_OWNERSHIP", "Danh sách ảnh hoặc ảnh bìa không thuộc hồ sơ này.");
    await tx.propertyImage.updateMany({ where: { propertyId: id }, data: { isCover: false } });
    for (let i = 0; i < input.imageIds.length; i++) await tx.propertyImage.update({ where: { id: input.imageIds[i] }, data: { sortOrder: i, isCover: input.imageIds[i] === input.coverId, ...(input.captions?.[input.imageIds[i]] !== undefined ? { caption: input.captions[input.imageIds[i]] } : {}) } });
    await audit(tx, actor, "GALLERY", "Property", id, id, { old: images.map(x => ({ id: x.id, isCover: x.isCover, caption: x.caption })), new: { order: input.imageIds, cover: input.coverId, captions: input.captions ?? {} } });
    return { ok: true };
  });
}
export async function cleanupStorage() {
  const tasks = await db.storageTask.findMany({ where: { notBefore: { lte: new Date() } }, take: 100 });
  let deleted = 0;
  for (const task of tasks) {
    const linked = await db.propertyImage.count({ where: { objectKey: task.objectKey } }) + await db.propertyDocument.count({ where: { objectKey: task.objectKey } });
    if (linked) { await db.storageTask.deleteMany({ where: { id: task.id } }); continue; }
    try { await deleteObject(task.objectKey); await db.storageTask.deleteMany({ where: { id: task.id } }); deleted++; }
    catch { await db.storageTask.updateMany({ where: { id: task.id }, data: { attempts: { increment: 1 }, notBefore: new Date(Date.now() + Math.min(86400000, 60000 * 2 ** Math.min(task.attempts, 10))) } }); }
  }
  await db.requestLimit.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
  return { processed: tasks.length, deleted };
}
