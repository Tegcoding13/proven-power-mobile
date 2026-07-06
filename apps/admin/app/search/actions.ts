"use server";

import { createServiceRoleClient } from "../../lib/supabase/service-role";

export type CustomerResult = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  equipment: { id: string; label: string; make: string; model: string; year: number | null; serial: string | null }[];
  serviceCount: number;
  partsCount: number;
  messageCount: number;
  storageCount: number;
};

export async function searchCustomers(query: string): Promise<CustomerResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = createServiceRoleClient();
  const like = `%${q}%`;

  // Search profiles by name and phone
  const [{ data: profilesByName }, { data: equipmentHits }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .or(`full_name.ilike.${like},phone.ilike.${like}`)
      .eq("account_type", "customer")
      .limit(50),

    // Search equipment by model, make, serial, nickname — get back business_account_id
    supabase
      .from("equipment")
      .select("id, make, model, model_year, serial_number, nickname, business_account_id")
      .or(`model.ilike.${like},make.ilike.${like},serial_number.ilike.${like},nickname.ilike.${like}`)
      .is("deleted_at", null)
      .limit(50),
  ]);

  // Search auth.users by email via admin API
  let emailProfileIds: string[] = [];
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const matched = users.filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()));
    emailProfileIds = matched.map((u) => u.id);
  } catch {
    // admin API not available — skip email search
  }

  // Collect all profile IDs to fetch
  const profileIdSet = new Set<string>();
  (profilesByName ?? []).forEach((p) => profileIdSet.add(p.id));
  emailProfileIds.forEach((id) => profileIdSet.add(id));

  // Equipment hits → get profile IDs via business_account_members
  const equipBizIds = [...new Set((equipmentHits ?? []).map((e) => e.business_account_id))];
  if (equipBizIds.length > 0) {
    const { data: members } = await supabase
      .from("business_account_members")
      .select("profile_id")
      .in("business_account_id", equipBizIds);
    (members ?? []).forEach((m) => profileIdSet.add(m.profile_id));
  }

  if (profileIdSet.size === 0) return [];

  const profileIds = [...profileIdSet];

  // Fetch full profile rows for any IDs we only have from email/equipment hits
  const missingIds = profileIds.filter((id) => !(profilesByName ?? []).find((p) => p.id === id));
  const { data: extraProfiles } = missingIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", missingIds)
    : { data: [] };

  const allProfiles = [...(profilesByName ?? []), ...(extraProfiles ?? [])];

  // Get emails for all matched profiles from auth admin
  let emailByProfileId: Map<string, string> = new Map();
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    users.forEach((u) => { if (u.email) emailByProfileId.set(u.id, u.email); });
  } catch {
    // skip
  }

  // Fetch business accounts for all profiles
  const { data: memberRows } = await supabase
    .from("business_account_members")
    .select("profile_id, business_account_id")
    .in("profile_id", profileIds);

  const bizIdsByProfile = new Map<string, string[]>();
  (memberRows ?? []).forEach((m) => {
    const list = bizIdsByProfile.get(m.profile_id) ?? [];
    list.push(m.business_account_id);
    bizIdsByProfile.set(m.profile_id, list);
  });

  const allBizIds = [...new Set((memberRows ?? []).map((m) => m.business_account_id))];

  // Fetch all equipment, service, parts, messages, storage counts in parallel
  const [
    { data: allEquipment },
    { data: serviceRows },
    { data: partsRows },
    { data: messageRows },
    { data: storageRows },
  ] = await Promise.all([
    allBizIds.length
      ? supabase.from("equipment").select("id, make, model, model_year, serial_number, nickname, business_account_id").in("business_account_id", allBizIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as { id: string; make: string; model: string; model_year: number | null; serial_number: string | null; nickname: string | null; business_account_id: string }[] }),

    allBizIds.length
      ? supabase.from("service_requests").select("id, business_account_id").in("business_account_id", allBizIds)
      : Promise.resolve({ data: [] as { id: string; business_account_id: string }[] }),

    allBizIds.length
      ? supabase.from("parts_requests").select("id, business_account_id").in("business_account_id", allBizIds)
      : Promise.resolve({ data: [] as { id: string; business_account_id: string }[] }),

    allBizIds.length
      ? supabase.from("message_threads").select("id, business_account_id").in("business_account_id", allBizIds)
      : Promise.resolve({ data: [] as { id: string; business_account_id: string }[] }),

    allBizIds.length
      ? supabase.from("winter_storage_signups").select("id, business_account_id").in("business_account_id", allBizIds)
      : Promise.resolve({ data: [] as { id: string; business_account_id: string }[] }),
  ]);

  return allProfiles.map((profile): CustomerResult => {
    const bizIds = bizIdsByProfile.get(profile.id) ?? [];
    const equipment = (allEquipment ?? [])
      .filter((e) => bizIds.includes(e.business_account_id))
      .map((e) => ({
        id: e.id,
        label: e.nickname || `${e.make} ${e.model}${e.model_year ? ` (${e.model_year})` : ""}`,
        make: e.make,
        model: e.model,
        year: e.model_year,
        serial: e.serial_number,
      }));

    return {
      profileId: profile.id,
      fullName: profile.full_name,
      email: emailByProfileId.get(profile.id) ?? null,
      phone: profile.phone,
      equipment,
      serviceCount: (serviceRows ?? []).filter((r) => bizIds.includes(r.business_account_id)).length,
      partsCount: (partsRows ?? []).filter((r) => bizIds.includes(r.business_account_id)).length,
      messageCount: (messageRows ?? []).filter((r) => r.business_account_id && bizIds.includes(r.business_account_id)).length,
      storageCount: (storageRows ?? []).filter((r) => r.business_account_id && bizIds.includes(r.business_account_id)).length,
    };
  });
}
