"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { createServiceRoleClient } from "../../lib/supabase/service-role";

async function requireManager() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) throw new Error("Not authenticated.");
  const { data: role } = await supabase
    .from("staff_roles")
    .select("department")
    .eq("profile_id", userId)
    .single();
  if (role?.department !== "manager") throw new Error("Manager access required.");
  return userId;
}

export async function inviteStaff(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await requireManager();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Unauthorized.";
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  if (!email || !fullName || !department) return "All fields are required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address.";

  const admin = createServiceRoleClient();

  // Invite creates the auth user and sends a magic-link email to set their password.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_ADMIN_URL ?? ""}/login`,
  });

  if (inviteErr) return inviteErr.message;
  const newUserId = invited.user.id;

  // Create their profile (account_type = staff)
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: newUserId,
    full_name: fullName,
    account_type: "staff",
  });
  if (profileErr) return profileErr.message;

  // Create their staff role
  const { error: roleErr } = await admin.from("staff_roles").insert({
    profile_id: newUserId,
    department: department as never,
    dealership_location_id: null,
  });
  if (roleErr) return roleErr.message;

  revalidatePath("/staff");
  return null;
}

export async function removeStaff(profileId: string): Promise<string | null> {
  try {
    await requireManager();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Unauthorized.";
  }

  const admin = createServiceRoleClient();

  await admin.from("staff_roles").delete().eq("profile_id", profileId);
  await admin.from("profiles").update({ account_type: "customer" }).eq("id", profileId);
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return error.message;

  revalidatePath("/staff");
  return null;
}
