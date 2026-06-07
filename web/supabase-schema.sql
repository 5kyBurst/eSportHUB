-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null,
  avatar_url  text,
  points      integer not null default 0,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── TOURNAMENTS ──────────────────────────────────────────────────────────────
create table tournaments (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  format          text not null check (format in ('swiss', 'double_elimination', 'single_elimination')),
  start_date      date not null,
  end_date        date not null,
  status          text not null default 'upcoming' check (status in ('upcoming', 'live', 'finished')),
  liquipedia_url  text,
  created_at      timestamptz default now()
);

-- ─── MATCHES ─────────────────────────────────────────────────────────────────
create table matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  match_key     text not null,
  team_a        text not null,
  team_b        text not null,
  format        text not null default 'Bo3',
  score_a       integer,
  score_b       integer,
  status        text not null default 'upcoming' check (status in ('upcoming', 'live', 'finished')),
  scheduled_at  timestamptz not null,
  round_label   text not null,
  created_at    timestamptz default now(),
  unique (tournament_id, match_key)
);

-- ─── PREDICTIONS ─────────────────────────────────────────────────────────────
create table predictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  match_id      uuid not null references matches on delete cascade,
  score_a       integer not null,
  score_b       integer not null,
  points_earned integer,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, match_id)
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger predictions_updated_at
  before update on predictions
  for each row execute procedure update_updated_at();

-- ─── CARDS ───────────────────────────────────────────────────────────────────
create table cards (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('player', 'ceo', 'org')),
  name       text not null,
  role       text,
  team       text not null,
  region     text not null,
  rarity     text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  image_url  text,
  stats      jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ─── CARD PACKS ──────────────────────────────────────────────────────────────
create table card_packs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null default '',
  cost_points     integer not null,
  card_count      integer not null default 5,
  rarity_weights  jsonb not null default '{"common":70,"rare":20,"epic":8,"legendary":2}',
  created_at      timestamptz default now()
);

-- ─── USER CARDS ──────────────────────────────────────────────────────────────
create table user_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  card_id     uuid not null references cards on delete cascade,
  acquired_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table profiles    enable row level security;
alter table predictions enable row level security;
alter table user_cards  enable row level security;

-- Profiles: lecture publique, écriture sur son propre profil
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Predictions: chacun voit et modifie les siennes
create policy "predictions_select" on predictions for select using (auth.uid() = user_id);
create policy "predictions_insert" on predictions for insert with check (auth.uid() = user_id);
create policy "predictions_update" on predictions for update using (auth.uid() = user_id);

-- User cards: chacun voit les siennes
create policy "user_cards_select" on user_cards for select using (auth.uid() = user_id);

-- Tournois, matchs, cartes, packs : lecture publique
alter table tournaments enable row level security;
alter table matches      enable row level security;
alter table cards        enable row level security;
alter table card_packs   enable row level security;

create policy "tournaments_select" on tournaments for select using (true);
create policy "matches_select"     on matches     for select using (true);
create policy "cards_select"       on cards       for select using (true);
create policy "card_packs_select"  on card_packs  for select using (true);

-- GRANTs nécessaires (RLS seul ne suffit pas, PostgreSQL exige aussi les GRANTs de table)
grant select on public.tournaments to anon, authenticated;
grant select on public.matches     to anon, authenticated;
grant select on public.cards       to anon, authenticated;
grant select on public.card_packs  to anon, authenticated;
grant select, insert, update on public.predictions to authenticated;
grant select, insert, update on public.profiles    to authenticated;

-- ─── SEED : TOURNOI VCT MASTERS LONDON 2026 ──────────────────────────────────
insert into tournaments (name, slug, format, start_date, end_date, status)
values ('VCT Masters London 2026', 'vct-masters-london-2026', 'swiss', '2026-06-06', '2026-06-22', 'upcoming');
