import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/policy";
import { PasswordForm } from "@/components/auth-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireUser(await headers(), true).catch(() => null);
  if (!user) redirect("/login");
  return <PasswordForm required={user.mustChangePassword} />;
}
