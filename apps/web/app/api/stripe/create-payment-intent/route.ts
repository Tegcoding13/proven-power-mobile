import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await request.json();
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  // Verify the customer owns this invoice
  const { data: member } = await supabase
    .from("business_account_members")
    .select("business_account_id")
    .eq("profile_id", claims.claims.sub)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "No active account" }, { status: 403 });
  }

  const { data: invoice } = await supabase
    .from("aspen_invoices")
    .select("id, invoice_number, balance_due, total_amount, stripe_payment_intent_id, stripe_payment_status, status")
    .eq("id", invoiceId)
    .eq("business_account_id", member.business_account_id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 409 });
  }

  const amountDue = invoice.balance_due ?? invoice.total_amount;
  if (!amountDue || amountDue <= 0) {
    return NextResponse.json({ error: "No balance due" }, { status: 409 });
  }

  // Reuse existing intent if still open
  if (invoice.stripe_payment_intent_id && invoice.stripe_payment_status !== "canceled") {
    const existing = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
    if (existing.status !== "succeeded" && existing.status !== "canceled") {
      const updated = await stripe.paymentIntents.update(invoice.stripe_payment_intent_id, {
        amount: Math.round(amountDue * 100),
      });
      return NextResponse.json({ clientSecret: updated.client_secret });
    }
  }

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amountDue * 100),
    currency: "usd",
    metadata: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number ?? "",
      business_account_id: member.business_account_id,
    },
    description: `Invoice #${invoice.invoice_number ?? invoice.id} — Proven Power Routes`,
  });

  await supabase
    .from("aspen_invoices")
    .update({ stripe_payment_intent_id: intent.id, stripe_payment_status: intent.status })
    .eq("id", invoice.id);

  return NextResponse.json({ clientSecret: intent.client_secret });
}
