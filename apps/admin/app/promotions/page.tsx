"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Promotion } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { syncWordPress } from "./actions";
import { AdminPageHeader } from "../../components/AdminPageHeader";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();

  async function fetchPromotions(): Promise<{ rows: Promotion[]; error: string | null }> {
    const supabase = createClient();
    const { data, error } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
    return { rows: data ?? [], error: error?.message ?? null };
  }

  useEffect(() => {
    let isCurrent = true;
    fetchPromotions().then(({ rows, error }) => {
      if (!isCurrent) return;
      setPromotions(rows);
      if (error) setErrorMessage(error);
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  async function load() {
    const { rows, error } = await fetchPromotions();
    setPromotions(rows);
    if (error) setErrorMessage(error);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("promotions").insert({
      title: title.trim(),
      body: body.trim() || null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      created_by_profile_id: userData.user?.id,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setTitle("");
    setBody("");
    setEndsAt("");
    setIsSubmitting(false);
    load();
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("promotions").update({ is_active: !isActive }).eq("id", id);
    if (error) setErrorMessage(error.message);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this promotion? This can't be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) setErrorMessage(error.message);
    load();
  }

  function handleSyncWordPress() {
    setSyncMessage(null);
    startSync(async () => {
      const result = await syncWordPress();
      const parts = [`Fetched ${result.fetched} posts · Imported ${result.upserted}`];
      if (result.errors.length > 0) parts.push(`Error: ${result.errors[0]}`);
      if (result.diagnostic) parts.push(result.diagnostic);
      setSyncMessage(parts.join(" — "));
      load();
    });
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <AdminPageHeader title="Promotions" />
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={handleSyncWordPress}
          disabled={isSyncing}
          className="min-h-10 rounded-lg border border-green-600 px-4 text-sm font-semibold text-green-700 disabled:opacity-60"
        >
          {isSyncing ? "Syncing…" : "Sync from provenpower.com"}
        </button>
      </div>

      {syncMessage && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{syncMessage}</p>}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-gray-300 p-4">
        <p className="font-semibold text-black">New Promotion</p>
        <input
          placeholder="Title (e.g. 10% Off Blades)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <textarea
          placeholder="Details (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-base text-black"
        />
        <div>
          <label className="text-sm text-gray-700 block mb-1">End date (optional — stops showing to customers after this date)</label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
          />
        </div>
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="self-start min-h-12 rounded-lg bg-green-600 px-6 font-semibold text-white disabled:opacity-70"
        >
          {isSubmitting ? "Saving..." : "Add Promotion"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : promotions.length === 0 ? (
        <p className="text-gray-700">No promotions yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {promotions.map((promo) => (
            <li key={promo.id} className="rounded-lg border border-gray-300 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-black">{promo.title}</p>
                  {(promo as unknown as { external_source?: string }).external_source === "wordpress" && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">WP</span>
                  )}
                </div>
                {promo.body ? <p className="text-sm text-gray-700 truncate">{promo.body}</p> : null}
                <div className="flex gap-3 mt-1">
                  {promo.ends_at && <p className="text-xs text-gray-500">Ends {new Date(promo.ends_at).toLocaleDateString()}</p>}
                  {(promo as unknown as { external_url?: string }).external_url && (
                    <a href={(promo as unknown as { external_url: string }).external_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View on site ↗</a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleActive(promo.id, promo.is_active)}
                  className={`min-h-10 rounded-full px-3 text-xs font-semibold ${
                    promo.is_active ? "bg-green-600 text-white" : "bg-gray-100 text-black"
                  }`}
                >
                  {promo.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => handleDelete(promo.id)}
                  className="min-h-10 rounded-full px-3 text-xs font-semibold border border-red-600 text-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      </div>
    </div>
  );
}
