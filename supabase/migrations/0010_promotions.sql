-- Promotions — staff-managed, shown on the customer home screen.

create table promotions (
  id uuid primary key default gen_random_uuid(),
  dealership_location_id uuid references dealership_locations(id),
  title text not null,
  body text,
  image_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promotions_active_idx on promotions (is_active, starts_at, ends_at);

create trigger promotions_set_updated_at
  before update on promotions
  for each row execute function public.set_updated_at_now();

alter table promotions enable row level security;

create policy "anyone reads live promotions" on promotions for select
  using (
    (is_active and starts_at <= now() and (ends_at is null or ends_at >= now()))
    or public.is_staff()
  );
create policy "staff manage promotions" on promotions for all
  using (public.is_staff())
  with check (public.is_staff());
