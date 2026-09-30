import "dotenv/config";
export function testEnvironment(): NodeJS.ProcessEnv {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw || process.env.NODE_ENV === "production") throw new Error("Cần TEST_DATABASE_URL riêng; không chạy trên production.");
  const url = new URL(raw);
  if (!url.pathname.endsWith("_test") || !["localhost", "127.0.0.1"].includes(url.hostname) || raw === process.env.DATABASE_URL) throw new Error("Test yêu cầu DB local tên kết thúc _test, khác DATABASE_URL.");
  return { ...process.env, NODE_ENV: "test", DATABASE_URL: raw, APP_URL: "http://localhost:3100", BETTER_AUTH_SECRET: "test-only-secret-never-use-in-production-123456789", S3_BUCKET: "estate-test", DEMO_PASSWORD: "Test-local-only-2948" };
}
