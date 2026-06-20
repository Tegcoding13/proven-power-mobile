"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Promotion } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchPromotions() {
    const supabase = createClient();
    const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
    return data ?? [];
  }

  useEffect(() => {
    let isCurrent = true;
    fetchPromotions().then((result) => {
      if (!isCurrent) return;
      setPromotions(result);
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  async function load() {
    setPromotions(await fetchPromotions());
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("promotions").insert({
      title: title.trim(),
      body: body.trim() || null,
      created_by_profile_id: userData.user?.id,
    });

    setTitle("");
    setBody("");
    setIsSubmitting(false);
    load();
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const supabase = createClient();
    await supabase.from("promotions").update({ is_active: !isActive }).eq("id", id);
    load();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Promotions</h1>

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
      ) : (
        <ul className="flex flex-col gap-3">
          {promotions.map((promo) => (
            <li key={promo.id} className="rounded-lg border border-gray-300 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-black">{promo.title}</p>
                {promo.body ? <p className="text-sm text-gray-700">{promo.body}</p> : null}
              </div>
              <button
                onClick={() => handleToggleActive(promo.id, promo.is_active)}
                className={`min-h-10 rounded-full px-3 text-xs font-semibold ${
                  promo.is_active ? "bg-green-600 text-white" : "bg-gray-100 text-black"
                }`}
              >
                {promo.is_active ? "Active" : "Inactive"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
    </div>
  );
}
