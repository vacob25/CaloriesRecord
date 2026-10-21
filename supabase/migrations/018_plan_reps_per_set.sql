-- Migrazione 018 (Fase 4, ritocco): ripetizioni diverse per ogni serie di un esercizio della scheda.
-- `reps_per_set` è un elenco con al massimo `sets` valori (1-100, nulli ammessi); dove manca il valore della serie vale
-- `reps_min` (le schede già create continuano a funzionare). `reps_min`/`reps_max` restano e l'app li tiene allineati al
-- minimo e al massimo delle serie, così le sessioni (migrazione 017) e le schede vecchie non cambiano.

begin;

alter table public.workout_day_exercises
  add column reps_per_set smallint[] not null default '{}'
  check (cardinality(reps_per_set) <= sets and 1 <= all (reps_per_set) and 100 >= all (reps_per_set));

-- Le due funzioni di duplicazione copiano anche le ripetizioni per serie.
create or replace function public.duplicate_workout_plan(p_plan_id uuid)
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
    insert into public.workout_day_exercises (day_id, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, reps_per_set, weights_kg, rest_seconds, note)
      select new_day, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, reps_per_set, weights_kg, rest_seconds, note
      from public.workout_day_exercises where day_id = d.id;
  end loop;
  return new_plan;
end;
$$;

create or replace function public.duplicate_workout_day(p_day_id uuid)
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
  insert into public.workout_day_exercises (day_id, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, reps_per_set, weights_kg, rest_seconds, note)
    select new_day, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, reps_per_set, weights_kg, rest_seconds, note
    from public.workout_day_exercises where day_id = p_day_id;
  return new_day;
end;
$$;

commit;
