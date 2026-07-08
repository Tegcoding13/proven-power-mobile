"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { inviteStaff, updateStaffRole, removeStaff, getStaffList, type StaffMember } from "./actions";
import { AdminPageHeader } from "../../components/AdminPageHeader";

const DEPARTMENTS = ["manager", "service", "parts", "sales", "office"] as const;
type Department = typeof DEPARTMENTS[number];

const DEPT_LABELS: Record<Department, string> = {
  manager: "Manager",
  service: "Service",
  parts: "Parts",
  sales: "Sales",
  office: "Office",
};

const DEPT_COLORS: Record<Department, string> = {
  manager: "bg-purple-100 text-purple-800",
  service: "bg-blue-100 text-blue-800",
  parts: "bg-orange-100 text-orange-800",
  sales: "bg-green-100 text-green-800",
  office: "bg-gray-100 text-gray-700",
};

function StoreLabel({ locationId, locations }: { locationId: string | null; locations: DealershipLocation[] }) {
  if (!locationId) return <span className="text-gray-500">Both stores</span>;
  const loc = locations.find((l) => l.id === locationId);
  return <span>{loc?.name.replace("Proven Power - ", "") ?? "—"}</span>;
}

function StaffCard({
  member,
  locations,
  onUpdated,
}: {
  member: StaffMember;
  locations: DealershipLocation[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dept, setDept] = useState(member.department);
  const [locationId, setLocationId] = useState<string>(member.dealershipLocationId ?? "");
  const [isSaving, startSave] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function handleSave() {
    setError(null);
    startSave(async () => {
      const err = await updateStaffRole(member.profileId, dept, locationId || null);
      if (err) { setError(err); return; }
      setEditing(false);
      onUpdated();
    });
  }

  function handleRemove() {
    startRemove(async () => {
      const err = await removeStaff(member.profileId);
      if (err) { setError(err); return; }
      setConfirmRemove(false);
      onUpdated();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{member.fullName}</p>
          <p className="text-sm text-gray-400 mt-0.5">{member.email}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="min-h-8 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              Edit
            </button>
          )}
          {!confirmRemove && (
            <button onClick={() => setConfirmRemove(true)}
              className="min-h-8 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">
              Remove
            </button>
          )}
        </div>
      </div>

      {/* View mode */}
      {!editing && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_COLORS[member.department as Department] ?? "bg-gray-100 text-gray-700"}`}>
            {DEPT_LABELS[member.department as Department] ?? member.department}
          </span>
          <span className="text-xs text-gray-500">·</span>
          <span className="text-sm text-gray-700">
            <StoreLabel locationId={member.dealershipLocationId} locations={locations} />
          </span>
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="flex flex-col gap-3 pt-1 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Department</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)}
                className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm text-black bg-white">
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Store Access</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
                className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm text-black bg-white">
                <option value="">Both stores</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name.replace("Proven Power - ", "")}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isSaving}
              className="min-h-9 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setDept(member.department); setLocationId(member.dealershipLocationId ?? ""); setError(null); }}
              className="min-h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {confirmRemove && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-red-800">Remove {member.fullName}?</p>
          <p className="text-xs text-red-700">This will revoke their access and delete their staff account. This cannot be undone.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleRemove} disabled={isRemoving}
              className="min-h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
              {isRemoving ? "Removing…" : "Yes, remove"}
            </button>
            <button onClick={() => { setConfirmRemove(false); setError(null); }}
              className="min-h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteError, formAction, isPending] = useActionState(inviteStaff, null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function load() {
    const [staffList, { data: locs }] = await Promise.all([
      getStaffList(),
      createClient().from("dealership_locations").select("*").order("name"),
    ]);
    setStaff(staffList);
    setLocations(locs ?? []);
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(formData: FormData) {
    setInviteSuccess(false);
    await (formAction as (f: FormData) => Promise<void>)(formData);
    if (!inviteError) {
      setInviteSuccess(true);
      load();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminPageHeader title="Staff Management" />

      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Current staff list */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">Current Staff</h2>
            <p className="text-xs text-gray-400">{staff.length} member{staff.length !== 1 ? "s" : ""}</p>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : staff.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-400">
              No staff members yet — invite someone below.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {staff.map((m) => (
                <StaffCard key={m.profileId} member={m} locations={locations} onUpdated={load} />
              ))}
            </div>
          )}

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
            <strong>Store access:</strong> Staff assigned to a specific store only see requests, queues, and customers for that store. Set to <strong>Both stores</strong> for managers or anyone who covers both locations.
          </div>
        </section>

        {/* Invite form */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
          <h2 className="font-bold text-gray-900 text-lg">Invite a Staff Member</h2>
          <p className="text-sm text-gray-500">
            The invitee receives an email with a secure link to set their password. There is no public sign-up page.
          </p>

          <form action={handleInvite} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Full Name</label>
                <input name="full_name" required placeholder="Jane Smith"
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <input name="email" type="email" required placeholder="jane@provenpower.com"
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Department</label>
                <select name="department" required defaultValue=""
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm bg-white">
                  <option value="" disabled>Select department…</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Store Access</label>
                <select name="location_id" defaultValue=""
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm bg-white">
                  <option value="">Both stores</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name.replace("Proven Power - ", "")}</option>
                  ))}
                </select>
              </div>
            </div>

            {inviteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</p>
            )}
            {inviteSuccess && !inviteError && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                Invite sent! They will receive an email to set their password.
              </p>
            )}

            <button type="submit" disabled={isPending}
              className="min-h-11 rounded-xl bg-green-700 text-white font-semibold text-sm disabled:opacity-60 hover:bg-green-800 transition-colors">
              {isPending ? "Sending invite…" : "Send Invite"}
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}
