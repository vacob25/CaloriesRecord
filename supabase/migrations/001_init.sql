-- 001_init.sql · Schema iniziale di CaloriesRecord (docs/DATA_MODEL.md)
--
-- Da eseguire UNA volta nel SQL Editor di Supabase (incolla tutto e Run).
-- È in una transazione: se qualcosa fallisce non resta niente a metà.
--
-- Per ogni tabella:
--   - user_id con default auth.uid(): l'app non deve mai passarlo a mano;
--   - RLS attiva + 4 policy "solo le proprie righe" per authenticated;
--   - grant espliciti ad authenticated (ADR-018) e nessun grant ad anon:
--     il grant dice CHI può provare a usare la tabella, la RLS QUALI righe (ADR-018, ADR-021).
--     Prima si toglie tutto (revoke all): alcuni progetti danno per default anche
--     TRUNCATE, che ignora la RLS. Poi si concedono solo i 4 permessi necessari.

begin;

-- ─── Funzioni di supporto ───────────────────────────────────────────────────
-- search_path vuoto: la funzione usa solo nomi completi (public.x), nessuno
-- può "dirottarla" creando oggetti con lo stesso nome in un altro schema.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── profiles: una riga per utente ─────────────────────────────────────────
-- sesso, data di nascita e altezza si inseriscono nell'app (mai nel repo).

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null,
  height_cm numeric(5,1) not null check (height_cm > 0),
  activity_factor numeric(4,3) not null default 1.600 check (activity_factor > 0),
  surplus_pct numeric(4,3) not null default 0.100,
  training_bonus_kcal int not null default 200,
  goal_weight_kg numeric(4,1),
  protein_g_per_kg numeric(3,2) not null default 2.00 check (protein_g_per_kg >= 0),
  fat_g_per_kg numeric(3,2) not null default 1.00 check (fat_g_per_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── foods: cibi propri, prodotti di Open Food Facts e ricette ─────────────
-- Valori sempre per 100 g.

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  brand text,
  barcode text,
  source text not null default 'manual' check (source in ('manual', 'open_food_facts', 'recipe')),
  kcal_100g numeric(8,2) not null,
  protein_100g numeric(8,2) not null,
  carbs_100g numeric(8,2) not null,
  fat_100g numeric(8,2) not null,
  serving_g numeric(8,1) check (serving_g > 0),
  cooked_weight_g numeric(8,1) check (cooked_weight_g > 0),
  is_favorite boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_nutrients_non_negative
    check (kcal_100g >= 0 and protein_100g >= 0 and carbs_100g >= 0 and fat_100g >= 0),
  constraint foods_cooked_weight_only_recipe
    check (cooked_weight_g is null or source = 'recipe'),
  -- Serve alle chiavi esterne composte (id, user_id) qui sotto: garantiscono che
  -- ricette e voci pasto puntino solo a cibi dello STESSO utente (ADR-022).
  constraint foods_id_user_id_key unique (id, user_id)
);

create unique index foods_user_barcode_key on public.foods (user_id, barcode) where barcode is not null;
create index foods_user_name_idx on public.foods (user_id, name);
create index foods_user_last_used_idx on public.foods (user_id, last_used_at desc);

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

alter table public.foods enable row level security;
revoke all on table public.foods from anon, authenticated;
grant select, insert, update, delete on table public.foods to authenticated;
create policy "foods_select_own" on public.foods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "foods_insert_own" on public.foods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "foods_update_own" on public.foods
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "foods_delete_own" on public.foods
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── recipe_items: ingredienti di una ricetta ──────────────────────────────

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_food_id uuid not null,
  ingredient_food_id uuid not null,
  grams numeric(8,1) not null check (grams > 0),
  created_at timestamptz not null default now(),
  constraint recipe_items_not_self check (recipe_food_id <> ingredient_food_id),
  -- Cancellare la ricetta cancella i suoi ingredienti.
  constraint recipe_items_recipe_fkey foreign key (recipe_food_id, user_id)
    references public.foods (id, user_id) on delete cascade,
  -- Cancellare un cibo usato come ingrediente è bloccato (messaggio chiaro dall'app).
  constraint recipe_items_ingredient_fkey foreign key (ingredient_food_id, user_id)
    references public.foods (id, user_id) on delete restrict
);

create index recipe_items_recipe_idx on public.recipe_items (recipe_food_id);
create index recipe_items_ingredient_idx on public.recipe_items (ingredient_food_id);

-- In v1 una ricetta contiene solo ingredienti semplici (ADR-012).
create function public.check_recipe_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recipe_source text;
  ingredient_source text;
begin
  select f.source into recipe_source from public.foods f where f.id = new.recipe_food_id;
  select f.source into ingredient_source from public.foods f where f.id = new.ingredient_food_id;
  if recipe_source is distinct from 'recipe' then
    raise exception 'recipe_food_id deve essere un cibo di tipo ricetta' using errcode = 'check_violation';
  end if;
  if ingredient_source = 'recipe' then
    raise exception 'Una ricetta non può contenere un''altra ricetta' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger recipe_items_check
  before insert or update on public.recipe_items
  for each row execute function public.check_recipe_item();

-- Stessa regola dall'altro lato: un cibo non può cambiare tipo se questo
-- romperebbe una ricetta (ingrediente che diventa ricetta, o ricetta con ingredienti che smette di esserlo).
create function public.check_food_source_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source = 'recipe' and exists (
    select 1 from public.recipe_items ri where ri.ingredient_food_id = new.id
  ) then
    raise exception 'Questo cibo è usato come ingrediente: non può diventare una ricetta' using errcode = 'check_violation';
  end if;
  if old.source = 'recipe' and exists (
    select 1 from public.recipe_items ri where ri.recipe_food_id = new.id
  ) then
    raise exception 'Questa ricetta ha ingredienti: non può cambiare tipo' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger foods_check_source_change
  before update of source on public.foods
  for each row when (old.source is distinct from new.source)
  execute function public.check_food_source_change();

alter table public.recipe_items enable row level security;
revoke all on table public.recipe_items from anon, authenticated;
grant select, insert, update, delete on table public.recipe_items to authenticated;
create policy "recipe_items_select_own" on public.recipe_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recipe_items_insert_own" on public.recipe_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recipe_items_update_own" on public.recipe_items
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recipe_items_delete_own" on public.recipe_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── meal_entries: il diario ───────────────────────────────────────────────
-- Nome, kcal e macro sono uno snapshot: cambiare o cancellare il cibo non tocca lo storico (ADR-011).

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id uuid,
  food_name text not null,
  grams numeric(8,1) not null check (grams > 0),
  kcal numeric(7,1) not null check (kcal >= 0),
  protein_g numeric(7,1) not null check (protein_g >= 0),
  carbs_g numeric(7,1) not null check (carbs_g >= 0),
  fat_g numeric(7,1) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  -- Cancellando il cibo si azzera solo food_id (non user_id): la voce resta con il suo nome.
  constraint meal_entries_food_fkey foreign key (food_id, user_id)
    references public.foods (id, user_id) on delete set null (food_id)
);

create index meal_entries_user_date_idx on public.meal_entries (user_id, entry_date);
create index meal_entries_food_idx on public.meal_entries (food_id);

alter table public.meal_entries enable row level security;
revoke all on table public.meal_entries from anon, authenticated;
grant select, insert, update, delete on table public.meal_entries to authenticated;
create policy "meal_entries_select_own" on public.meal_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meal_entries_insert_own" on public.meal_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meal_entries_update_own" on public.meal_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meal_entries_delete_own" on public.meal_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── weight_logs: una pesata al giorno ─────────────────────────────────────

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(4,1) not null check (weight_kg between 30 and 250),
  created_at timestamptz not null default now(),
  -- La seconda pesata dello stesso giorno sostituisce la prima (upsert su questo vincolo).
  constraint weight_logs_user_date_key unique (user_id, log_date)
);

alter table public.weight_logs enable row level security;
revoke all on table public.weight_logs from anon, authenticated;
grant select, insert, update, delete on table public.weight_logs to authenticated;
create policy "weight_logs_select_own" on public.weight_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "weight_logs_insert_own" on public.weight_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "weight_logs_update_own" on public.weight_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "weight_logs_delete_own" on public.weight_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── daily_targets: il target di ogni giorno, congelato ────────────────────

create table public.daily_targets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_date date not null,
  training_type text not null default 'rest' check (training_type in ('rest', 'gym', 'football', 'both')),
  target_kcal int not null,
  protein_g int not null,
  carbs_g int not null,
  fat_g int not null,
  maintenance_kcal int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, target_date)
);

create trigger daily_targets_set_updated_at
  before update on public.daily_targets
  for each row execute function public.set_updated_at();

alter table public.daily_targets enable row level security;
revoke all on table public.daily_targets from anon, authenticated;
grant select, insert, update, delete on table public.daily_targets to authenticated;
create policy "daily_targets_select_own" on public.daily_targets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "daily_targets_insert_own" on public.daily_targets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "daily_targets_update_own" on public.daily_targets
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "daily_targets_delete_own" on public.daily_targets
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── tdee_estimates: storico delle ricalibrazioni ──────────────────────────
-- I valori calcolati possono mancare quando i dati non bastano (status 'none').

create table public.tdee_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  window_days int not null check (window_days > 0),
  avg_intake_kcal int,
  trend_slope_kg_week numeric(5,3),
  estimated_maintenance_kcal int,
  proposed_maintenance_kcal int,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'none')),
  created_at timestamptz not null default now()
);

create index tdee_estimates_user_week_idx on public.tdee_estimates (user_id, week_start);

alter table public.tdee_estimates enable row level security;
revoke all on table public.tdee_estimates from anon, authenticated;
grant select, insert, update, delete on table public.tdee_estimates to authenticated;
create policy "tdee_estimates_select_own" on public.tdee_estimates
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tdee_estimates_insert_own" on public.tdee_estimates
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tdee_estimates_update_own" on public.tdee_estimates
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tdee_estimates_delete_own" on public.tdee_estimates
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── Funzioni: nessuno le chiama direttamente ──────────────────────────────
-- Sono solo trigger: togliamo il permesso di eseguirle via API.

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.check_recipe_item() from public, anon, authenticated;
revoke execute on function public.check_food_source_change() from public, anon, authenticated;

commit;
