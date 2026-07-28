-- ═══════════════════════════════════════════════════
-- COLOSSEUM — Initial Database Schema
-- ═══════════════════════════════════════════════════
-- Run this migration against your Supabase project.
-- Dashboard → SQL Editor → paste and run.

-- Gladiators (extends Supabase auth.users — for Phase 2 auth)
-- For MVP, players use guest IDs stored in localStorage.
create table if not exists gladiators (
  id uuid primary key, -- references auth.users(id) in Phase 2
  username text unique not null,
  wins int default 0,
  losses int default 0,
  created_at timestamptz default now()
);

-- Rooms (a Duel lobby before/during a match)
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text default 'waiting' check (status in ('waiting', 'calibrating', 'active', 'complete')),
  player_a_id text, -- using text for MVP guest IDs; change to uuid references in Phase 2
  player_b_id text,
  player_a_name text,
  player_b_name text,
  created_at timestamptz default now()
);

-- Index for fast room code lookups
create index if not exists idx_rooms_room_code on rooms(room_code);

-- Duels (completed match records)
create table if not exists duels (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id),
  player_a_id text,
  player_b_id text,
  winner_id text,
  player_a_reps int default 0,
  player_b_reps int default 0,
  duration_seconds int,
  created_at timestamptz default now()
);

-- Rep event log for anti-cheat auditing / replay (optional)
create table if not exists rep_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid references duels(id),
  player_id text,
  rep_number int,
  damage_dealt int,
  confidence_score real,
  timestamp timestamptz default now()
);

-- ═══════════════════════════════════════════════════
-- Table Permissions (Grant privileges to anon & authenticated)
-- ═══════════════════════════════════════════════════
grant all on table public.rooms to anon, authenticated, service_role;
grant all on table public.duels to anon, authenticated, service_role;
grant all on table public.rep_events to anon, authenticated, service_role;
grant all on table public.gladiators to anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════
-- For MVP with guest users, we keep RLS permissive.
-- Tighten these policies in Phase 2 when auth is added.

alter table rooms enable row level security;
alter table duels enable row level security;
alter table rep_events enable row level security;

-- Allow anyone to read and insert rooms (MVP guest access)
drop policy if exists "rooms_read" on rooms;
drop policy if exists "rooms_insert" on rooms;
drop policy if exists "rooms_update" on rooms;
create policy "rooms_read" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (true);
create policy "rooms_update" on rooms for update using (true);

-- Allow anyone to read and insert duels
drop policy if exists "duels_read" on duels;
drop policy if exists "duels_insert" on duels;
create policy "duels_read" on duels for select using (true);
create policy "duels_insert" on duels for insert with check (true);

-- Allow anyone to insert rep events
drop policy if exists "rep_events_insert" on rep_events;
drop policy if exists "rep_events_read" on rep_events;
create policy "rep_events_insert" on rep_events for insert with check (true);
create policy "rep_events_read" on rep_events for select using (true);

-- ═══════════════════════════════════════════════════
-- Realtime — enable for rooms table (status updates)
-- ═══════════════════════════════════════════════════
alter publication supabase_realtime add table rooms;
