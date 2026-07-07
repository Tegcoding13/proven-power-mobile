import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  if (!userId) redirect("/login");

  const { data: role } = await supabase
    .from("staff_roles")
    .select("department")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (role?.department !== "manager") redirect("/");

  return <>{children}</>;
}
