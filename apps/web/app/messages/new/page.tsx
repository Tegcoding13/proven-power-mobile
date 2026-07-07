"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MessageDepartment } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { PageHeader } from "../../../components/PageHeader";

const DEPARTMENTS: { value: MessageDepartment; label: string; icon: string; desc: string; color: string }[] = [
  { value: "service", label: "Service", icon: "🔧", desc: "Repairs, maintenance, scheduling", color: "border-purple-200 data-[sel=true]:border-purple-500 data-[sel=true]:bg-purple-50" },
  { value: "parts", label: "Parts", icon: "⚙️", desc: "Parts orders and availability", color: "border-blue-200 data-[sel=true]:border-blue-500 data-[sel=true]:bg-blue-50" },
  { value: "sales", label: "Sales", icon: "🚜", desc: "New equipment and financing", color: "border-green-200 data-[sel=true]:border-[#1a3d2b] data-[sel=true]:bg-green-50" },
  { value: "office", label: "Office", icon: "📋", desc: "Billing, accounts, general", color: "border-gray-200 data-[sel=true]:border-gray-500 data-[sel=true]:bg-gray-50" },
];

export default function NewMessagePage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [department, setDepartment] = useState<MessageDepartment>("service");
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) { setErrorMessage("Still loading your account — try again."); return; }
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setIsSubmitting(false); return; }

    const { data: thread, error: threadError } = await supabase.from("message_threads")
      .insert({ business_account_id: businessAccount.id, department }).select("*").single();

    if (threadError || !thread) { setErrorMessage(threadError?.message ?? "Failed to start conversation."); setIsSubmitting(false); return; }

    await supabase.from("messages").insert({
      thread_id: thread.id,
      sender_profile_id: userData.user.id,
      sender_type: "customer",
      body: body.trim(),
    });

    router.replace(`/messages/${thread.id}`);
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="New Message" />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">

        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Who would you like to reach?</p>
          <div className="grid grid-cols-2 gap-3">
            {DEPARTMENTS.map((dept) => (
              <button type="button" key={dept.value} onClick={() => setDepartment(dept.value)}
                data-sel={department === dept.value}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 transition-all text-left ${department === dept.value ? "border-[#1a3d2b] bg-[#1a3d2b]/5" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}>
                <span className="text-xl">{dept.icon}</span>
                <span className={`text-sm font-bold ${department === dept.value ? "text-[#1a3d2b]" : "text-gray-800"}`}>{dept.label}</span>
                <span className="text-[11px] text-gray-400 leading-tight">{dept.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Message</p>
          <textarea placeholder="What can we help with? The more detail you share, the faster we can assist."
            value={body} onChange={(e) => setBody(e.target.value)} rows={5}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 resize-none" />
        </div>

        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        <button type="submit" disabled={!body.trim() || isSubmitting || isLoadingAccount}
          className="h-14 rounded-xl bg-[#1a3d2b] text-white font-bold text-base disabled:opacity-40 hover:bg-[#0f2419] transition-colors shadow-sm flex items-center justify-center gap-2">
          {isSubmitting ? "Sending…" : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
