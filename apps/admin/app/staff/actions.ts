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

export async function createStaff(
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
  const password = String(formData.get("password") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim() || null;

  if (!email || !fullName || !department || !password) return "All fields are required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";

  const admin = createServiceRoleClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr) return createErr.message;
  const newUserId = created.user.id;

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

export async function updateStaffPassword(
  profileId: string,
  newPassword: string
): Promise<string | null> {
  try {
    await requireManager();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Unauthorized.";
  }

  if (newPassword.length < 8) return "Password must be at least 8 characters.";

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password: newPassword });
  if (error) return error.message;
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
