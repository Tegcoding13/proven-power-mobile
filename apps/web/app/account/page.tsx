import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { logOut } from "../(auth)/actions";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const { data: profile } = userId
    ? await supabase.from("profiles").select("*").eq("id", userId).single()
    : { data: null };

  // Fetch home store for display
  let homeStoreName: string | null = null;
  if (userId) {
    const { data: membership } = await supabase
      .from("business_account_members")
      .select("business_account_id")
      .eq("profile_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (membership) {
      const { data: account } = await supabase
        .from("business_accounts")
        .select("primary_location_id")
        .eq("id", membership.business_account_id)
        .single();
      if (account?.primary_location_id) {
        const { data: loc } = await supabase
          .from("dealership_locations")
          .select("name")
          .eq("id", account.primary_location_id)
          .single();
        homeStoreName = loc?.name?.replace("Proven Power - ", "") ?? null;
      }
    }
  }

  const settingsRows = [
    { label: "Notification Preferences", comingSoon: true },
    { label: "Payment Methods", comingSoon: true },
    { label: "Business Account & Team", comingSoon: true },
    { label: "Locations & Contact", href: "/locations" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-md mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center text-white text-2xl font-bold">
          {initials(profile?.full_name)}
        </div>
        <p className="text-xl font-bold text-black">{profile?.full_name ?? "Your Account"}</p>
      </div>

      {/* Home store — affects where service/parts/storage requests are routed */}
      <Link
        href="/locations"
        className="bg-white rounded-[20px] px-5 py-4 flex items-center justify-between"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
      >
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">My Home Store</p>
          <p className="text-base font-bold text-[#1a3d2b]">
            {homeStoreName ?? "Not set — tap to choose"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Requests are sent to this location</p>
        </div>
        <span className="text-gray-400 text-lg ml-3">›</span>
      </Link>

      <div className="bg-white rounded-[20px] overflow-hidden" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        {settingsRows.map((row, index) =>
          row.href ? (
            <Link
              key={row.label}
              href={row.href}
              className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50 ${index > 0 ? "border-t border-gray-100" : ""}`}
            >
              <span className="text-black">{row.label}</span>
              <span className="text-gray-400">›</span>
            </Link>
          ) : (
            <div
              key={row.label}
              className={`flex items-center justify-between px-5 py-4 opacity-60 ${index > 0 ? "border-t border-gray-100" : ""}`}
            >
              <span className="text-black">{row.label}</span>
              <span className="text-xs text-gray-500">Coming soon</span>
            </div>
          )
        )}
      </div>

      <form action={logOut}>
        <button
          type="submit"
          className="w-full min-h-14 rounded-[20px] border border-red-600 text-red-600 font-bold bg-white"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
