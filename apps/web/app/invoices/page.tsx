"use client";

import { useEffect, useState } from "react";
import type { AspenInvoice } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { PageHeader } from "../../components/PageHeader";

type LineItem = {
  part_number?: string;
  description?: string;
  qty?: number;
  unit_price?: number;
  extended_price?: number;
  type?: "labor" | "part";
  amount?: number;
};

const STATUS_STYLES: Record<string, string> = {
  paid:    "bg-green-50 text-green-700 ring-1 ring-green-200",
  unpaid:  "bg-red-50 text-red-700 ring-1 ring-red-200",
  partial: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  voided:  "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  unknown: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid", unpaid: "Unpaid", partial: "Partial", voided: "Voided", unknown: "—",
};

function fmt(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function InvoiceCard({ invoice }: { invoice: AspenInvoice }) {
  const [expanded, setExpanded] = useState(false);
  const lineItems = (invoice.line_items ?? []) as LineItem[];
  const style = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.unknown;
  const label = STATUS_LABELS[invoice.status] ?? invoice.status;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-gray-900">
              {invoice.invoice_number ? `#${invoice.invoice_number}` : "Invoice"}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
              {label}
            </span>
          </div>
          <p className="text-xs text-gray-400">{fmtDate(invoice.invoice_date)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-gray-900">{fmt(invoice.total_amount)}</p>
          {invoice.balance_due != null && invoice.balance_due > 0 && invoice.status !== "paid" && (
            <p className="text-xs text-red-500 mt-0.5">Balance: {fmt(invoice.balance_due)}</p>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-4">
          {lineItems.length > 0 ? (
            <table className="w-full text-xs mt-3">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 font-semibold">Description</th>
                  <th className="text-right pb-1.5 font-semibold w-10">Qty</th>
                  <th className="text-right pb-1.5 font-semibold w-20">Price</th>
                  <th className="text-right pb-1.5 font-semibold w-20">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((item, i) => (
                  <tr key={i} className="text-gray-700">
                    <td className="py-1.5 pr-2">
                      {item.part_number && (
                        <span className="font-mono text-[10px] text-gray-400 mr-1">{item.part_number}</span>
                      )}
                      {item.description ?? (item.type === "labor" ? "Labor" : "Part")}
                    </td>
                    <td className="py-1.5 text-right">{item.qty ?? "—"}</td>
                    <td className="py-1.5 text-right">{fmt(item.unit_price ?? item.amount)}</td>
                    <td className="py-1.5 text-right font-semibold">{fmt(item.extended_price ?? item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 text-gray-900 font-bold">
                  <td colSpan={3} className="pt-2 text-right text-xs">Total</td>
                  <td className="pt-2 text-right text-xs">{fmt(invoice.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-xs text-gray-400 mt-3 text-center">No line item detail available</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [invoices, setInvoices] = useState<AspenInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessAccount) return;
    createClient()
      .from("aspen_invoices")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .order("invoice_date", { ascending: false, nullsFirst: false })
      .then(({ data }) => { setInvoices(data ?? []); setIsLoading(false); });
  }, [businessAccount]);

  const unpaid = invoices.filter((i) => ["unpaid", "partial"].includes(i.status));
  const paid = invoices.filter((i) => !["unpaid", "partial"].includes(i.status));

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Invoice History" />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {isLoadingAccount || isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-3xl">📄</div>
            <p className="font-semibold text-gray-900">No invoice history yet</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              Your invoice history from Proven Power will appear here once your account is synced.
            </p>
          </div>
        ) : (
          <>
            {unpaid.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Outstanding · {unpaid.length}
                </p>
                <div className="flex flex-col gap-3">
                  {unpaid.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)}
                </div>
              </section>
            )}
            {paid.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  History · {paid.length}
                </p>
                <div className={`flex flex-col gap-3 ${unpaid.length > 0 ? "opacity-80" : ""}`}>
                  {paid.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
