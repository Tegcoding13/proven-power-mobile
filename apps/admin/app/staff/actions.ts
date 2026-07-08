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

export type StaffMember = {
  profileId: string;
  fullName: string;
  email: string;
  department: string;
  dealershipLocationId: string | null;
};

export async function getStaffList(): Promise<StaffMember[]> {
  const admin = createServiceRoleClient();

  const [{ data: profiles }, { data: roles }, { data: { users } }] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("account_type", "staff").order("full_name"),
    admin.from("staff_roles").select("profile_id, department, dealership_location_id"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const roleByProfileId = new Map((roles ?? []).map((r) => [r.profile_id, r]));
  const emailByUserId = new Map(users.map((u) => [u.id, u.email ?? ""]));

  return (profiles ?? []).map((p) => {
    const role = roleByProfileId.get(p.id);
    return {
      profileId: p.id,
      fullName: p.full_name ?? "Unknown",
      email: emailByUserId.get(p.id) ?? "",
      department: role?.department ?? "office",
      dealershipLocationId: role?.dealership_location_id ?? null,
    };
  });
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
  const locationId = String(formData.get("location_id") ?? "").trim() || null;

  if (!email || !fullName || !department) return "All fields are required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address.";

  const admin = createServiceRoleClient();

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "";
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${adminUrl}/auth/callback?next=/auth/set-password`,
  });

  if (inviteErr) return inviteErr.message;
  const newUserId = invited.user.id;

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: newUserId,
    full_name: fullName,
    account_type: "staff",
  });
  if (profileErr) return profileErr.message;

  const { error: roleErr } = await admin.from("staff_roles").insert({
    profile_id: newUserId,
    department: department as never,
    dealership_location_id: locationId,
  });
  if (roleErr) return roleErr.message;

  revalidatePath("/staff");
  return null;
}

export async function updateStaffRole(
  profileId: string,
  department: string,
  locationId: string | null
): Promise<string | null> {
  try {
    await requireManager();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Unauthorized.";
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("staff_roles")
    .update({ department: department as never, dealership_location_id: locationId })
    .eq("profile_id", profileId);

  if (error) return error.message;
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
