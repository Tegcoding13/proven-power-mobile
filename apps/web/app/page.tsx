import Link from "next/link";
import { createClient } from "../lib/supabase/server";

const QUICK_ACTIONS = [
  { href: "/garage", label: "My Equipment", subtitle: "Manage your garage", icon: "🚜" },
  { href: "/service/new", label: "Schedule Service", subtitle: "Request service", icon: "🔧" },
  { href: "/parts", label: "Parts Store", subtitle: "Order parts", icon: "🛒" },
  { href: "/messages", label: "Messages", subtitle: "Talk to us", icon: "💬" },
  { href: "/service", label: "Service History", subtitle: "Past & active", icon: "📋" },
  { href: "/winter-storage", label: "Winter Storage", subtitle: "Sign up", icon: "❄️" },
  { href: "/invoices", label: "Invoices", subtitle: "Payment history", icon: "📄" },
  { href: "/locations", label: "Locations", subtitle: "Hours & contact", icon: "📍" },
  { href: "/inventory", label: "Inventory", subtitle: "New & used units", icon: "📦" },
  { href: "/deals", label: "Deals & Offers", subtitle: "Current promotions", icon: "🏷️" },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const { data: profile } = userId
    ? await supabase.from("profiles").select("*").eq("id", userId).single()
    : { data: null };

  const { data: membership } = userId
    ? await supabase.from("business_account_members").select("business_account_id").eq("profile_id", userId).eq("status", "active").limit(1).maybeSingle()
    : { data: null };

  const { count: unreadCount } = userId
    ? await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("is_read", false)
    : { count: 0 };

  let homeStoreName: string | null = null;
  if (membership?.business_account_id) {
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

  let equipmentCount = 0;
  let activeServiceCount = 0;
  let nextTask: { task_name: string; due_at_date: string | null; due_at_hours: number | null; equipmentLabel: string; status: string } | null = null;
  const businessAccountId = membership?.business_account_id;

  if (businessAccountId) {
    const { count: equipCount } = await supabase
      .from("equipment")
      .select("*", { count: "exact", head: true })
      .eq("business_account_id", businessAccountId)
      .is("deleted_at", null);
    equipmentCount = equipCount ?? 0;

    const { count: svcCount } = await supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .eq("business_account_id", businessAccountId)
      .not("status", "in", "(completed,cancelled)");
    activeServiceCount = svcCount ?? 0;

    const { data: equipmentIds } = await supabase
      .from("equipment")
      .select("id")
      .eq("business_account_id", businessAccountId)
      .is("deleted_at", null);
    const ids = (equipmentIds ?? []).map((e) => e.id);

    if (ids.length > 0) {
      const { data: taskRows } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .in("equipment_id", ids)
        .in("status", ["due", "overdue"])
        .order("due_at_date", { ascending: true, nullsFirst: false })
        .limit(1);

      if (taskRows && taskRows.length > 0) {
        const task = taskRows[0];
        const { data: equipmentRow } = await supabase.from("equipment").select("*").eq("id", task.equipment_id).single();
        nextTask = {
          task_name: task.task_name,
          due_at_date: task.due_at_date,
          due_at_hours: task.due_at_hours,
          equipmentLabel: equipmentRow?.nickname || equipmentRow?.model || "Your equipment",
          status: task.status,
        };
      }
    }
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      {/* Header — solid brand green, no gradient */}
      <div className="bg-[#1a3d2b] px-4 pt-5 pb-0">
        <div className="max-w-2xl mx-auto w-full">
          {/* Top bar: logo + actions */}
          <div className="flex items-center justify-between mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Proven Power" className="h-8 w-auto" />
            <div className="flex items-center gap-2">
              <Link
                href="/notifications"
                className="relative w-9 h-9 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                title="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount && unreadCount > 0 ? (
                  <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/account"
                className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                title="Account"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* Greeting */}
          <div className="mb-5">
            <p className="text-white/50 text-xs font-medium tracking-widest uppercase">Welcome back</p>
            <p className="text-white text-2xl font-bold mt-0.5">{firstName}</p>
            {homeStoreName ? (
              <Link href="/locations" className="inline-flex items-center gap-1.5 mt-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/50">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span className="text-white/60 text-xs font-medium">{homeStoreName}</span>
              </Link>
            ) : (
              <Link href="/locations" className="inline-flex items-center gap-1 mt-1.5">
                <span className="text-white/40 text-xs">Set home store ›</span>
              </Link>
            )}
          </div>

          {/* Stat cards — white, bleed below header */}
          <div className="grid grid-cols-2 gap-2 mb-[-20px]">
            <Link href="/garage" className="bg-white rounded-xl p-3 text-center shadow-md hover:shadow-lg transition-shadow">
              <p className="text-[#1a3d2b] text-xl font-bold">{equipmentCount}</p>
              <p className="text-gray-500 text-xs mt-0.5">Equipment</p>
            </Link>
            <Link href="/service" className="bg-white rounded-xl p-3 text-center shadow-md hover:shadow-lg transition-shadow">
              <p className="text-[#1a3d2b] text-xl font-bold">{activeServiceCount}</p>
              <p className="text-gray-500 text-xs mt-0.5">Active Service</p>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 pt-10 flex flex-col gap-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white rounded-2xl p-3 flex flex-col gap-1 hover:bg-green-50 transition-colors"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="font-bold text-black text-sm">{action.label}</span>
              <span className="text-xs text-gray-700">{action.subtitle}</span>
            </Link>
          ))}
        </div>

        {nextTask ? (
          <div>
            <h2 className="text-lg font-bold text-black mb-2">
              {nextTask.status === "overdue" ? "⚠️ Maintenance Overdue" : "Maintenance Due"}
            </h2>
            <div
              className={`rounded-[20px] p-5 flex flex-col gap-1 ${nextTask.status === "overdue" ? "bg-red-50 border border-red-200" : "bg-white"}`}
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
            >
              <p className="font-bold text-black">{nextTask.equipmentLabel}</p>
              <p className="text-sm text-gray-700">{nextTask.task_name}</p>
              <p className={`text-sm font-semibold ${nextTask.status === "overdue" ? "text-red-600" : "text-amber-700"}`}>
                {nextTask.status === "overdue" ? "Overdue — " : "Due "}
                {nextTask.due_at_date
                  ? new Date(nextTask.due_at_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                  : nextTask.due_at_hours != null
                    ? `at ${nextTask.due_at_hours} hrs`
                    : "soon"}
              </p>
              <Link
                href="/service/new"
                className={`self-start mt-2 min-h-11 flex items-center rounded-lg px-5 font-semibold text-white ${nextTask.status === "overdue" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"} transition-colors`}
              >
                Schedule Service
              </Link>
            </div>
          </div>
        ) : null}

      </div>

      <Link
        href="/service/new"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl font-bold"
        style={{ boxShadow: "0 8px 20px rgba(0,0,0,0.14)" }}
        title="Schedule Service"
      >
        +
      </Link>
    </div>
  );
}
