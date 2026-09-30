import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/policy";
import { AppError } from "@/lib/errors";
import { Shell } from "@/components/shell";
import { Dashboard, Inventory } from "@/components/inventory";
import { PropertyDetail, NewProperty } from "@/components/property-detail";
import { AdminPage } from "@/components/admin-pages";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ screen?: string[] }> }) {
  const user = await requireUser(await headers()).catch(e => { if (e instanceof AppError && e.code === "PASSWORD_CHANGE_REQUIRED") redirect("/password"); if (e instanceof AppError && e.status === 401) redirect("/login"); throw e; });
  const { screen = [] } = await params;
  let content;
  if (!screen.length) content = <Dashboard />;
  else if (screen.length === 1 && ["rent", "sale"].includes(screen[0])) content = <Inventory type={screen[0] === "rent" ? "RENT" : "SALE"} />;
  else if (screen.length === 2 && screen[0] === "properties") content = screen[1] === "new" ? user.role === "ADMIN" ? <NewProperty /> : <p role="alert">Bạn không có quyền tạo hồ sơ.</p> : <PropertyDetail id={screen[1]} />;
  else if (screen.length === 1 && ["users", "permissions", "archived", "audit"].includes(screen[0])) content = user.role === "ADMIN" ? <AdminPage section={screen[0]} /> : <p role="alert">Bạn không có quyền truy cập trang quản trị.</p>;
  else notFound();
  return <Shell user={user}>{content}</Shell>;
}
