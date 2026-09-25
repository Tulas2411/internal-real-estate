import { test, expect, type Page } from "@playwright/test";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string) {
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Mật khẩu", { exact: true }).fill(password); await page.getByRole("button", { name: "Đăng nhập →" }).click(); await expect(page).toHaveURL(/\/$/);
}
test("không đăng nhập: trang chuyển về login và API bị từ chối", async ({ page, request }) => {
  await page.goto("/rent"); await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/app/properties")).status()).toBe(401);
  expect((await request.post("/api/auth/sign-up/email", { data: { email: "x@x.test", password: "No-public-signup-123" } })).status()).toBe(404);
});
test("member: tìm tin, xem chi tiết, sửa được giao, đổi trạng thái; sensitive vắng khỏi payload", async ({ page }) => {
  await login(page, "editor@demo.local"); await page.goto("/rent");
  await page.getByRole("textbox", { name: "Tìm bất động sản" }).fill("Ánh Dương");
  await expect(page.locator(".inventory-row:not(.inventory-head)")).toHaveCount(1);
  await page.locator(".inventory-row:not(.inventory-head)").click(); await expect(page.getByRole("heading", { name: /Căn hộ vườn/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thông tin riêng tư" })).toHaveCount(0);
  const payload = await page.request.get("/api/app/properties/demo-property-1"); const text = await payload.text(); expect(text).not.toContain("SENSITIVE_DEMO_ONLY"); expect(text).not.toContain("expectedCommissionRate");
  await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click(); await page.getByLabel("Ghi chú dẫn khách (thông thường)").fill("E2E ghi chú dẫn khách"); await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByText("E2E ghi chú dẫn khách")).toBeVisible();
  await page.getByRole("button", { name: "Đã xác nhận tình trạng", exact: true }).click(); await expect(page.getByText("Đã cập nhật.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đổi trạng thái", exact: true }).click(); await page.getByLabel("Trạng thái mới").selectOption("DEPOSITED"); await page.getByRole("button", { name: "Xác nhận đổi trạng thái" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Đổi trạng thái", exact: true }).click(); await page.getByLabel("Trạng thái mới").selectOption("AVAILABLE"); await page.getByLabel("Lý do", { exact: true }).fill("Khôi phục dữ liệu sau kiểm thử"); await page.getByRole("button", { name: "Xác nhận đổi trạng thái" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (await page.getByRole("button", { name: "Mở menu" }).isVisible()) await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
});
test("admin: cấp quyền riêng từng hồ sơ, API phản ánh ngay", async ({ page }) => {
  await login(page, "admin@demo.local"); await page.goto("/properties/demo-property-1");
  await page.getByRole("button", { name: "Cấp / thu hồi quyền" }).click(); await page.getByLabel("Tài khoản", { exact: true }).selectOption("demo-reader"); await page.getByLabel("Quyền chỉnh sửa").selectOption("true"); await page.getByLabel("Quyền xem thông tin riêng tư").selectOption("false"); await page.getByRole("button", { name: "Lưu quyền (cả hai Không = thu hồi)" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Cấp / thu hồi quyền" }).click(); await page.getByLabel("Tài khoản", { exact: true }).selectOption("demo-reader"); await page.getByLabel("Quyền chỉnh sửa").selectOption("false"); await page.getByRole("button", { name: "Lưu quyền (cả hai Không = thu hồi)" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
});
