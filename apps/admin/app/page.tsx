import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { logOut } from "./(auth)/actions";

const NAV_ITEMS = [
  {
    href: "/service",
    label: "Service Queue",
    description: "View and manage incoming service requests",
    icon: "🔧",
    countKey: "service",
    color: "border-green-500",
  },
  {
    href: "/parts",
    label: "Parts Queue",
    description: "Fulfill parts orders and stock-check requests",
    icon: "📦",
    countKey: "parts",
    color: "border-yellow-500",
  },
  {
    href: "/messages",
    label: "Message Inbox",
    description: "Customer messages across all departments",
    icon: "💬",
    countKey: "messages",
    color: "border-blue-500",
  },
  {
    href: "/winter-storage",
    label: "Winter Storage",
    description: "Manage drop-off and pick-up calendar",
    icon: "❄️",
    countKey: null,
    color: "border-sky-400",
  },
  {
    href: "/inventory",
    label: "Inventory",
    description: "Browse and update equipment listings",
    icon: "🚜",
    countKey: null,
    color: "border-green-400",
  },
  {
    href: "/promotions",
    label: "Promotions",
    description: "Create and schedule customer promotions",
    icon: "📣",
    countKey: null,
    color: "border-orange-400",
  },
  {
    href: "/notifications",
    label: "Notification Rules",
    description: "Configure automated push and SMS triggers",
    icon: "🔔",
    countKey: null,
    color: "border-purple-400",
  },
  {
    href: "/staff",
    label: "Staff Management",
    description: "Invite staff and manage roles",
    icon: "👥",
    countKey: null,
    color: "border-gray-400",
  },
] as const;

export default async function StaffHomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const [
    { data: profile },
    { data: staffRole },
    { count: newServiceCount },
    { count: newPartsCount },
    { count: newMessageCount },
  ] = await Promise.all([
    userId
      ? supabase.from("profiles").select("*").eq("id", userId).single()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("staff_roles").select("department, dealership_location_id").eq("profile_id", userId).single()
      : Promise.resolve({ data: null }),
    supabase.from("service_requests").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("parts_requests").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("message_threads").select("*", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const counts: Record<string, number> = {
    service: newServiceCount ?? 0,
    parts: newPartsCount ?? 0,
    messages: newMessageCount ?? 0,
  };

  const totalPending = (newServiceCount ?? 0) + (newPartsCount ?? 0) + (newMessageCount ?? 0);
  const department = staffRole?.department ?? null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-green-800 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
            P
          </div>
          <div>
            <p className="font-bold text-lg leading-tight tracking-tight">Proven Power</p>
            <p className="text-green-300 text-xs leading-tight">Staff Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{profile?.full_name ?? "Staff"}</p>
            <p className="text-xs text-green-300 capitalize">{department ?? "Staff"}</p>
          </div>
          <form action={logOut}>
            <button
              type="submit"
              className="min-h-9 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Welcome row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Good morning, {firstName}.</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          {totalPending > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-red-600">{totalPending}</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Item{totalPending !== 1 ? "s" : ""} need attention</p>
                <p className="text-xs text-red-500">
                  {[
                    counts.service ? `${counts.service} service` : null,
                    counts.parts ? `${counts.parts} parts` : null,
                    counts.messages ? `${counts.messages} message${counts.messages !== 1 ? "s" : ""}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nav grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {NAV_ITEMS.map((item) => {
            const badge = item.countKey ? counts[item.countKey] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative bg-white rounded-2xl border-l-4 ${item.color} shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-2 group`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{item.icon}</span>
                  {badge > 0 && (
                    <span className="min-w-[26px] h-[26px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <p className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">{item.label}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Proven Power · Oconomowoc &amp; Waukesha, WI · Internal use only
        </p>
      </main>
    </div>
  );
}
