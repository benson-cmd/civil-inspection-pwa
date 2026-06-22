-- 06. Address road dictionary for fast address composition.
-- Import official road/street data into this table after creating it.

create table if not exists public.ci_address_roads (
  id uuid primary key default gen_random_uuid(),
  city_name text not null,
  district_name text not null,
  road_name text not null,
  source_name text,
  source_updated_at date,
  created_at timestamptz not null default now(),
  unique (city_name, district_name, road_name)
);

create index if not exists ci_address_roads_lookup_idx
  on public.ci_address_roads(city_name, district_name, road_name);

alter table public.ci_address_roads enable row level security;

drop policy if exists "ci_address_roads_read_authenticated" on public.ci_address_roads;
create policy "ci_address_roads_read_authenticated"
on public.ci_address_roads for select
to authenticated
using (true);
