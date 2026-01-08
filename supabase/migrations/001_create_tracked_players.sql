create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists public.tracked_players (
  id uuid primary key default gen_random_uuid(),
  riot_id text not null,
  region text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tracked_players_slug_idx on public.tracked_players (slug);
create index if not exists tracked_players_riot_id_idx on public.tracked_players using gin (riot_id gin_trgm_ops);
