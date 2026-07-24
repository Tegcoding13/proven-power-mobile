-- Add Stripe payment tracking to aspen_invoices.
-- payment_intent_id: Stripe PaymentIntent ID for lookup/status checks
-- stripe_payment_status: mirrors Stripe's status (requires_payment_method, succeeded, etc.)

alter table public.aspen_invoices
  add column if not exists stripe_payment_intent_id text unique,
  add column if not exists stripe_payment_status    text;

create index if not exists aspen_invoices_stripe_payment_intent_id_idx
  on public.aspen_invoices (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
