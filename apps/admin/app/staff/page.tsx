"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { createStaff, updateStaffRole, updateStaffPassword, removeStaff, getStaffList, type StaffMember } from "./actions";
import { AdminPageHeader } from "../../components/AdminPageHeader";

const DEPARTMENTS = ["manager", "service", "parts", "sales", "office"] as const;
type Department = typeof DEPARTMENTS[number];

const DEPT_LABELS: Record<Department, string> = {
  manager: "Manager", service: "Service", parts: "Parts", sales: "Sales", office: "Office",
};

const DEPT_COLORS: Record<Department, string> = {
  manager: "bg-purple-100 text-purple-800",
  service: "bg-blue-100 text-blue-800",
  parts: "bg-orange-100 text-orange-800",
  sales: "bg-green-100 text-green-800",
  office: "bg-gray-100 text-gray-700",
};

function StaffCard({ member, locations, onUpdated }: { member: StaffMember; locations: DealershipLocation[]; onUpdated: () => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "password" | "remove">("view");
  const [dept, setDept] = useState(member.department);
  const [locationId, setLocationId] = useState(member.dealershipLocationId ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, startSave] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function cancel() { setMode("view"); setError(null); setSuccess(null); setNewPassword(""); setConfirmPassword(""); }

  function handleSaveRole() {
    setError(null);
    startSave(async () => {
      const err = await updateStaffRole(member.profileId, dept, locationId || null);
      if (err) { setError(err); return; }
      setMode("view");
      onUpdated();
    });
  }

  function handleSetPassword() {
    setError(null);
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    startSave(async () => {
      const err = await updateStaffPassword(member.profileId, newPassword);
      if (err) { setError(err); return; }
      setSuccess("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setMode("view"); setSuccess(null); }, 1500);
    });
  }

  function handleRemove() {
    startRemove(async () => {
      const err = await removeStaff(member.profileId);
      if (err) { setError(err); return; }
      onUpdated();
    });
  }

  const locName = (id: string | null) => {
    if (!id) return "Both stores";
    return locations.find((l) => l.id === id)?.name.replace("Proven Power - ", "") ?? "—";
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{member.fullName}</p>
          <p className="text-sm text-gray-400 mt-0.5">{member.email}</p>
        </div>
        {mode === "view" && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setMode("edit")} className="min-h-8 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">Edit</button>
            <button onClick={() => setMode("password")} className="min-h-8 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">Password</button>
            <button onClick={() => setMode("remove")} className="min-h-8 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
          </div>
        )}
      </div>

      {/* View */}
      {mode === "view" && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_COLORS[member.department as Department] ?? "bg-gray-100 text-gray-700"}`}>
            {DEPT_LABELS[member.department as Department] ?? member.department}
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-sm text-gray-700">{locName(member.dealershipLocationId)}</span>
        </div>
      )}

      {/* Edit role */}
      {mode === "edit" && (
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
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Proven Power - ", "")}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSaveRole} disabled={isSaving} className="min-h-9 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Saving…" : "Save"}</button>
            <button onClick={cancel} className="min-h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Set password */}
      {mode === "password" && (
        <div className="flex flex-col gap-3 pt-1 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Set a new password for {member.fullName}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters" autoComplete="new-password"
                className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm text-black" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Same password again" autoComplete="new-password"
                className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm text-black" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-green-700 font-semibold">{success}</p>}
          <div className="flex gap-2">
            <button onClick={handleSetPassword} disabled={isSaving || !newPassword || !confirmPassword}
              className="min-h-9 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? "Updating…" : "Update Password"}
            </button>
            <button onClick={cancel} className="min-h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {mode === "remove" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-red-800">Remove {member.fullName}?</p>
          <p className="text-xs text-red-700">This revokes their access and deletes their staff account permanently.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleRemove} disabled={isRemoving} className="min-h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{isRemoving ? "Removing…" : "Yes, remove"}</button>
            <button onClick={cancel} className="min-h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">Cancel</button>
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
  const [createError, formAction, isPending] = useActionState(createStaff, null);
  const [createSuccess, setCreateSuccess] = useState(false);

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

  async function handleCreate(formData: FormData) {
    setCreateSuccess(false);
    await (formAction as (f: FormData) => Promise<void>)(formData);
    if (!createError) { setCreateSuccess(true); load(); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminPageHeader title="Staff Management" />

      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Current staff */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">Current Staff</h2>
            <p className="text-xs text-gray-400">{staff.length} member{staff.length !== 1 ? "s" : ""}</p>
          </div>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : staff.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-400">No staff yet — add someone below.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {staff.map((m) => <StaffCard key={m.profileId} member={m} locations={locations} onUpdated={load} />)}
            </div>
          )}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
            <strong>Store access:</strong> Staff assigned to a specific store only see that store's queues and customers. Set to <strong>Both stores</strong> for managers or staff covering both locations.
          </div>
        </section>

        {/* Add staff */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
          <h2 className="font-bold text-gray-900 text-lg">Add Staff Member</h2>
          <p className="text-sm text-gray-500">Creates an account immediately — share the email and password with the new staff member directly.</p>

          <form action={handleCreate} className="flex flex-col gap-4">
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
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Proven Power - ", "")}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <input name="password" type="password" required placeholder="Min 8 characters" autoComplete="new-password"
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm" />
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}
            {createSuccess && !createError && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                Staff account created. Share the email and password with them directly.
              </p>
            )}

            <button type="submit" disabled={isPending}
              className="min-h-11 rounded-xl bg-green-700 text-white font-semibold text-sm disabled:opacity-60 hover:bg-green-800 transition-colors">
              {isPending ? "Creating…" : "Create Account"}
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}
