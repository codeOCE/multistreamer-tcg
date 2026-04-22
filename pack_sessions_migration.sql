-- Run this in your Supabase SQL editor
-- Creates pack_sessions table for tracking pack opening experiences

create table if not exists pack_sessions (
  id           uuid primary key default gen_random_uuid(),
  twitch_id    text not null,
  streamer_id  uuid not null references streamers(id) on delete cascade,
  user_card_ids uuid[] not null default '{}',
  source       text not null default 'stripe',  -- 'stripe' | 'redemption' | 'gift' | 'bits' | 'admin'
  opened_at    timestamptz,                      -- null = not yet opened in UI
  created_at   timestamptz not null default now()
);

create index if not exists pack_sessions_twitch_idx  on pack_sessions(twitch_id);
create index if not exists pack_sessions_opened_idx  on pack_sessions(twitch_id, opened_at) where opened_at is null;

-- RLS: viewers can only read their own pack sessions
alter table pack_sessions enable row level security;

create policy "Viewers read own pack sessions"
  on pack_sessions for select
  using (twitch_id = auth.uid()::text);
