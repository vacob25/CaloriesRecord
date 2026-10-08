-- 003_portions_water.sql · Porzioni casalinghe, liquidi in ml, acqua (step 14 e 15)
--
-- Da eseguire UNA volta nel SQL Editor di Supabase, dopo la 001 e la 002.
-- Tutto in una transazione: se qualcosa fallisce non cambia niente.
-- Le colonne nuove hanno un default: i dati già salvati restano validi (tutto in grammi, nessuna porzione).

begin;

-- ─── foods: unità e porzioni casalinghe (ADR-048) ──────────────────────────
-- unit 'ml': i valori nutrizionali sono per 100 ml, come sulle etichette dei liquidi.
alter table public.foods
  add column unit text not null default 'g' check (unit in ('g', 'ml'));

-- Porzioni con nome e quantità nell'unità del cibo, es. [{"name": "1 uovo medio", "amount": 50}].
-- La forma di ogni elemento la controlla l'app (zod); qui si garantisce che sia una lista.
alter table public.foods
  add column portions jsonb not null default '[]'::jsonb check (jsonb_typeof(portions) = 'array');

-- ─── meal_entries: l'unità fa parte dello snapshot (ADR-011) ──────────────
alter table public.meal_entries
  add column unit text not null default 'g' check (unit in ('g', 'ml'));

-- ─── profiles: obiettivo d'acqua scelto dall'utente (ADR-049) ─────────────
-- Nessun valore predefinito: null = nessun obiettivo, si mostra solo il totale.
alter table public.profiles
  add column water_goal_ml int check (water_goal_ml > 0);

-- ─── water_entries: l'acqua bevuta (non entra nel diario dei pasti) ───────

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  ml int not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now()
);

create index water_entries_user_date_idx on public.water_entries (user_id, entry_date);

alter table public.water_entries enable row level security;
revoke all on table public.water_entries from anon, authenticated;
grant select, insert, update, delete on table public.water_entries to authenticated;
create policy "water_entries_select_own" on public.water_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "water_entries_insert_own" on public.water_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "water_entries_update_own" on public.water_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "water_entries_delete_own" on public.water_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── drink_containers: contenitori personalizzati (es. la tua borraccia) ──

create table public.drink_containers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  ml int not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now()
);

create index drink_containers_user_idx on public.drink_containers (user_id);

alter table public.drink_containers enable row level security;
revoke all on table public.drink_containers from anon, authenticated;
grant select, insert, update, delete on table public.drink_containers to authenticated;
create policy "drink_containers_select_own" on public.drink_containers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "drink_containers_insert_own" on public.drink_containers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "drink_containers_update_own" on public.drink_containers
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "drink_containers_delete_own" on public.drink_containers
  for delete to authenticated using (user_id = (select auth.uid()));

commit;
