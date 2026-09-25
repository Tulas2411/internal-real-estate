import { db } from "./db";
import { errorResponse, fail } from "./errors";
import { requireUser, type Actor } from "./policy";
import { boundedBody } from "./request-body";
export async function rateLimit(key: string, max = 60, seconds = 60) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RequestLimit" (key, count, "expiresAt") VALUES (${key}, 1, now() + ${seconds} * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RequestLimit"."expiresAt" <= now() THEN 1 ELSE "RequestLimit".count + 1 END,
    "expiresAt" = CASE WHEN "RequestLimit"."expiresAt" <= now() THEN now() + ${seconds} * interval '1 second' ELSE "RequestLimit"."expiresAt" END RETURNING count`;
  if (rows[0].count > max) fail(429, "RATE_LIMIT", "Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.");
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== process.env.APP_URL) fail(403, "ORIGIN", "Nguồn yêu cầu không hợp lệ.");
}
export async function api(request: Request, fn: (actor: Actor) => Promise<unknown>, allowPasswordChange = false) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) checkOrigin(request);
    const actor = await requireUser(request.headers, allowPasswordChange);
    if (!["GET", "HEAD"].includes(request.method)) await rateLimit(`mutation:${actor.id}`);
    const data = await fn(actor);
    const response = data instanceof Response ? data : Response.json(data);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
export async function body(request: Request) {
  const raw = new TextDecoder().decode(await boundedBody(request, 100000));
  return JSON.parse(raw);
}
