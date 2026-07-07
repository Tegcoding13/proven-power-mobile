"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Equipment, PartsRequestType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadPartsRequestMedia } from "../../../lib/parts-request-media";
import { PageHeader } from "../../../components/PageHeader";

const REQUEST_TYPES: { value: PartsRequestType; label: string; icon: string; desc: string }[] = [
  { value: "part_order", label: "Order a Part", icon: "📦", desc: "I know what I need" },
  { value: "stock_check", label: "Is It In Stock?", icon: "🔍", desc: "Quick availability check" },
  { value: "broken_part_id", label: "ID a Broken Part", icon: "🔩", desc: "Help me figure it out" },
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}

export default function NewPartsRequestPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [requestType, setRequestType] = useState<PartsRequestType>("part_order");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!businessAccount) return;
    createClient().from("equipment").select("*")
      .eq("business_account_id", businessAccount.id).is("deleted_at", null)
      .then(({ data }) => setEquipmentList(data ?? []));
  }, [businessAccount]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) { setErrorMessage("Still loading your account — try again."); return; }
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setIsSubmitting(false); return; }

    const { data: created, error } = await supabase.from("parts_requests").insert({
      business_account_id: businessAccount.id,
      equipment_id: equipmentId || null,
      requested_by_profile_id: userData.user.id,
      request_type: requestType,
      description: description.trim(),
    }).select("*").single();

    if (error || !created) { setErrorMessage(error?.message ?? "Failed to submit request."); setIsSubmitting(false); return; }

    if (photoFile) {
      try {
        await uploadPartsRequestMedia({ businessAccountId: businessAccount.id, partsRequestId: created.id, file: photoFile, uploadedByProfileId: userData.user.id });
      } catch { /* best-effort */ }
    }

    router.replace(`/parts/${created.id}`);
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Request Parts" />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">

        <Section label="Request Type">
          <div className="grid grid-cols-3 gap-2">
            {REQUEST_TYPES.map((opt) => (
              <button type="button" key={opt.value} onClick={() => setRequestType(opt.value)}
                className={`py-4 rounded-xl flex flex-col items-center gap-1.5 border-2 transition-all ${requestType === opt.value ? "border-[#1a3d2b] bg-[#1a3d2b]/5" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}>
                <span className="text-2xl">{opt.icon}</span>
                <span className={`text-xs font-bold text-center leading-tight ${requestType === opt.value ? "text-[#1a3d2b]" : "text-gray-700"}`}>{opt.label}</span>
                <span className="text-[10px] text-gray-400 text-center">{opt.desc}</span>
              </button>
            ))}
          </div>
        </Section>

        {equipmentList.length > 0 && (
          <Section label="Equipment (optional)">
            <div className="flex flex-wrap gap-2">
              {equipmentList.map((eq) => (
                <button type="button" key={eq.id} onClick={() => setEquipmentId(equipmentId === eq.id ? "" : eq.id)}
                  className={`h-10 rounded-xl px-4 text-sm font-semibold transition-all ${equipmentId === eq.id ? "bg-[#1a3d2b] text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {eq.nickname || eq.model}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section label="Description">
          <textarea placeholder={requestType === "broken_part_id" ? "Describe the broken part — where it's located, what it looks like, any numbers stamped on it…" : "What part do you need? Include model numbers if you have them."}
            value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 resize-none" />
        </Section>

        <Section label="Photo">
          <label className={`flex items-center justify-center gap-3 h-16 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${photoFile ? "border-[#1a3d2b]/40 bg-green-50/30" : "border-gray-200 bg-gray-50 hover:border-[#1a3d2b]/30"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={photoFile ? "#1a3d2b" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className={`text-sm font-medium ${photoFile ? "text-[#1a3d2b]" : "text-gray-500"}`}>
              {photoFile ? photoFile.name : "Attach a photo"}
            </span>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        </Section>

        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        <button type="submit" disabled={!description.trim() || isSubmitting || isLoadingAccount}
          className="h-14 rounded-xl bg-[#1a3d2b] text-white font-bold text-base disabled:opacity-40 hover:bg-[#0f2419] transition-colors shadow-sm">
          {isSubmitting ? "Submitting…" : isLoadingAccount ? "Loading…" : "Submit Parts Request"}
        </button>
      </form>
    </div>
  );
}
