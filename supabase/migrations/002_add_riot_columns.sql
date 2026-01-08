alter table if exists public.tracked_players
  add column if not exists puuid text,
  add column if not exists summoner_id text,
  add column if not exists avg_placement_10 numeric,
  add column if not exists avg_placement_updated_at timestamptz,
  add column if not exists riot_data_updated_at timestamptz;
