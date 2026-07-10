"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PartsInventory, PartsRequest } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { StatusBadge } from "../../components/StatusBadge";
import { PageHeader } from "../../components/PageHeader";

const TYPE_LABELS: Record<string, string> = {
  stock_check: "Stock Check",
  part_order: "Part Order",
  broken_part_id: "Part Identification",
};

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type InventoryResult = PartsInventory & { locationName: string };

function InventoryLookup() {
  const [partNumber, setPartNumber] = useState("");
  const [results, setResults] = useState<InventoryResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults(null); return; }
    setIsSearching(true);
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("parts_inventory")
      .select("*, dealership_locations(name)")
      .ilike("part_number", `%${trimmed}%`)
      .order("part_number", { ascending: true })
      .limit(20);

    const mapped: InventoryResult[] = (rows ?? []).map((r) => ({
      ...r,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locationName: (r as any).dealership_locations?.name?.replace("Proven Power - ", "") ?? "Unknown location",
    }));
    setResults(mapped);
    setIsSearching(false);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setPartNumber(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  }

  const inStock = results?.filter((r) => r.quantity_on_hand > 0) ?? [];
  const outOfStock = results?.filter((r) => r.quantity_on_hand <= 0) ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Check Our Inventory</p>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {isSearching && (
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-300" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
          <input
            type="text"
            placeholder="Enter part number…"
            value={partNumber}
            onChange={handleChange}
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30"
          />
        </div>
      </div>

      {results !== null && (
        <div className="border-t border-gray-100">
          {results.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-500">
              No matching parts found.{" "}
              <Link href="/parts/new" className="font-semibold text-[#1a3d2b] underline">Submit a request</Link>
              {" "}and our team will source it.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {inStock.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{r.part_number}</p>
                    {r.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{r.locationName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 ring-1 ring-green-200 px-2.5 py-1 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {r.quantity_on_hand} in stock
                    </span>
                    {r.unit_price != null && (
                      <p className="text-xs text-gray-400 mt-1">${r.unit_price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
              {outOfStock.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5 opacity-60">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{r.part_number}</p>
                    {r.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{r.locationName}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 ring-1 ring-gray-200 px-2.5 py-1 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    Out of stock
                  </span>
                </div>
              ))}
              {inStock.length === 0 && outOfStock.length > 0 && (
                <div className="px-5 py-3 text-xs text-gray-500">
                  Not in stock at either location.{" "}
                  <Link href="/parts/new" className="font-semibold text-[#1a3d2b] underline">Request an order</Link>.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PartsListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    supabase.from("parts_requests").select("*")
      .eq("business_account_id", businessAccount.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setIsLoading(false); });
  }, [businessAccount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => [r.description, r.status, r.request_type].some((f) => f?.toLowerCase().includes(q)));
  }, [requests, query]);

  const open = filtered.filter((r) => !["fulfilled", "cancelled"].includes(r.status ?? ""));
  const closed = filtered.filter((r) => ["fulfilled", "cancelled"].includes(r.status ?? ""));

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Parts Store" action={{ href: "/parts/new", label: "+ Request Parts" }} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">

        <a
          href="https://shop.deere.com/us"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-5 py-4 hover:bg-green-100 transition-colors"
        >
          <div>
            <p className="font-bold text-green-900 text-sm">Order Parts on Shop.Deere.com</p>
            <p className="text-xs text-green-700 mt-0.5">Browse the full John Deere parts catalog, check stock, and place orders</p>
          </div>
          <span className="text-green-700 text-lg shrink-0 ml-4">↗</span>
        </a>

        <InventoryLookup />

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">My Requests</p>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="Filter my requests…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 shadow-sm"
            />
          </div>
        </div>

        {isLoadingAccount || isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="font-semibold text-gray-900">No parts requests yet</p>
            <p className="text-sm text-gray-500 mt-1">Need a part? Submit a request and our team will get back to you.</p>
            <Link href="/parts/new" className="mt-4 bg-[#1a3d2b] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#0f2419] transition-colors">
              Request Parts
            </Link>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active · {open.length}</p>
                <div className="flex flex-col gap-3">
                  {open.map((r) => (
                    <Link key={r.id} href={`/parts/${r.id}`} className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-[#1a3d2b]/10 overflow-hidden flex">
                      <div className="w-1 shrink-0 bg-[#1a3d2b]" />
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{TYPE_LABELS[r.request_type ?? ""] ?? r.request_type}</span>
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2 leading-relaxed">{r.description}</p>
                          </div>
                          <StatusBadge status={r.status ?? "submitted"} />
                        </div>
                        <p className="text-xs text-gray-400 mt-3">{relativeDate(r.created_at)}</p>
                      </div>
                      <div className="flex items-center pr-3 text-gray-300 group-hover:text-[#1a3d2b] transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">History · {closed.length}</p>
                <div className="flex flex-col gap-3 opacity-70">
                  {closed.map((r) => (
                    <Link key={r.id} href={`/parts/${r.id}`} className="group bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-400">{TYPE_LABELS[r.request_type ?? ""] ?? r.request_type}</span>
                        <p className="text-sm text-gray-600 line-clamp-1 mt-0.5">{r.description}</p>
                      </div>
                      <StatusBadge status={r.status ?? "fulfilled"} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Link href="/parts/new" className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1a3d2b] text-white flex items-center justify-center text-2xl font-bold shadow-xl hover:bg-[#0f2419] transition-colors z-10">+</Link>
    </div>
  );
}
