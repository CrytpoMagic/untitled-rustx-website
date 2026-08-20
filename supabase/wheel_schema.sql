-- Daily Free Spin Wheel schema. Run in Supabase SQL editor.

create table if not exists public.wheel_players (
  steam_id text primary key,
  persona_name text,
  next_eligible_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null references public.wheel_players(steam_id) on delete cascade,
  prize_id text not null,
  prize_name text not null,
  kind text not null default 'item',
  item_shortname text,
  amount integer not null default 0,
  command text,
  created_at timestamptz not null default now(),
  delivered boolean not null default false,
  delivered_at timestamptz,
  delivery_attempts integer not null default 0
);

-- Migration for wheel_spins created before store-item prizes were added:
-- alter table public.wheel_spins add column if not exists kind text not null default 'item';
-- alter table public.wheel_spins add column if not exists command text;

create index if not exists wheel_spins_pending_idx on public.wheel_spins (steam_id, delivered);
create index if not exists wheel_spins_recent_idx on public.wheel_spins (steam_id, created_at desc);

create table if not exists public.wheel_config (
  key text primary key,
  value text not null
);
insert into public.wheel_config (key, value) values ('enabled', 'true') on conflict (key) do nothing;

alter table public.wheel_players enable row level security;
alter table public.wheel_spins enable row level security;
alter table public.wheel_config enable row level security;
-- No policies are added: the anon/public key has zero access. Only the service-role key
-- (used exclusively inside Netlify Functions) can read/write these tables.

-- Atomic eligibility claim: the UPDATE...WHERE...RETURNING takes a row lock, so concurrent
-- requests (5 tabs clicking spin at once) serialize on this row — exactly one can ever
-- flip next_eligible_at forward inside the 24h window. This is the race-condition fix
-- the spec calls for, done with a single statement instead of an app-level lock.
create or replace function public.wheel_try_spin(p_steam_id text, p_persona text)
returns table(eligible boolean, next_eligible_at timestamptz) as $$
declare
  v_updated timestamptz;
begin
  insert into public.wheel_players (steam_id, persona_name, next_eligible_at)
  values (p_steam_id, p_persona, now())
  on conflict (steam_id) do update set persona_name = coalesce(excluded.persona_name, public.wheel_players.persona_name);

  update public.wheel_players
  set next_eligible_at = now() + interval '24 hours'
  where steam_id = p_steam_id and next_eligible_at <= now()
  returning next_eligible_at into v_updated;

  if v_updated is not null then
    return query select true, v_updated;
  else
    return query select false, (select w.next_eligible_at from public.wheel_players w where w.steam_id = p_steam_id);
  end if;
end;
$$ language plpgsql security definer;
