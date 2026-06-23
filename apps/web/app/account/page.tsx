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

  const settingsRows = [
    { label: "Notification Preferences", comingSoon: true },
    { label: "Payment Methods", comingSoon: true },
    { label: "Business Account & Team", href: "/account/team" },
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
