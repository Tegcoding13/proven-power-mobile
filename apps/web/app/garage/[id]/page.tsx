"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Equipment, EquipmentHourReading, EquipmentDocument, MaintenanceTask } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadEquipmentPhoto, getSignedPhotoUrl } from "../../../lib/equipment-photos";
import { uploadEquipmentDocument, getSignedDocumentUrl } from "../../../lib/equipment-documents";
import { HoursChart } from "../../../components/HoursChart";
import { PageHeader } from "../../../components/PageHeader";

async function fetchEquipmentData(id: string) {
  const supabase = createClient();
  const [{ data: equipmentRow }, { data: readingRows }, { data: photoRows }, { data: documentRows }, { data: taskRows }] = await Promise.all([
    supabase.from("equipment").select("*").eq("id", id).single(),
    supabase.from("equipment_hour_readings").select("*").eq("equipment_id", id).order("recorded_at", { ascending: false }),
    supabase.from("equipment_photos").select("*").eq("equipment_id", id).order("created_at", { ascending: false }),
    supabase.from("equipment_documents").select("*").eq("equipment_id", id).order("created_at", { ascending: false }),
    supabase.from("maintenance_tasks").select("*").eq("equipment_id", id).in("status", ["upcoming","due","overdue"]).order("due_at_hours", { ascending: true }),
  ]);

  const urls = await Promise.all((photoRows ?? []).map(async (p) => ({ id: p.id, url: await getSignedPhotoUrl(p.storage_path) })));
  return {
    equipment: equipmentRow ?? null,
    readings: readingRows ?? [],
    documents: documentRows ?? [],
    maintenanceTasks: taskRows ?? [],
    photoUrls: urls.filter((p): p is { id: string; url: string } => Boolean(p.url)),
  };
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const TASK_STATUS_STYLE: Record<string, string> = {
  due:     "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  upcoming:"bg-gray-50 text-gray-600",
};

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<EquipmentHourReading[]>([]);
  const [photoUrls, setPhotoUrls] = useState<{ id: string; url: string }[]>([]);
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newHours, setNewHours] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    fetchEquipmentData(id).then((result) => {
      if (!isCurrent) return;
      setEquipment(result.equipment);
      setReadings(result.readings);
      setDocuments(result.documents);
      setMaintenanceTasks(result.maintenanceTasks);
      setPhotoUrls(result.photoUrls);
      setIsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [id]);

  async function reload() {
    const result = await fetchEquipmentData(id);
    setEquipment(result.equipment);
    setReadings(result.readings);
    setDocuments(result.documents);
    setMaintenanceTasks(result.maintenanceTasks);
    setPhotoUrls(result.photoUrls);
  }

  async function handleLogHours(event: React.FormEvent) {
    event.preventDefault();
    if (!newHours) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("equipment_hour_readings").insert({ equipment_id: id, hours: Number(newHours), recorded_by_profile_id: userData.user.id });
    setNewHours("");
    reload();
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!businessAccount) { setUploadError("Still loading your account — try again."); event.target.value = ""; return; }
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setUploadError(null);
    setIsUploadingPhoto(true);
    try {
      await uploadEquipmentPhoto({ businessAccountId: businessAccount.id, equipmentId: id, file, uploadedByProfileId: userData.user.id });
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
      reload();
    }
  }

  async function handleDocumentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !businessAccount) { event.target.value = ""; return; }
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await uploadEquipmentDocument({ businessAccountId: businessAccount.id, equipmentId: id, file, docType: "other", uploadedByProfileId: userData.user.id });
    event.target.value = "";
    reload();
  }

  async function handleRemove() {
    setIsRemoving(true);
    setRemoveError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("equipment")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    setIsRemoving(false);
    if (error) { setRemoveError("Could not remove — please try again."); return; }
    router.replace("/garage");
  }

  async function handleOpenDocument(doc: EquipmentDocument) {
    const url = await getSignedDocumentUrl(doc.storage_path);
    if (url) window.open(url, "_blank");
  }

  const equipmentName = equipment?.nickname || `${equipment?.model_year ?? ""} ${equipment?.model ?? ""}`.trim() || "Equipment";

  if (isLoading || !equipment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Equipment" />
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title={equipmentName} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">

        {/* hero */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {photoUrls[0] && (
            <div className="h-52 overflow-hidden">
              <Image src={photoUrls[0].url} alt={equipmentName} width={640} height={208} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="px-5 py-4">
            <p className="font-bold text-gray-900 text-lg leading-tight">{equipmentName}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {[equipment.make, equipment.model].filter(Boolean).join(" ")}
              {equipment.model_year ? ` · ${equipment.model_year}` : ""}
              {equipment.serial_number ? ` · S/N ${equipment.serial_number}` : ""}
            </p>
            {equipment.current_hours != null && (
              <div className="mt-3 inline-flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-sm font-semibold text-gray-700">{equipment.current_hours} hrs</span>
              </div>
            )}
          </div>
          <div className="px-5 pb-4">
            <Link href={`/service/new?equipment=${id}`}
              className="w-full h-11 rounded-xl bg-[#1a3d2b] text-white text-sm font-bold flex items-center justify-center hover:bg-[#0f2419] transition-colors">
              Request Service
            </Link>
          </div>
        </div>

        {/* maintenance */}
        {(equipment.warranty_expires_at || equipment.powergard_expires_at || maintenanceTasks.length > 0) && (
          <Section title="Maintenance">
            <div className="flex flex-col gap-3">
              {equipment.warranty_expires_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Warranty expires</span>
                  <span className="font-semibold text-gray-900">{formatDate(equipment.warranty_expires_at)}</span>
                </div>
              )}
              {equipment.powergard_expires_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{equipment.powergard_plan_name ?? "PowerGard"} expires</span>
                  <span className="font-semibold text-gray-900">{formatDate(equipment.powergard_expires_at)}</span>
                </div>
              )}
              {maintenanceTasks.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">What's Due Next</p>
                  <div className="flex flex-col gap-2">
                    {maintenanceTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-800">{task.task_name}</span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TASK_STATUS_STYLE[task.status] ?? "bg-gray-50 text-gray-600"}`}>
                          {task.due_at_hours != null ? `${task.due_at_hours} hrs` : ""}
                          {task.due_at_hours != null && task.due_at_date ? " / " : ""}
                          {task.due_at_date ? formatDate(task.due_at_date) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* hours */}
        <Section title="Hours" action={
          <span className="text-xl font-bold text-gray-900">{equipment.current_hours != null ? `${equipment.current_hours} hrs` : "—"}</span>
        }>
          <HoursChart readings={readings} />
          <form onSubmit={handleLogHours} className="flex gap-2 mt-2">
            <input type="number" step="0.1" placeholder="Log new reading…" value={newHours}
              onChange={(e) => setNewHours(e.target.value)}
              className="flex-1 h-11 rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30" />
            <button type="submit" disabled={!newHours}
              className="h-11 px-5 rounded-xl bg-[#1a3d2b] text-white text-sm font-bold disabled:opacity-40 hover:bg-[#0f2419] transition-colors">
              Log
            </button>
          </form>
        </Section>

        {/* photos */}
        <Section title="Photos" action={
          <label className={`text-xs font-bold text-[#1a3d2b] cursor-pointer hover:text-[#0f2419] ${isUploadingPhoto || isLoadingAccount ? "opacity-40" : ""}`}>
            {isUploadingPhoto ? "Uploading…" : "+ Add"}
            <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={isLoadingAccount || isUploadingPhoto} className="sr-only" />
          </label>
        }>
          {uploadError && <p className="text-sm text-red-600 mb-2">{uploadError}</p>}
          {photoUrls.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No photos yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden">
                  <Image src={photo.url} alt="Equipment" width={160} height={160} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* documents */}
        <Section title="Documents" action={
          <label className={`text-xs font-bold text-[#1a3d2b] cursor-pointer hover:text-[#0f2419] ${isLoadingAccount ? "opacity-40" : ""}`}>
            + Add
            <input type="file" onChange={handleDocumentChange} disabled={isLoadingAccount} className="sr-only" />
          </label>
        }>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No documents yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => (
                <button key={doc.id} onClick={() => handleOpenDocument(doc)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700 font-medium truncate">{doc.file_name}</span>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* remove from garage */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Remove Equipment</p>
          {!confirmRemove ? (
            <button
              onClick={() => setConfirmRemove(true)}
              className="mt-1 text-sm font-semibold text-red-500 hover:text-red-700 transition-colors text-left"
            >
              Remove from My Garage
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">Sold or got rid of it? This removes it from your garage and service history.</p>
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="text-sm font-bold text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                >
                  {isRemoving ? "Removing…" : "Yes, remove it"}
                </button>
                <button
                  onClick={() => { setConfirmRemove(false); setRemoveError(null); }}
                  className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Keep it
                </button>
              </div>
              {removeError && <p className="text-xs text-red-500">{removeError}</p>}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
