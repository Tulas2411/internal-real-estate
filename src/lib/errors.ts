import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new AppError(status, code, message); }
export function errorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ code: "VALIDATION", message: "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
  if (error instanceof AppError) return Response.json({ code: error.code, message: error.message, details: error.details }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P2025"].includes(error.code)) return Response.json({ code: "CONFLICT", message: "Dữ liệu đã thay đổi hoặc bị trùng. Tải lại để so sánh với bản đang nhập." }, { status: 409 });
  if (error instanceof SyntaxError) return Response.json({ code: "VALIDATION", message: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  // Do not log database queries, credentials, request bodies or file URLs.
  console.error("request_failed", error instanceof Error ? error.constructor.name : "UnknownError");
  return Response.json({ code: "INTERNAL", message: "Không thể xử lý yêu cầu. Vui lòng thử lại." }, { status: 500 });
}
