-- Migrazione 013 (Fase 3, ADR-089): libreria esercizi. I dati del catalogo li mette la 014 (generata da scripts/exercises).
--
-- exercise_catalog: catalogo GLOBALE, uguale per tutti, in sola lettura per l'app. È l'unica eccezione alla regola
--   "ogni tabella ha user_id" (ADR-089): non contiene dati di nessuno. select solo per chi è loggato; nessun permesso di
--   scrittura per anon e authenticated, quindi si modifica solo con migrazioni.
-- user_exercises: la parte personale (opzione B di ADR-089). Due casi:
--   1. esercizio creato dall'utente: catalog_id nullo, nome/attrezzo/muscoli obbligatori;
--   2. copia personale di un esercizio del catalogo, creata alla prima modifica, nota o "nascondi": catalog_id valorizzato,
--      e ogni campo nullo vale "come nel catalogo". Elimina la riga = torna all'originale.
-- Gli esercizi di una scheda o di una sessione (Fasi 4-5) ne salveranno una copia del nome (snapshot): cambiare nome qui non
-- tocca lo storico.

begin;

create table public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'free-exercise-db',
  source_id text not null,
  name_en text not null check (char_length(name_en) between 1 and 200),
  name_it text not null check (char_length(name_it) between 1 and 200),
  -- true = traduzione automatica del glossario con parole che non conosce: da controllare.
  name_needs_review boolean not null default false,
  equipment text not null check (equipment in ('barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bodyweight', 'bands', 'ball', 'plate', 'other')),
  primary_muscles text[] not null check (
    cardinality(primary_muscles) >= 1
    and primary_muscles <@ array['chest', 'lats', 'upper_back', 'lower_back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors', 'neck']::text[]
  ),
  secondary_muscles text[] not null default '{}' check (
    secondary_muscles <@ array['chest', 'lats', 'upper_back', 'lower_back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors', 'neck']::text[]
  ),
  category text not null check (category in ('strength', 'powerlifting', 'olympic weightlifting', 'plyometrics')),
  mechanic text check (mechanic in ('compound', 'isolation')),
  force text check (force in ('push', 'pull', 'static')),
  level text not null check (level in ('beginner', 'intermediate', 'expert')),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create table public.user_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  catalog_id uuid references public.exercise_catalog (id) on delete restrict,
  -- Campi nulli = "come nel catalogo" (solo se catalog_id c'è).
  name text check (name is null or char_length(btrim(name)) between 1 and 80),
  equipment text check (equipment in ('barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bodyweight', 'bands', 'ball', 'plate', 'other')),
  primary_muscles text[] check (
    primary_muscles is null or (
      cardinality(primary_muscles) >= 1
      and primary_muscles <@ array['chest', 'lats', 'upper_back', 'lower_back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors', 'neck']::text[]
    )
  ),
  secondary_muscles text[] check (
    secondary_muscles is null
    or secondary_muscles <@ array['chest', 'lats', 'upper_back', 'lower_back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors', 'neck']::text[]
  ),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un esercizio senza catalogo deve avere tutto il necessario per esistere da solo.
  constraint user_exercises_standalone_complete check (
    catalog_id is not null or (name is not null and equipment is not null and primary_muscles is not null)
  ),
  -- Chiave composta (id, user_id): Fasi 4-5 la useranno per collegare schede e sessioni solo ai propri esercizi (come ADR-021).
  unique (id, user_id)
);
-- Una sola copia personale per esercizio del catalogo e per utente.
create unique index user_exercises_user_catalog_key on public.user_exercises (user_id, catalog_id) where catalog_id is not null;
create index user_exercises_user_idx on public.user_exercises (user_id);

create trigger user_exercises_set_updated_at
  before update on public.user_exercises
  for each row execute function public.set_updated_at();

alter table public.exercise_catalog enable row level security;
alter table public.user_exercises enable row level security;
revoke all on table public.exercise_catalog, public.user_exercises from public, anon, authenticated;
-- Catalogo: solo lettura per chi ha fatto il login. Nessun insert/update/delete: non esiste nemmeno una policy.
grant select on table public.exercise_catalog to authenticated;
grant select, insert, update, delete on table public.user_exercises to authenticated;

create policy "exercise_catalog_select_authenticated" on public.exercise_catalog
  for select to authenticated using (true);

create policy "user_exercises_select_own" on public.user_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_exercises_insert_own" on public.user_exercises
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_exercises_update_own" on public.user_exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_exercises_delete_own" on public.user_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

commit;
