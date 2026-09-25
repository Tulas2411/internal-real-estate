import { fail } from "./errors";
export async function boundedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) fail(413, "TOO_LARGE", "Nội dung yêu cầu quá lớn.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const item = await reader.read(); if (item.done) break;
    size += item.value.byteLength;
    if (size > maxBytes) { await reader.cancel(); fail(413, "TOO_LARGE", "Nội dung yêu cầu quá lớn."); }
    chunks.push(item.value);
  }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
