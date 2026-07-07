export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { WinterStorageStatus } from "@proven-power/shared-types";
import { createServiceRoleClient } from "../../../../lib/supabase/service-role";

const VALID_STATUSES = ["requested", "confirmed", "dropped_off", "stored", "picked_up", "cancelled"];

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  dropped_off: "bg-blue-100 text-blue-800",
  stored: "bg-purple-100 text-purple-800",
  picked_up: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  dropped_off: "Dropped Off",
  stored: "Stored",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

async function getSignups(status: string) {
  const supabase = createServiceRoleClient();

  const { data: signups } = await supabase
    .from("winter_storage_signups")
    .select("id, status, requested_dropoff_date, requested_pickup_date, created_at, business_account_id, equipment_id")
    .eq("status", status as WinterStorageStatus)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = signups ?? [];
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

  return rows.map((r) => ({
    ...r,
    equipmentLabel: (() => { const eq = equipmentById.get(r.equipment_id ?? ""); return eq?.nickname || eq?.model || eq?.make || "Equipment"; })(),
    accountName: accountById.get(r.business_account_id ?? "")?.name ?? "Customer",
  }));
}

export default async function StorageDetailPage({ params }: { params: { status: string } }) {
  const { status } = params;
  if (!VALID_STATUSES.includes(status)) notFound();

  const signups = await getSignups(status);
  const label = LABELS[status] ?? status;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1a3d2b] text-white px-6 h-14 flex items-center gap-3 shadow-lg">
        <Link href="/analytics" className="text-green-300 hover:text-white text-sm">← Analytics</Link>
        <span className="text-white/40">|</span>
        <span className="font-semibold text-sm">Winter Storage — {label}</span>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Winter Storage — {label}</h1>
            <p className="text-sm text-gray-500 mt-1">{signups.length} signup{signups.length !== 1 ? "s" : ""} · all time</p>
          </div>
          <Link href="/winter-storage" className="text-sm text-green-700 font-semibold hover:underline">
            View full queue →
          </Link>
        </div>

        {signups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No winter storage signups found for this status.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Drop-off Date</th>
                  <th className="px-4 py-3">Pickup Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-green-700">{r.accountName}</td>
                    <td className="px-4 py-3 text-gray-900">{r.equipmentLabel}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.requested_dropoff_date ? new Date(r.requested_dropoff_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.requested_pickup_date ? new Date(r.requested_pickup_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                        {(r.status ?? "").replace(/_/g, " ")}
                      </span>
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
