-- Migrazione 016 (Fase 4, ADR-090): schede di allenamento = scheda → giorni → esercizi del giorno.
-- Tutte personali (user_id, RLS, chiavi esterne composte (id, user_id) come ADR-021).
--
-- Un esercizio di una scheda punta al catalogo (`catalog_id`) oppure a un esercizio creato dall'utente (`user_exercise_id`):
-- mai tutti e due. Se l'utente rinomina un esercizio del catalogo la scheda lo segue (la copia personale si cerca per `catalog_id`).
-- Un esercizio usato in una scheda non si cancella (l'errore dice di nasconderlo); l'eliminazione dell'account cancella tutto.
-- Le serie previste sono un numero (`sets`) e un elenco di pesi facoltativi per serie (`weights_kg`, al massimo `sets` valori).
-- Nessun tempo di recupero di partenza e nessuna tecnica: i valori di default servono una fonte (Fase 7), qui il recupero
-- è solo ciò che scrive l'utente.

begin;

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index workout_plans_user_idx on public.workout_plans (user_id);

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Giorno della settimana facoltativo: 1 = lunedì … 7 = domenica (ISO).
  weekday smallint check (weekday between 1 and 7),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.workout_plans (id, user_id) on delete cascade
);
create index workout_days_user_idx on public.workout_days (user_id);
create index workout_days_plan_idx on public.workout_days (plan_id);

create table public.workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_id uuid not null,
  catalog_id uuid references public.exercise_catalog (id) on delete restrict,
  user_exercise_id uuid,
  position int not null default 0,
  sets smallint not null default 3 check (sets between 1 and 20),
  reps_min smallint not null default 10 check (reps_min between 1 and 100),
  -- Intervallo di ripetizioni ("8-12"): reps_max è nullo per un numero fisso.
  reps_max smallint check (reps_max is null or (reps_max between 1 and 100 and reps_max >= reps_min)),
  -- Peso per serie (kg), facoltativo; un valore nullo = non impostato.
  weights_kg numeric(6, 1)[] not null default '{}' check (cardinality(weights_kg) <= sets and 0 <= all (weights_kg) and 1000 >= all (weights_kg)),
  rest_seconds int check (rest_seconds is null or rest_seconds between 5 and 1800),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint workout_day_exercises_one_exercise check (num_nonnulls(catalog_id, user_exercise_id) = 1),
  foreign key (day_id, user_id) references public.workout_days (id, user_id) on delete cascade,
  -- NO ACTION (non RESTRICT): la verifica avviene a fine istruzione, così eliminare l'account (cascata su tutto) non si blocca da solo.
  foreign key (user_exercise_id, user_id) references public.user_exercises (id, user_id) on delete no action
);
create index workout_day_exercises_user_idx on public.workout_day_exercises (user_id);
create index workout_day_exercises_day_idx on public.workout_day_exercises (day_id);

create trigger workout_plans_set_updated_at
  before update on public.workout_plans
  for each row execute function public.set_updated_at();

alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_day_exercises enable row level security;
revoke all on table public.workout_plans, public.workout_days, public.workout_day_exercises from public, anon, authenticated;
grant select, insert, update, delete on table public.workout_plans, public.workout_days, public.workout_day_exercises to authenticated;

create policy "workout_plans_select_own" on public.workout_plans for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_plans_insert_own" on public.workout_plans for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_plans_update_own" on public.workout_plans for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_plans_delete_own" on public.workout_plans for delete to authenticated using (user_id = (select auth.uid()));

create policy "workout_days_select_own" on public.workout_days for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_days_insert_own" on public.workout_days for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_days_update_own" on public.workout_days for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_days_delete_own" on public.workout_days for delete to authenticated using (user_id = (select auth.uid()));

create policy "workout_day_exercises_select_own" on public.workout_day_exercises for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_day_exercises_insert_own" on public.workout_day_exercises for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_day_exercises_update_own" on public.workout_day_exercises for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_day_exercises_delete_own" on public.workout_day_exercises for delete to authenticated using (user_id = (select auth.uid()));

-- Duplicazione in una sola transazione. Funzioni `security invoker`: valgono i permessi e la RLS di chi chiama, quindi si
-- può copiare solo ciò che è proprio (una scheda altrui non si vede: errore "scheda non trovata").
create function public.duplicate_workout_plan(p_plan_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_plan uuid;
  d record;
  new_day uuid;
begin
  insert into public.workout_plans (name)
    select left(name, 70) || ' (copia)' from public.workout_plans where id = p_plan_id
    returning id into new_plan;
  if new_plan is null then raise exception 'scheda non trovata' using errcode = 'P0002'; end if;
  for d in select * from public.workout_days where plan_id = p_plan_id order by position, created_at loop
    insert into public.workout_days (plan_id, name, weekday, position) values (new_plan, d.name, d.weekday, d.position) returning id into new_day;
    insert into public.workout_day_exercises (day_id, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds, note)
      select new_day, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds, note
      from public.workout_day_exercises where day_id = d.id;
  end loop;
  return new_plan;
end;
$$;

create function public.duplicate_workout_day(p_day_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  src record;
  new_day uuid;
begin
  select * into src from public.workout_days where id = p_day_id;
  if not found then raise exception 'giorno non trovato' using errcode = 'P0002'; end if;
  insert into public.workout_days (plan_id, name, weekday, position)
    values (src.plan_id, left(src.name, 30) || ' (copia)', null,
            coalesce((select max(position) + 1 from public.workout_days where plan_id = src.plan_id), 0))
    returning id into new_day;
  insert into public.workout_day_exercises (day_id, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds, note)
    select new_day, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds, note
    from public.workout_day_exercises where day_id = p_day_id;
  return new_day;
end;
$$;

revoke execute on function public.duplicate_workout_plan(uuid) from public, anon;
revoke execute on function public.duplicate_workout_day(uuid) from public, anon;
grant execute on function public.duplicate_workout_plan(uuid) to authenticated;
grant execute on function public.duplicate_workout_day(uuid) to authenticated;

commit;
