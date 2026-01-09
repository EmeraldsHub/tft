alter table if exists public.tracked_players
  add column if not exists ranked_tier text,
  add column if not exists ranked_rank text,
  add column if not exists ranked_lp integer,
  add column if not exists ranked_queue text,
  add column if not exists ranked_updated_at timestamptz,
  add column if not exists live_in_game boolean,
  add column if not exists live_game_start_time bigint,
  add column if not exists live_updated_at timestamptz;
