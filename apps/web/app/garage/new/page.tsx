"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EquipmentCategory } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadEquipmentPhoto } from "../../../lib/equipment-photos";
import { PageHeader } from "../../../components/PageHeader";

const CATEGORIES: { value: EquipmentCategory; label: string; icon: string }[] = [
  { value: "tractor", label: "Tractor", icon: "🚜" },
  { value: "mower", label: "Mower", icon: "🌿" },
  { value: "utility_vehicle", label: "Utility Vehicle", icon: "🛻" },
  { value: "attachment", label: "Attachment", icon: "🔩" },
  { value: "other", label: "Other", icon: "⚙️" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}{hint && <span className="ml-1.5 text-xs font-normal text-gray-400">{hint}</span>}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = "h-12 rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 w-full";

export default function AddEquipmentPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [model, setModel] = useState("");
  const [make, setMake] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("tractor");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) { setErrorMessage("Still loading your account — try again."); return; }
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setIsSubmitting(false); return; }

    const { data: created, error } = await supabase.from("equipment").insert({
      business_account_id: businessAccount.id,
      added_by_profile_id: userData.user.id,
      model: model.trim(),
      model_year: modelYear ? Number(modelYear) : null,
      serial_number: serialNumber.trim() || null,
      nickname: nickname.trim() || null,
      category,
    }).select("*").single();

    if (error || !created) { setErrorMessage(error?.message ?? "Failed to add equipment."); setIsSubmitting(false); return; }

    if (photoFile) {
      try {
        await uploadEquipmentPhoto({ businessAccountId: businessAccount.id, equipmentId: created.id, file: photoFile, uploadedByProfileId: userData.user.id });
      } catch { /* best-effort */ }
    }

    router.replace(`/garage/${created.id}`);
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Add Equipment" />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">

        {/* photo upload */}
        <label className="relative w-full h-44 rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-gray-200 bg-white hover:border-[#1a3d2b]/40 transition-colors">
          {photoPreview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm font-semibold">Change photo</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Add a photo</p>
              <p className="text-xs text-gray-400">Tap to upload</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
        </label>

        {/* category */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((opt) => (
              <button type="button" key={opt.value} onClick={() => setCategory(opt.value)}
                className={`h-11 rounded-xl px-4 text-sm font-semibold flex items-center gap-2 transition-all border-2 ${category === opt.value ? "border-[#1a3d2b] bg-[#1a3d2b]/5 text-[#1a3d2b]" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200"}`}>
                <span>{opt.icon}</span>{opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* fields */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Equipment Details</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make" hint="optional">
              <input placeholder="e.g. John Deere" value={make} onChange={(e) => setMake(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Model">
              <input placeholder="e.g. 1025R" value={model} onChange={(e) => setModel(e.target.value)} required className={INPUT_CLS} />
            </Field>
            <Field label="Year" hint="optional">
              <input type="number" placeholder="2022" value={modelYear} onChange={(e) => setModelYear(e.target.value)} min="1950" max={new Date().getFullYear() + 1} className={INPUT_CLS} />
            </Field>
            <Field label="Serial #" hint="optional">
              <input placeholder="S/N" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Nickname" hint="optional — shown in lists">
            <input placeholder='e.g. "The Big Green"' value={nickname} onChange={(e) => setNickname(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        <button type="submit" disabled={!model.trim() || isSubmitting || isLoadingAccount}
          className="h-14 rounded-xl bg-[#1a3d2b] text-white font-bold text-base disabled:opacity-40 hover:bg-[#0f2419] transition-colors shadow-sm">
          {isSubmitting ? "Saving…" : isLoadingAccount ? "Loading…" : "Save Equipment"}
        </button>
      </form>
    </div>
  );
}
