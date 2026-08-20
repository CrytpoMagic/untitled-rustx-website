create table if not exists public.leaderboard_wipes (
  wipe_id text primary key,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  last_ingest_at timestamptz not null default now()
);

create unique index if not exists leaderboard_one_current_wipe_idx
  on public.leaderboard_wipes (is_current)
  where is_current = true;

create table if not exists public.leaderboard_player_stats (
  wipe_id text not null references public.leaderboard_wipes(wipe_id) on delete cascade,
  steam_id text not null,
  name text not null,
  clan_tag text null,

  kills integer null,
  deaths integer null,
  headshots integer null,
  longest_kill_meters integer null,

  structures_destroyed integer null,
  doors_destroyed integer null,
  rockets_used integer null,
  c4_used integer null,
  satchels_used integer null,
  explosive_ammo_used integer null,

  wood integer null,
  stone integer null,
  cloth integer null,
  metal_ore integer null,
  sulfur_ore integer null,
  hqm_ore integer null,

  scientists_killed integer null,
  animals_killed integer null,
  bradley_kills integer null,
  heli_kills integer null,
  other_npc_kills integer null,

  playtime_seconds integer null,

  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (wipe_id, steam_id)
);

create index if not exists leaderboard_player_stats_wipe_kills_idx
  on public.leaderboard_player_stats (wipe_id, kills desc);

alter table public.leaderboard_wipes enable row level security;
alter table public.leaderboard_player_stats enable row level security;


create table if not exists public.leaderboard_heatmap_cells (
  wipe_id text not null references public.leaderboard_wipes(wipe_id) on delete cascade,
  category text not null,
  subtype text not null,
  cell_x integer not null,
  cell_y integer not null,
  event_count integer not null default 0,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wipe_id, category, subtype, cell_x, cell_y)
);

create index if not exists leaderboard_heatmap_lookup_idx
  on public.leaderboard_heatmap_cells (wipe_id, category, subtype);

alter table public.leaderboard_heatmap_cells enable row level security;


create extension if not exists pgcrypto;

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  transaction_id text not null unique,
  package_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true
);

create index if not exists sponsors_active_expiry_idx
  on public.sponsors (active, expires_at);

alter table public.sponsors enable row level security;


create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  sender text not null,
  origin text not null default 'website',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

create table if not exists public.chat_ratelimit (
  client_id text primary key,
  last_message_at timestamptz not null default now(),
  last_message_text text null,
  recent_at timestamptz null,
  recent_count integer not null default 0
);

alter table public.chat_ratelimit enable row level security;

-- Migration for existing databases created before moderation upgrade:
-- alter table public.chat_ratelimit add column if not exists last_message_text text;
-- alter table public.chat_ratelimit add column if not exists recent_at timestamptz;
-- alter table public.chat_ratelimit add column if not exists recent_count integer not null default 0;

create table if not exists public.chat_access_codes (
  code text primary key,
  transaction_id text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true
);

create index if not exists chat_access_codes_expiry_idx
  on public.chat_access_codes (active, expires_at);

alter table public.chat_access_codes enable row level security;

create table if not exists public.chat_bans (
  client_id text primary key,
  reason text null,
  violation_count integer not null default 1,
  banned_at timestamptz not null default now(),
  banned_until timestamptz null -- null = permanent
);

alter table public.chat_bans enable row level security;

create table if not exists public.chat_violations (
  id bigint generated always as identity primary key,
  client_id text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_violations_client_idx
  on public.chat_violations (client_id, created_at desc);

alter table public.chat_violations enable row level security;

