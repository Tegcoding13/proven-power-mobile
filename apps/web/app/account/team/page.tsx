"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BusinessAccountMember, BusinessAccountRole } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";

type MemberWithName = BusinessAccountMember & { fullName: string | null };

const ROLES: BusinessAccountRole[] = ["owner", "manager", "operator"];

export default function TeamPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [members, setMembers] = useState<MemberWithName[]>([]);
  const [myRole, setMyRole] = useState<BusinessAccountRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessAccountRole>("operator");
  const [isInviting, setIsInviting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchTeamData(businessAccountId: string): Promise<{ myRole: BusinessAccountRole | null; members: MemberWithName[] }> {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const { data: memberRows } = await supabase
      .from("business_account_members")
      .select("*")
      .eq("business_account_id", businessAccountId)
      .order("created_at", { ascending: true });

    const mine = (memberRows ?? []).find((m) => m.profile_id === userData.user?.id);

    const profileIds = (memberRows ?? []).map((m) => m.profile_id).filter((id): id is string => !!id);
    const { data: profileRows } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));

    return {
      myRole: mine?.role ?? null,
      members: (memberRows ?? []).map((m) => ({ ...m, fullName: m.profile_id ? (nameById.get(m.profile_id) ?? null) : null })),
    };
  }

  async function load(businessAccountId: string) {
    const { myRole: role, members: rows } = await fetchTeamData(businessAccountId);
    setMyRole(role);
    setMembers(rows);
  }

  useEffect(() => {
    if (!businessAccount) return;
    fetchTeamData(businessAccount.id).then(({ myRole: role, members: rows }) => {
      setMyRole(role);
      setMembers(rows);
      setIsLoading(false);
    });
  }, [businessAccount]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount || !email.trim()) return;
    setIsInviting(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("invite_team_member", {
      p_business_account_id: businessAccount.id,
      p_email: email.trim(),
      p_role: role,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsInviting(false);
      return;
    }

    setEmail("");
    setIsInviting(false);
    load(businessAccount.id);
  }

  async function handleRemove(memberId: string) {
    if (!businessAccount || !confirm("Remove this team member?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("business_account_members").delete().eq("id", memberId);
    if (error) setErrorMessage(error.message);
    load(businessAccount.id);
  }

  async function handleRoleChange(memberId: string, newRole: BusinessAccountRole) {
    if (!businessAccount) return;
    const supabase = createClient();
    const { error } = await supabase.from("business_account_members").update({ role: newRole }).eq("id", memberId);
    if (error) setErrorMessage(error.message);
    load(businessAccount.id);
  }

  const canManage = myRole === "owner";

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/account" className="text-sm text-green-700">
        ← Back to Account
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Business Account & Team</h1>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {isLoadingAccount || isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : !businessAccount ? (
        <p className="text-gray-700">No business account found.</p>
      ) : (
        <>
          {canManage ? (
            <form onSubmit={handleInvite} className="flex flex-col gap-3 rounded-lg border border-gray-300 p-4">
              <p className="font-semibold text-black">Invite a Team Member</p>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
              />
              <div className="flex gap-2">
                {ROLES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setRole(option)}
                    className={`min-h-12 flex-1 rounded-lg font-semibold capitalize ${role === option ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!email.trim() || isInviting}
                className="self-start min-h-12 rounded-lg bg-green-600 px-6 font-semibold text-white disabled:opacity-70"
              >
                {isInviting ? "Sending..." : "Invite"}
              </button>
            </form>
          ) : null}

          <ul className="flex flex-col gap-3">
            {members.map((member) => (
              <li key={member.id} className="rounded-lg border border-gray-300 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-black">
                    {member.fullName ?? member.invited_email ?? "Pending"}
                    {member.status === "invited" ? <span className="text-xs text-amber-700 ml-2">Invite pending</span> : null}
                  </p>
                  <p className="text-sm text-gray-700 capitalize">{member.role}</p>
                </div>
                {canManage && member.role !== "owner" ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as BusinessAccountRole)}
                      className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm text-black"
                    >
                      {ROLES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="min-h-10 rounded-full px-3 text-xs font-semibold border border-red-600 text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
