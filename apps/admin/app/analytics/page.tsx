export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceRoleClient } from "../../lib/supabase/service-role";

type StatCardProps = { label: string; value: number | string; sub?: string; color?: string };

function StatCard({ label, value, sub, color = "text-gray-900" }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-36 shrink-0 capitalize">{label.replace(/_/g, " ")}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
    </div>
  );
}

async function getAnalytics() {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalService },
    { count: openService },
    { count: totalParts },
    { count: openParts },
    { count: totalMessages },
    { count: openMessages },
    { count: totalStorage },
    { count: pendingStorage },
    { count: customers },
    { count: serviceThisWeek },
    { count: partsThisWeek },
    { data: serviceByStatus },
    { data: partsStatusRaw },
    { data: storageStatusRaw },
    { data: recentServiceRows },
  ] = await Promise.all([
    supabase.from("service_requests").select("*", { count: "exact", head: true }),
    supabase.from("service_requests").select("*", { count: "exact", head: true }).in("status", ["submitted", "acknowledged", "scheduled", "in_progress", "awaiting_approval"]),
    supabase.from("parts_requests").select("*", { count: "exact", head: true }),
    supabase.from("parts_requests").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("message_threads").select("*", { count: "exact", head: true }),
    supabase.from("message_threads").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("winter_storage_signups").select("*", { count: "exact", head: true }),
    supabase.from("winter_storage_signups").select("*", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "customer"),
    supabase.from("service_requests").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabase.from("parts_requests").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabase.from("service_requests").select("status").gte("created_at", thirtyDaysAgo),
    supabase.from("parts_requests").select("status").gte("created_at", thirtyDaysAgo),
    supabase.from("winter_storage_signups").select("status"),
    supabase.from("service_requests").select("created_at, status, estimate_approved_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }),
  ]);

  // Avg response time: submitted → acknowledged or in_progress
  const historyRows = recentServiceRows ?? [];
  const approvedWithTime = historyRows.filter((r) => r.estimate_approved_at && r.status === "approved");
  // Days since creation for open requests (backlog age)
  const openRows = historyRows.filter((r) => ["submitted", "acknowledged", "scheduled", "in_progress"].includes(r.status ?? ""));
  const avgBacklogDays = openRows.length > 0
    ? Math.round(openRows.reduce((sum, r) => sum + (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24), 0) / openRows.length)
    : 0;

  // Count by status for service (last 30d)
  const serviceStatusCounts: Record<string, number> = {};
  for (const r of serviceByStatus ?? []) {
    const s = r.status as string;
    serviceStatusCounts[s] = (serviceStatusCounts[s] ?? 0) + 1;
  }

  const storageStatusCounts: Record<string, number> = {};
  for (const r of storageStatusRaw ?? []) {
    const s = r.status as string;
    storageStatusCounts[s] = (storageStatusCounts[s] ?? 0) + 1;
  }

  return {
    totalService: totalService ?? 0,
    openService: openService ?? 0,
    totalParts: totalParts ?? 0,
    openParts: openParts ?? 0,
    totalMessages: totalMessages ?? 0,
    openMessages: openMessages ?? 0,
    totalStorage: totalStorage ?? 0,
    pendingStorage: pendingStorage ?? 0,
    customers: customers ?? 0,
    serviceThisWeek: serviceThisWeek ?? 0,
    partsThisWeek: partsThisWeek ?? 0,
    avgBacklogDays,
    serviceStatusCounts,
    storageStatusCounts,
    estimatesApproved: approvedWithTime.length,
  };
}

export default async function AnalyticsPage() {
  const d = await getAnalytics();

  const serviceStatuses = ["submitted", "acknowledged", "scheduled", "in_progress", "awaiting_approval", "approved", "completed", "cancelled"];
  const storageStatuses = ["requested", "confirmed", "dropped_off", "stored", "picked_up", "cancelled"];
  const maxServiceStatus = Math.max(...serviceStatuses.map((s) => d.serviceStatusCounts[s] ?? 0), 1);
  const maxStorageStatus = Math.max(...storageStatuses.map((s) => d.storageStatusCounts[s] ?? 0), 1);

  const barColors: Record<string, string> = {
    submitted: "bg-yellow-400", acknowledged: "bg-blue-400", scheduled: "bg-indigo-400",
    in_progress: "bg-purple-400", awaiting_approval: "bg-orange-400", approved: "bg-green-400",
    completed: "bg-green-600", cancelled: "bg-gray-300",
    requested: "bg-yellow-400", confirmed: "bg-green-400", dropped_off: "bg-blue-400",
    stored: "bg-purple-400", picked_up: "bg-gray-400",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1a3d2b] text-white px-6 h-14 flex items-center gap-3 shadow-lg">
        <Link href="/" className="text-green-300 hover:text-white text-sm">← Home</Link>
        <span className="text-white/40">|</span>
        <span className="font-semibold text-sm">Analytics</span>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Top-level numbers */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Customers" value={d.customers} />
            <StatCard label="Open Service" value={d.openService} sub={`${d.totalService} total`} color={d.openService > 10 ? "text-red-600" : "text-gray-900"} />
            <StatCard label="Open Messages" value={d.openMessages} sub={`${d.totalMessages} total`} />
            <StatCard label="Pending Storage" value={d.pendingStorage} sub={`${d.totalStorage} total`} />
          </div>
        </section>

        {/* This week */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">This Week (7 days)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="New Service Requests" value={d.serviceThisWeek} />
            <StatCard label="New Parts Requests" value={d.partsThisWeek} />
            <StatCard label="Avg Backlog Age" value={`${d.avgBacklogDays}d`} sub="open service requests" color={d.avgBacklogDays > 5 ? "text-orange-600" : "text-gray-900"} />
            <StatCard label="Estimates Approved" value={d.estimatesApproved} sub="last 30 days" color="text-green-700" />
          </div>
        </section>

        {/* Service by status */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4">Service Requests by Status (last 30 days)</h2>
          <div className="flex flex-col gap-3">
            {serviceStatuses.map((s) => (
              <BarRow key={s} label={s} count={d.serviceStatusCounts[s] ?? 0} max={maxServiceStatus} color={barColors[s] ?? "bg-gray-300"} />
            ))}
          </div>
        </section>

        {/* Storage by status */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4">Winter Storage by Status (all time)</h2>
          <div className="flex flex-col gap-3">
            {storageStatuses.map((s) => (
              <BarRow key={s} label={s} count={d.storageStatusCounts[s] ?? 0} max={maxStorageStatus} color={barColors[s] ?? "bg-gray-300"} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
