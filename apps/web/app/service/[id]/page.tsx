"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ServiceRequest, ServiceRequestStatusHistory, Equipment, ServiceRequestMediaType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedServiceRequestMediaUrl } from "../../../lib/service-request-media";
import { StatusBadge } from "../../../components/StatusBadge";
import { PageHeader } from "../../../components/PageHeader";

function relativeDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fullTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

// ─── Multi-step approval modal ────────────────────────────────────────────────

type ApprovalModalProps = {
  amount: number;
  notes: string | null;
  equipmentName: string;
  requestId: string;
  onApproved: (updatedRequest: ServiceRequest) => void;
  onClose: () => void;
};

function ApprovalModal({ amount, notes, equipmentName, requestId, onApproved, onClose }: ApprovalModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);

  async function handleConfirm() {
    setIsSubmitting(true);
    setError(null);
    const { data: updated, error: rpcError } = await createClient().rpc("approve_service_estimate", { p_service_request_id: requestId });
    if (rpcError || !updated) {
      setError(rpcError?.message ?? "Failed to record approval. Please try again.");
      setIsSubmitting(false);
      return;
    }
    setApprovedAt(new Date().toISOString());
    setStep(3);
    setIsSubmitting(false);
    onApproved(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step < 3 ? onClose : undefined} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* step 1 — review */}
        {step === 1 && (
          <div className="p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Step 1 of 2 — Review Estimate</p>
                <p className="text-xl font-bold text-gray-900 mt-1">Review Before Approving</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Equipment</span>
                <span className="text-sm font-semibold text-gray-900">{equipmentName}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Estimate Total</span>
                <span className="text-2xl font-bold text-gray-900">${amount.toLocaleString()}</span>
              </div>
              {notes && (
                <>
                  <div className="h-px bg-gray-200" />
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes from Proven Power</span>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{notes}</p>
                  </div>
                </>
              )}
            </div>

            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
              <strong>Important:</strong> Approving this estimate authorizes Proven Power to perform the described work. You will be billed the approved amount upon completion.
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Not Yet
              </button>
              <button onClick={() => setStep(2)}
                className="flex-1 h-12 rounded-xl bg-[#1a3d2b] text-white font-bold text-sm hover:bg-[#0f2419] transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* step 2 — acknowledge + confirm */}
        {step === 2 && (
          <div className="p-6 flex flex-col gap-5">
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Step 2 of 2 — Authorize Work</p>
              <p className="text-xl font-bold text-gray-900 mt-1">Confirm Your Approval</p>
            </div>

            <div className="bg-[#1a3d2b]/5 border border-[#1a3d2b]/20 rounded-2xl p-4 text-center">
              <p className="text-4xl font-bold text-[#1a3d2b]">${amount.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">{equipmentName}</p>
            </div>

            {/* checkbox acknowledgment */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1a3d2b] border-[#1a3d2b]" : "border-gray-300 group-hover:border-[#1a3d2b]/50"}`}
                onClick={() => setChecked((v) => !v)}>
                {checked && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </div>
              <span className="text-sm text-gray-700 leading-relaxed">
                I, the account holder, authorize Proven Power to proceed with the repair and service described above for{" "}
                <strong className="text-gray-900">${amount.toLocaleString()}</strong>. I understand this creates a financial obligation and I agree to pay upon completion.
              </span>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button onClick={handleConfirm} disabled={!checked || isSubmitting}
                className="flex-1 h-12 rounded-xl bg-[#1a3d2b] text-white font-bold text-sm disabled:opacity-40 hover:bg-[#0f2419] transition-colors">
                {isSubmitting ? "Recording…" : "I Approve This Work"}
              </button>
            </div>

            <p className="text-[10px] text-center text-gray-400">
              Your approval will be recorded with a timestamp for your records.
            </p>
          </div>
        )}

        {/* step 3 — confirmed receipt */}
        {step === 3 && (
          <div className="p-6 flex flex-col gap-5 items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">Approval Recorded</p>
              <p className="text-sm text-gray-500 mt-1">Your authorization has been saved and Proven Power has been notified.</p>
            </div>
            <div className="w-full bg-gray-50 rounded-2xl p-4 text-left flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Approved Amount</span>
                <span className="font-bold text-gray-900">${amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Equipment</span>
                <span className="font-semibold text-gray-900">{equipmentName}</span>
              </div>
              {approvedAt && (
                <div className="pt-1 border-t border-gray-200 mt-1">
                  <p className="text-xs text-gray-400">Authorized on</p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5">{fullTimestamp(approvedAt)}</p>
                </div>
              )}
            </div>
            <button onClick={onClose}
              className="w-full h-12 rounded-xl bg-[#1a3d2b] text-white font-bold text-sm hover:bg-[#0f2419] transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<ServiceRequestStatusHistory[]>([]);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string; mediaType: ServiceRequestMediaType }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const supabase = createClient();
    (async () => {
      const { data: requestRow } = await supabase.from("service_requests").select("*").eq("id", id).single();
      if (!isCurrent) return;
      setRequest(requestRow ?? null);
      if (requestRow) {
        const [{ data: eq }, { data: hist }, { data: media }] = await Promise.all([
          supabase.from("equipment").select("*").eq("id", requestRow.equipment_id).single(),
          supabase.from("service_request_status_history").select("*").eq("service_request_id", id).order("created_at", { ascending: false }),
          supabase.from("service_request_media").select("*").eq("service_request_id", id),
        ]);
        if (!isCurrent) return;
        setEquipment(eq ?? null);
        setHistory(hist ?? []);
        const urls = await Promise.all((media ?? []).map(async (m) => ({ id: m.id, url: await getSignedServiceRequestMediaUrl(m.storage_path), mediaType: m.media_type })));
        if (!isCurrent) return;
        setMediaUrls(urls.filter((u): u is { id: string; url: string; mediaType: ServiceRequestMediaType } => Boolean(u.url)));
      }
      setIsLoading(false);
    })();
    return () => { isCurrent = false; };
  }, [id]);

  async function handleCancel() {
    if (!confirm("Cancel this service request?")) return;
    setIsCancelling(true); setErrorMessage(null);
    const { data: updated, error } = await createClient().rpc("cancel_service_request", { p_service_request_id: id });
    if (error) setErrorMessage(error.message); else if (updated) setRequest(updated);
    setIsCancelling(false);
  }

  if (isLoading || !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Service Request" />
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />)}
        </div>
      </div>
    );
  }

  const equipmentName = equipment?.nickname || equipment?.model || "Service Request";

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title={equipmentName} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        {/* hero card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#1a3d2b] px-5 py-4">
            <p className="text-white font-bold text-lg leading-tight">{equipmentName}</p>
            {equipment?.make && <p className="text-white/60 text-sm mt-0.5">{equipment.make}</p>}
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <StatusBadge status={request.status ?? "submitted"} />
            <span className="text-xs text-gray-400">{relativeDate(request.created_at)}</span>
          </div>
          {request.description && (
            <div className="px-5 pb-5 border-t border-gray-50">
              <p className="text-sm text-gray-700 leading-relaxed pt-4 whitespace-pre-line">{request.description}</p>
            </div>
          )}
        </div>

        {/* estimate card */}
        {request.estimate_amount != null && (
          <div className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${request.estimate_approved_at ? "border-green-400" : "border-amber-400"}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={`text-xs font-bold uppercase tracking-widest ${request.estimate_approved_at ? "text-green-600" : "text-amber-600"}`}>
                {request.estimate_approved_at ? "Approved Estimate" : "Estimate — Awaiting Your Approval"}
              </p>
            </div>
            <p className="text-3xl font-bold text-gray-900">${request.estimate_amount.toLocaleString()}</p>
            {request.estimate_notes && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{request.estimate_notes}</p>}

            {request.estimate_approved_at ? (
              <div className="mt-4 bg-green-50 rounded-xl p-3 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-green-700">You approved this estimate</p>
                  <p className="text-xs text-green-600 mt-0.5">{fullTimestamp(request.estimate_approved_at)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-3">Work won't begin until you authorize this estimate. Review carefully before approving.</p>
                <button onClick={() => setShowApprovalModal(true)}
                  className="w-full h-12 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>
                  Review &amp; Approve Estimate
                </button>
              </div>
            )}
          </div>
        )}

        {/* payment due */}
        {request.status === "completed" && request.estimate_amount != null && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-[#1a3d2b]">
            <p className="text-xs font-bold text-[#1a3d2b] uppercase tracking-widest mb-1">Payment Due</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">${request.estimate_amount.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mb-4">Your service is complete. View your invoice to pay online.</p>
            <Link
              href="/invoices"
              className="w-full h-12 rounded-xl bg-[#1a3d2b] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#0f2419] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              View Invoice &amp; Pay
            </Link>
          </div>
        )}

        {/* status timeline */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Status Timeline</p>
            <div className="flex flex-col">
              {history.map((entry, i) => (
                <div key={entry.id} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? "bg-[#1a3d2b]" : "bg-gray-300"}`} />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1 mb-1 min-h-[20px]" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <StatusBadge status={entry.status} />
                    <p className="text-xs text-gray-400 mt-1">{new Date(entry.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* media */}
        {mediaUrls.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Attached Media</p>
            <div className="grid grid-cols-3 gap-2">
              {mediaUrls.map((m) =>
                m.mediaType === "photo" ? (
                  <div key={m.id} className="aspect-square rounded-xl overflow-hidden">
                    <Image src={m.url} alt="Service media" width={160} height={160} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <video key={m.id} src={m.url} controls className="aspect-square rounded-xl object-cover" />
                )
              )}
            </div>
          </div>
        )}

        {/* cancel */}
        {request.status === "submitted" && (
          <button onClick={handleCancel} disabled={isCancelling}
            className="w-full h-12 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
            {isCancelling ? "Cancelling…" : "Cancel Request"}
          </button>
        )}
      </div>

      {/* multi-step approval modal */}
      {showApprovalModal && request.estimate_amount != null && (
        <ApprovalModal
          amount={request.estimate_amount}
          notes={request.estimate_notes ?? null}
          equipmentName={equipmentName}
          requestId={id}
          onApproved={(updated) => setRequest(updated)}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
