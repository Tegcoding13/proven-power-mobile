"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Equipment, ServiceRequestType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadServiceRequestMedia } from "../../../lib/service-request-media";
import { PageHeader } from "../../../components/PageHeader";

const REQUEST_TYPES: { value: ServiceRequestType; label: string; icon: string; desc: string }[] = [
  { value: "drop_off", label: "Drop Off", icon: "🚜", desc: "Bring it to us" },
  { value: "pickup_delivery", label: "Pickup & Delivery", icon: "🚛", desc: "We come to you" },
];

const COMMON_SERVICES = [
  "Oil & Filter Change", "Annual Tune-Up", "Blade Sharpening", "Belt Replacement",
  "Battery Replacement", "Air Filter Service", "Tire Repair / Flat", "Engine Won't Start",
  "Hydraulic Issue", "Fuel System Issue",
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}

export default function NewServiceRequestPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [requestType, setRequestType] = useState<ServiceRequestType>("drop_off");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!businessAccount) return;
    createClient().from("equipment").select("*")
      .eq("business_account_id", businessAccount.id).is("deleted_at", null)
      .then(({ data }) => { setEquipmentList(data ?? []); if (data?.[0]) setEquipmentId(data[0].id); });
  }, [businessAccount]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) { setErrorMessage("Still loading your account — try again."); return; }
    if (!equipmentId) { setErrorMessage("Select which piece of equipment this is for."); return; }
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setIsSubmitting(false); return; }

    const fullDescription = [
      selectedServices.length > 0 ? `Services needed: ${selectedServices.join(", ")}` : null,
      description.trim() || null,
    ].filter(Boolean).join("\n\n");

    const { data: created, error } = await supabase.from("service_requests").insert({
      business_account_id: businessAccount.id,
      equipment_id: equipmentId,
      requested_by_profile_id: userData.user.id,
      request_type: requestType,
      description: fullDescription,
    }).select("*").single();

    if (error || !created) { setErrorMessage(error?.message ?? "Failed to submit request."); setIsSubmitting(false); return; }

    for (const file of mediaFiles) {
      try {
        await uploadServiceRequestMedia({ businessAccountId: businessAccount.id, serviceRequestId: created.id, file, mediaType: file.type.startsWith("video") ? "video" : "photo", uploadedByProfileId: userData.user.id });
      } catch { /* best-effort */ }
    }

    router.replace(`/service/${created.id}`);
  }

  const canSubmit = (description.trim() || selectedServices.length > 0) && equipmentId && !isSubmitting && !isLoadingAccount;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Request Service" />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">

        {equipmentList.length > 0 && (
          <Section label="Equipment">
            <div className="flex flex-wrap gap-2">
              {equipmentList.map((eq) => (
                <button type="button" key={eq.id} onClick={() => setEquipmentId(eq.id)}
                  className={`h-10 rounded-xl px-4 text-sm font-semibold transition-all ${equipmentId === eq.id ? "bg-[#1a3d2b] text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {eq.nickname || eq.model}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section label="Request Type">
          <div className="grid grid-cols-2 gap-3">
            {REQUEST_TYPES.map((opt) => (
              <button type="button" key={opt.value} onClick={() => setRequestType(opt.value)}
                className={`h-20 rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all ${requestType === opt.value ? "border-[#1a3d2b] bg-[#1a3d2b]/5" : "border-gray-100 bg-gray-50 hover:border-gray-300"}`}>
                <span className="text-2xl">{opt.icon}</span>
                <span className={`text-sm font-bold ${requestType === opt.value ? "text-[#1a3d2b]" : "text-gray-700"}`}>{opt.label}</span>
                <span className="text-[10px] text-gray-400">{opt.desc}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section label="Common Services">
          <div className="grid grid-cols-2 gap-2">
            {COMMON_SERVICES.map((svc) => {
              const sel = selectedServices.includes(svc);
              return (
                <button type="button" key={svc} onClick={() => setSelectedServices((p) => sel ? p.filter((s) => s !== svc) : [...p, svc])}
                  className={`h-11 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-1.5 ${sel ? "border-[#1a3d2b] bg-[#1a3d2b] text-white" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300"}`}>
                  {sel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  {svc}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Describe the Issue">
          <textarea placeholder="Any extra details about the problem, symptoms, or history…" value={description}
            onChange={(e) => setDescription(e.target.value)} rows={4}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 resize-none" />
        </Section>

        <Section label="Photos / Video">
          <label className="flex items-center justify-center gap-3 h-16 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:border-[#1a3d2b]/40 hover:bg-green-50/30 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={mediaFiles.length > 0 ? "#1a3d2b" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className={`text-sm font-medium ${mediaFiles.length > 0 ? "text-[#1a3d2b]" : "text-gray-500"}`}>
              {mediaFiles.length > 0 ? `${mediaFiles.length} file${mediaFiles.length !== 1 ? "s" : ""} selected` : "Tap to add photos or video"}
            </span>
            <input type="file" accept="image/*,video/*" multiple onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))} className="sr-only" />
          </label>
        </Section>

        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        <button type="submit" disabled={!canSubmit}
          className="h-14 rounded-xl bg-[#1a3d2b] text-white font-bold text-base disabled:opacity-40 hover:bg-[#0f2419] transition-colors shadow-sm">
          {isSubmitting ? "Submitting…" : isLoadingAccount ? "Loading…" : "Submit Service Request"}
        </button>
      </form>
    </div>
  );
}
