import { auth } from "@/lib/auth";
import { checkOrigin, rateLimit } from "@/lib/http";
import { errorResponse } from "@/lib/errors";
import { createHash } from "node:crypto";
import { boundedBody } from "@/lib/request-body";
import { phoneLoginSchema } from "@/lib/phone";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  try {
    const path = new URL(request.url).pathname.replace("/api/auth", "");
    if (!["/sign-in/phone-number", "/sign-out", "/get-session"].includes(path)) return Response.json({ code: "NOT_FOUND", message: "Không tìm thấy API." }, { status: 404 });
    if (request.method === "POST") checkOrigin(request);
    if (request.method === "POST") {
      const bytes = await boundedBody(request, 10000);
      request = new Request(request.url, { method: request.method, headers: request.headers, body: bytes });
    }
    if (path === "/sign-in/phone-number") {
      const body = phoneLoginSchema.parse(await request.json());
      await rateLimit(`login:${createHash("sha256").update(body.phoneNumber).digest("hex")}`, 8);
      request = new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(body) });
    }
    const response = await auth.handler(request);
    if (path === "/sign-in/phone-number" && !response.ok) return Response.json({ code: "LOGIN_FAILED", message: response.status === 429 ? "Thử đăng nhập quá nhiều lần. Vui lòng chờ một phút." : "Số điện thoại hoặc mật khẩu không hợp lệ. Nếu mật khẩu tạm đã dùng, hãy liên hệ quản trị viên." }, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return errorResponse(error); }
}
export { handler as GET, handler as POST };
