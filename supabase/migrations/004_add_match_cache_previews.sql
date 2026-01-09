alter table public.tft_match_cache
  add column if not exists player_previews jsonb;
