"use client";

import { useActionState, useState } from "react";
import { inviteStaff } from "./actions";
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

export default function StaffManagementPage() {
  const [error, formAction, isPending] = useActionState(inviteStaff, null);
  const [success, setSuccess] = useState(false);

  async function handleAction(formData: FormData) {
    setSuccess(false);
    await (formAction as (f: FormData) => Promise<void>)(formData);
    if (!error) setSuccess(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminPageHeader title="Staff Management" />

      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Info banner */}
        <div className="rounded-2xl bg-green-50 border border-green-200 p-5 flex gap-3">
          <span className="text-2xl shrink-0">🔒</span>
          <div>
            <p className="font-semibold text-green-900">Invite-only access</p>
            <p className="text-sm text-green-700 mt-1">
              Staff accounts can only be created here by a manager. The invitee receives
              an email with a secure link to set their password — there is no public sign-up
              page on this portal.
            </p>
          </div>
        </div>

        {/* Invite form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-5">
          <h2 className="font-bold text-gray-900 text-lg">Invite a Staff Member</h2>

          <form action={handleAction} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Full Name</label>
                <input
                  name="full_name"
                  required
                  placeholder="Jane Smith"
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="jane@provenpower.com"
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Department</label>
              <select
                name="department"
                required
                defaultValue=""
                className="min-h-10 rounded-lg border border-gray-300 px-3 text-black text-sm bg-white"
              >
                <option value="" disabled>Select a department…</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{DEPT_LABELS[d]}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            {success && !error && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                Invite sent! They will receive an email to set their password.
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="min-h-11 rounded-xl bg-green-700 text-white font-semibold text-sm disabled:opacity-60 hover:bg-green-800 transition-colors"
            >
              {isPending ? "Sending invite…" : "Send Invite"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
          <strong>Note:</strong> After inviting someone, they will appear in your Supabase Auth dashboard.
          To remove a staff member&apos;s access, contact your system administrator or use the Supabase dashboard to disable their account.
        </div>
      </main>
    </div>
  );
}
