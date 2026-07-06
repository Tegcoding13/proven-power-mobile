import Link from "next/link";
import { searchCustomers, type CustomerResult } from "./actions";

function highlight(text: string, query: string): string {
  if (!query || !text) return text;
  return text; // plain text — highlights would require client component
}

function StatPill({ count, label, href }: { count: number; label: string; href: string }) {
  if (count === 0) return null;
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-800 hover:bg-green-100">
      {count} {label}
    </Link>
  );
}

function CustomerCard({ result, query }: { result: CustomerResult; query: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900 text-base">{result.fullName ?? "Unknown"}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            {result.email && <span className="text-sm text-gray-500">{result.email}</span>}
            {result.phone && <span className="text-sm text-gray-500">{result.phone}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          <StatPill count={result.serviceCount} label="service" href={`/service?customer=${result.profileId}`} />
          <StatPill count={result.partsCount} label="parts" href={`/parts?customer=${result.profileId}`} />
          <StatPill count={result.messageCount} label="messages" href={`/messages?customer=${result.profileId}`} />
          <StatPill count={result.storageCount} label="storage" href={`/winter-storage?customer=${result.profileId}`} />
        </div>
      </div>

      {/* Equipment */}
      {result.equipment.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Equipment</p>
          <div className="flex flex-col gap-1.5">
            {result.equipment.map((eq) => (
              <div key={eq.id} className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">{eq.label}</span>
                {eq.serial && (
                  <span className="text-xs text-gray-400">S/N: {eq.serial}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.equipment.length === 0 && (
        <p className="text-xs text-gray-300 italic">No equipment on file</p>
      )}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results: CustomerResult[] = query.length >= 2 ? await searchCustomers(query) : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1a3d2b] text-white px-6 py-0 flex items-center gap-4 h-14 shadow-lg">
        <Link href="/" className="text-green-300 hover:text-white text-sm">← Home</Link>
        <span className="text-white/40">|</span>
        <span className="font-semibold text-sm">Customer Search</span>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Search form */}
        <form method="GET" action="/search" className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Name, email, phone, model, serial number…"
            autoFocus
            className="flex-1 h-11 rounded-xl border border-gray-300 px-4 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            type="submit"
            className="h-11 px-5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800"
          >
            Search
          </button>
        </form>

        {/* Results */}
        {query.length >= 2 ? (
          results.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                {results.length} customer{results.length !== 1 ? "s" : ""} found for &ldquo;{query}&rdquo;
              </p>
              {results.map((r) => (
                <CustomerCard key={r.profileId} result={r} query={query} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-base font-semibold">No customers found</p>
              <p className="text-sm mt-1">Try a different name, email, phone, or equipment model</p>
            </div>
          )
        ) : query.length > 0 ? (
          <p className="text-sm text-gray-400 text-center pt-8">Keep typing…</p>
        ) : (
          <div className="text-center py-16 text-gray-300">
            <p className="text-sm">Search across all customers by name, email, phone, model number, or serial number</p>
          </div>
        )}
      </main>
    </div>
  );
}
