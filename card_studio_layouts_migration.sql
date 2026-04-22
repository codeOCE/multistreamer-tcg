-- Run this in your Supabase SQL editor
-- Creates the card_studio_layouts table for saving card creator layout templates

create table if not exists card_studio_layouts (
  id          uuid primary key default gen_random_uuid(),
  streamer_id uuid not null references streamers(id) on delete cascade,
  name        text not null default 'Untitled Layout',
  canvas_json text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists card_studio_layouts_streamer_idx on card_studio_layouts(streamer_id);

-- Row-level security: creators can only see/edit their own layouts
alter table card_studio_layouts enable row level security;

create policy "Creators manage own layouts"
  on card_studio_layouts
  for all
  using (streamer_id = auth.uid())
  with check (streamer_id = auth.uid());
