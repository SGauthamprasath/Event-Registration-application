-- Campus Events — Supabase schema
-- Paste the whole file into: Supabase → SQL Editor → New query → Run.
-- Safe to re-run (every create uses "if not exists" / drops idempotently).

-- 1. profiles — one row per signed-in user, linked to auth.users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  department  text,
  year        int,
  roll_no     text unique,
  created_at  timestamptz not null default now()
);

-- 2. events
create table if not exists public.events (
  id                   bigserial primary key,
  title                text not null,
  description          text,
  brochure_url         text,
  venue                text,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  attendance_closes_at timestamptz
);
-- Set by the control room's "Open attendance now"; overrides starts_at for attendance only.
alter table public.events add column if not exists attendance_opens_at timestamptz;
-- Control-room switch: registration is open until the event ends unless this is true.
alter table public.events add column if not exists registration_closed boolean not null default false;

-- 3. registrations — a student registers once per event
create table if not exists public.registrations (
  event_id      bigint not null references public.events(id) on delete cascade,
  email         text   not null references public.profiles(email) on delete cascade,
  registered_at timestamptz not null default now(),
  primary key (event_id, email)
);
create index if not exists registrations_email_idx on public.registrations(email);

-- 4. attendance — a student is marked once per event; one phone marks at most one student per event
create table if not exists public.attendance (
  event_id   bigint not null references public.events(id) on delete cascade,
  email      text   not null references public.profiles(email) on delete cascade,
  marked_at  timestamptz not null default now(),
  device_id  text,
  ip         text,
  user_agent text,
  method     text not null default 'scan',
  primary key (event_id, email)
);
create unique index if not exists attendance_device_per_event
  on public.attendance(event_id, device_id)
  where device_id is not null;
create index if not exists attendance_email_idx on public.attendance(email);

-- 5. Row-Level Security
-- The server reaches these tables with the service_role key (bypasses RLS).
-- Enable RLS so no one else can read/write without a policy, even if the anon key leaks.
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.registrations enable row level security;
alter table public.attendance    enable row level security;

-- Allow signed-in users to see event listings directly from the client (optional, read-only).
drop policy if exists "events_readable_by_authed" on public.events;
create policy "events_readable_by_authed"
  on public.events for select
  to authenticated
  using (true);

-- Users can read their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- 6. Auto-create a profile row on signup (just the id + email; the rest comes from the Profile page).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Backfill profiles for anyone who signed in before this trigger existed.
insert into public.profiles (id, email)
select id, lower(email) from auth.users where email is not null
on conflict do nothing;
