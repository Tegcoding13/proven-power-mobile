"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import type { Equipment, EquipmentHourReading, EquipmentDocument, MaintenanceTask } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadEquipmentPhoto, getSignedPhotoUrl } from "../../../lib/equipment-photos";
import { uploadEquipmentDocument, getSignedDocumentUrl } from "../../../lib/equipment-documents";
import { HoursChart } from "../../../components/HoursChart";

async function fetchEquipmentData(id: string) {
  const supabase = createClient();

  const [{ data: equipmentRow }, { data: readingRows }, { data: photoRows }, { data: documentRows }, { data: taskRows }] =
    await Promise.all([
      supabase.from("equipment").select("*").eq("id", id).single(),
      supabase.from("equipment_hour_readings").select("*").eq("equipment_id", id).order("recorded_at", { ascending: false }),
      supabase.from("equipment_photos").select("*").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase.from("equipment_documents").select("*").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase
        .from("maintenance_tasks")
        .select("*")
        .eq("equipment_id", id)
        .in("status", ["upcoming", "due", "overdue"])
        .order("due_at_hours", { ascending: true }),
    ]);

  const urls = await Promise.all(
    (photoRows ?? []).map(async (photo) => ({ id: photo.id, url: await getSignedPhotoUrl(photo.storage_path) }))
  );

  return {
    equipment: equipmentRow ?? null,
    readings: readingRows ?? [],
    documents: documentRows ?? [],
    maintenanceTasks: taskRows ?? [],
    photoUrls: urls.filter((p): p is { id: string; url: string } => Boolean(p.url)),
  };
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    return () => {
      isCurrent = false;
    };
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

    await supabase.from("equipment_hour_readings").insert({
      equipment_id: id,
      hours: Number(newHours),
      recorded_by_profile_id: userData.user.id,
    });
    setNewHours("");
    reload();
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!businessAccount) {
      setUploadError("Still loading your account — try again in a moment.");
      event.target.value = "";
      return;
    }
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setUploadError(null);
    setIsUploadingPhoto(true);
    try {
      await uploadEquipmentPhoto({
        businessAccountId: businessAccount.id,
        equipmentId: id,
        file,
        uploadedByProfileId: userData.user.id,
      });
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
      reload();
    }
  }

  async function handleDocumentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!businessAccount) {
      setUploadError("Still loading your account — try again in a moment.");
      event.target.value = "";
      return;
    }
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setUploadError(null);
    await uploadEquipmentDocument({
      businessAccountId: businessAccount.id,
      equipmentId: id,
      file,
      docType: "other",
      uploadedByProfileId: userData.user.id,
    });
    event.target.value = "";
    reload();
  }

  async function handleOpenDocument(doc: EquipmentDocument) {
    const url = await getSignedDocumentUrl(doc.storage_path);
    if (url) window.open(url, "_blank");
  }

  if (isLoading || !equipment) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-black">
          {equipment.nickname || `${equipment.model_year ?? ""} ${equipment.model}`.trim()}
        </h1>
        <p className="text-gray-700">
          {equipment.make} {equipment.model}
          {equipment.serial_number ? ` · S/N ${equipment.serial_number}` : ""}
        </p>
      </div>

      {(equipment.warranty_expires_at || equipment.powergard_expires_at || maintenanceTasks.length > 0) ? (
        <section>
          <h2 className="text-lg font-bold text-black mb-2">Maintenance</h2>
          {equipment.warranty_expires_at ? (
            <p className="text-sm text-gray-700">Warranty expires {formatDate(equipment.warranty_expires_at)}</p>
          ) : null}
          {equipment.powergard_expires_at ? (
            <p className="text-sm text-gray-700">
              {equipment.powergard_plan_name ?? "PowerGard"} expires {formatDate(equipment.powergard_expires_at)}
            </p>
          ) : null}

          {maintenanceTasks.length > 0 ? (
            <div className="mt-2">
              <p className="font-semibold text-black">What&apos;s due next</p>
              <ul className="flex flex-col">
                {maintenanceTasks.map((task) => (
                  <li key={task.id} className="flex justify-between border-b border-gray-100 py-1">
                    <span className="text-sm text-black">{task.task_name}</span>
                    <span
                      className={`text-xs font-semibold ${
                        task.status === "due" || task.status === "overdue" ? "text-amber-700" : "text-gray-700"
                      }`}
                    >
                      {task.due_at_hours != null ? `${task.due_at_hours} hrs` : ""}
                      {task.due_at_hours != null && task.due_at_date ? " / " : ""}
                      {task.due_at_date ? formatDate(task.due_at_date) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-bold text-black mb-2">Photos</h2>
        {uploadError ? <p className="text-sm text-red-600 mb-2">{uploadError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((photo) => (
            <Image key={photo.id} src={photo.url} alt="Equipment photo" width={120} height={120} className="rounded-lg object-cover" />
          ))}
          <label className="w-[120px] h-[120px] rounded-lg border border-gray-300 flex items-center justify-center cursor-pointer text-green-700 font-semibold">
            {isUploadingPhoto ? "..." : isLoadingAccount ? "Loading..." : "+ Add"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={isLoadingAccount || isUploadingPhoto}
              className="hidden"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-black mb-2">Hours</h2>
        <p className="text-lg text-black mb-2">{equipment.current_hours != null ? `${equipment.current_hours} hrs` : "No readings yet"}</p>
        <HoursChart readings={readings} />
        <form onSubmit={handleLogHours} className="flex gap-2 mt-4">
          <input
            type="number"
            step="0.1"
            placeholder="Log new hours"
            value={newHours}
            onChange={(e) => setNewHours(e.target.value)}
            className="flex-1 min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
          />
          <button type="submit" disabled={!newHours} className="min-h-12 rounded-lg bg-green-600 px-6 font-semibold text-white disabled:opacity-70">
            Log
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-bold text-black mb-2">Documents</h2>
        <ul className="flex flex-col gap-1">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button onClick={() => handleOpenDocument(doc)} className="text-green-700 hover:underline">
                {doc.file_name}
              </button>
            </li>
          ))}
        </ul>
        <label className="mt-2 inline-block min-h-12 leading-[48px] rounded-lg border border-green-600 px-4 font-semibold text-green-700 cursor-pointer">
          {isLoadingAccount ? "Loading..." : "+ Add Document"}
          <input type="file" onChange={handleDocumentChange} disabled={isLoadingAccount} className="hidden" />
        </label>
      </section>
    </div>
  );
}
