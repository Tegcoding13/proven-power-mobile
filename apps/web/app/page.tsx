import Link from "next/link";
import { createClient } from "../lib/supabase/server";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

const QUICK_ACTIONS = [
  { href: "/garage", label: "My Equipment", subtitle: "Manage your garage", icon: "🚜" },
  { href: "/service/new", label: "Schedule Service", subtitle: "Request service", icon: "🔧" },
  { href: "/parts", label: "Parts Store", subtitle: "Order parts", icon: "🛒" },
  { href: "/messages", label: "Messages", subtitle: "Talk to us", icon: "💬" },
  { href: "/service", label: "Service History", subtitle: "Past & active", icon: "📋" },
  { href: "/winter-storage", label: "Winter Storage", subtitle: "Sign up", icon: "❄️" },
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

  let equipmentCount = 0;
  let activeServiceCount = 0;
  let nextTask: { task_name: string; due_at_date: string | null; due_at_hours: number | null; equipmentLabel: string } | null = null;
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
        .in("status", ["upcoming", "due", "overdue"])
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
        };
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div
        className="px-4 pt-6 pb-10"
        style={{ background: "linear-gradient(180deg, #0B5D3B 0%, #042217 100%)" }}
      >
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {initials(profile?.full_name)}
            </div>
            <div>
              <p className="text-white/70 text-sm">Welcome</p>
              <p className="text-white text-xl font-bold">{profile?.full_name?.split(" ")[0] ?? "there"} 👋</p>
            </div>
          </div>
          <Link
            href="/account"
            className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white"
            title="Account"
          >
            👤
          </Link>
        </div>

        <div className="max-w-2xl mx-auto w-full grid grid-cols-3 gap-2 mt-6">
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-bold">{equipmentCount}</p>
            <p className="text-white/80 text-xs">Equipment</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-bold">{activeServiceCount}</p>
            <p className="text-white/80 text-xs">Active Service</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-white/60 text-lg font-bold">Soon</p>
            <p className="text-white/80 text-xs">Rewards</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 -mt-6 flex flex-col gap-6 pb-16">
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
          <div
            className="bg-white rounded-2xl p-3 flex flex-col gap-1 opacity-70"
            style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          >
            <span className="text-2xl">📄</span>
            <span className="font-bold text-black text-sm">Invoices</span>
            <span className="text-xs text-gray-700">Coming soon</span>
          </div>
        </div>

        {nextTask ? (
          <div>
            <h2 className="text-lg font-bold text-black mb-2">Upcoming Service</h2>
            <div className="bg-white rounded-[20px] p-5 flex flex-col gap-1" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <p className="font-bold text-black">{nextTask.equipmentLabel}</p>
              <p className="text-sm text-gray-700">{nextTask.task_name}</p>
              <p className="text-sm font-semibold text-amber-700">
                {nextTask.due_at_date
                  ? `Due ${new Date(nextTask.due_at_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
                  : nextTask.due_at_hours != null
                    ? `Due at ${nextTask.due_at_hours} hrs`
                    : "Due soon"}
              </p>
              <Link
                href="/service/new"
                className="self-start mt-2 min-h-11 flex items-center rounded-lg bg-green-600 px-5 font-semibold text-white"
              >
                Schedule
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
