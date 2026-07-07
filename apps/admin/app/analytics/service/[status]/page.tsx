export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ServiceRequestStatus } from "@proven-power/shared-types";
import { createServiceRoleClient } from "../../../../lib/supabase/service-role";
import { StatusBadge } from "../../../../components/StatusBadge";
import { AdminPageHeader } from "../../../../components/AdminPageHeader";

const VALID_STATUSES = ["submitted", "acknowledged", "scheduled", "in_progress", "awaiting_approval", "approved", "completed", "cancelled", "open", "new-this-week"];

const LABELS: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  open: "Open (All Active)",
  "new-this-week": "New This Week",
};

const OPEN_STATUSES = ["submitted", "acknowledged", "scheduled", "in_progress", "awaiting_approval"];

async function getRequests(status: string) {
  const supabase = createServiceRoleClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("service_requests")
    .select("id, status, request_type, description, created_at, estimate_approved_at, equipment_id, business_account_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "open") {
    query = query.in("status", OPEN_STATUSES as ServiceRequestStatus[]);
  } else if (status === "new-this-week") {
    query = query.gte("created_at", sevenDaysAgo);
  } else {
    query = query.eq("status", status as ServiceRequestStatus).gte("created_at", thirtyDaysAgo);
  }

  const { data: requests } = await query;
  const rows = requests ?? [];

  const equipmentIds = [...new Set(rows.map((r) => r.equipment_id).filter(Boolean))];
  const accountIds = [...new Set(rows.map((r) => r.business_account_id).filter(Boolean))];

  const [{ data: equipmentRows }, { data: accountRows }] = await Promise.all([
    equipmentIds.length
      ? supabase.from("equipment").select("id, nickname, model, make").in("id", equipmentIds as string[])
      : Promise.resolve({ data: [] }),
    accountIds.length
      ? supabase.from("business_accounts").select("id, name").in("id", accountIds as string[])
      : Promise.resolve({ data: [] }),
  ]);

  const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));
  const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));

  return rows.map((r) => {
    const eq = equipmentById.get(r.equipment_id ?? "");
    const acct = accountById.get(r.business_account_id ?? "");
    return {
      ...r,
      equipmentLabel: eq?.nickname || eq?.model || eq?.make || "Equipment",
      accountName: acct?.name ?? "Customer",
    };
  });
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ status: string }> }) {
  const { status } = await params;
  if (!VALID_STATUSES.includes(status)) notFound();

  const requests = await getRequests(status);
  const label = LABELS[status] ?? status;
  const isTimeFiltered = status !== "open" && status !== "new-this-week" && status !== "completed" && status !== "cancelled";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminPageHeader title={`Service — ${label}`} backHref="/analytics" backLabel="Analytics" />

      <main className="max-w-4xl w-full mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Requests — {label}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {requests.length} request{requests.length !== 1 ? "s" : ""}
              {isTimeFiltered ? " · last 30 days" : status === "new-this-week" ? " · last 7 days" : ""}
            </p>
          </div>
          <Link href="/service" className="text-sm text-green-700 font-semibold hover:underline">
            View full queue →
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No service requests found for this filter.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/service/${r.id}`} className="font-semibold text-green-700 hover:underline">
                        {r.accountName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{r.equipmentLabel}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{(r.request_type ?? "").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status ?? ""} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
