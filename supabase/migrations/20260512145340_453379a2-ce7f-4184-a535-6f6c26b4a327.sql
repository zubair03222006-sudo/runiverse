
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  city text,
  avatar_url text,
  level int not null default 1,
  xp int not null default 0,
  total_area_km2 numeric not null default 0,
  total_distance_km numeric not null default 0,
  total_runs int not null default 0,
  streak_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Runs
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_km numeric not null default 0,
  duration_seconds int not null default 0,
  avg_pace_min_per_km numeric,
  calories int not null default 0,
  area_captured_m2 numeric not null default 0,
  path jsonb not null default '[]'::jsonb, -- array of {lat, lng, t}
  is_closed_loop boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.runs enable row level security;

create policy "Runs viewable by authenticated"
  on public.runs for select to authenticated using (true);
create policy "Users insert own runs"
  on public.runs for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own runs"
  on public.runs for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own runs"
  on public.runs for delete to authenticated using (auth.uid() = user_id);

-- Territories (claimed polygons)
create table public.territories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete cascade,
  polygon jsonb not null, -- array of {lat, lng}
  area_m2 numeric not null default 0,
  center_lat numeric,
  center_lng numeric,
  city text,
  name text,
  created_at timestamptz not null default now()
);

alter table public.territories enable row level security;

create policy "Territories viewable by authenticated"
  on public.territories for select to authenticated using (true);
create policy "Users insert own territories"
  on public.territories for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own territories"
  on public.territories for delete to authenticated using (auth.uid() = user_id);

create index territories_user_idx on public.territories(user_id);
create index runs_user_idx on public.runs(user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();
