-- Migrazione 017 (Fase 5a, ADR-091): sessioni di allenamento = sessione → esercizi della sessione → serie.
-- Tutte personali (user_id, RLS, chiavi esterne composte (id, user_id) come ADR-021).
--
-- ISTANTANEA (come ADR-011): ogni esercizio della sessione salva nome, attrezzo e gruppi muscolari al momento dell'allenamento,
-- e la sessione salva i nomi della scheda e del giorno. Rinominare, nascondere o archiviare un esercizio, o eliminare la scheda,
-- non cambia lo storico. I riferimenti a scheda, giorno ed esercizio personale servono solo a ritrovare l'ultima volta e a
-- proporre il giorno successivo; se l'oggetto sparisce diventano nulli (`on delete set null (colonna)`, PostgreSQL 15+).
-- Gli id li crea l'app: i salvataggi ripetuti (rete persa, "Riprova") non creano doppioni, come per i pasti (ADR-079).

begin;

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Giorno locale Europe/Rome 'YYYY-MM-DD' (regola 6), deciso dall'app.
  session_date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  plan_id uuid,
  day_id uuid,
  -- Nomi copiati al momento dell'inizio (nulli per una sessione libera).
  plan_name text check (plan_name is null or char_length(plan_name) <= 80),
  day_name text check (day_name is null or char_length(day_name) <= 40),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  constraint workout_sessions_end_after_start check (ended_at is null or ended_at >= started_at),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.workout_plans (id, user_id) on delete set null (plan_id),
  foreign key (day_id, user_id) references public.workout_days (id, user_id) on delete set null (day_id)
);
create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  position int not null default 0,
  -- Istantanea dell'esercizio.
  exercise_name text not null check (char_length(btrim(exercise_name)) between 1 and 80),
  equipment text not null check (equipment in ('barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bodyweight', 'bands', 'ball', 'plate', 'other')),
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  -- Riferimento all'esercizio (per "ultima volta"): del catalogo o personale, al massimo uno; nessuno = esercizio sparito.
  catalog_id uuid references public.exercise_catalog (id) on delete set null,
  user_exercise_id uuid,
  -- Previsto dalla scheda (nulli in una sessione libera o per un esercizio aggiunto al momento).
  planned_sets smallint check (planned_sets is null or planned_sets between 1 and 20),
  planned_reps_min smallint check (planned_reps_min is null or planned_reps_min between 1 and 100),
  planned_reps_max smallint check (planned_reps_max is null or planned_reps_max between 1 and 100),
  planned_rest_seconds int check (planned_rest_seconds is null or planned_rest_seconds between 5 and 1800),
  status text not null default 'todo' check (status in ('todo', 'done', 'skipped')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint workout_session_exercises_one_ref check (num_nonnulls(catalog_id, user_exercise_id) <= 1),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  foreign key (user_exercise_id, user_id) references public.user_exercises (id, user_id) on delete set null (user_exercise_id)
);
create index workout_session_exercises_user_idx on public.workout_session_exercises (user_id);
create index workout_session_exercises_session_idx on public.workout_session_exercises (session_id);
create index workout_session_exercises_catalog_idx on public.workout_session_exercises (user_id, catalog_id) where catalog_id is not null;
create index workout_session_exercises_custom_idx on public.workout_session_exercises (user_id, user_exercise_id) where user_exercise_id is not null;

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_exercise_id uuid not null,
  set_number int not null check (set_number between 1 and 50),
  kind text not null default 'normal' check (kind in ('warmup', 'normal', 'drop')),
  weight_kg numeric(6, 1) check (weight_kg is null or weight_kg between 0 and 1000),
  reps smallint check (reps is null or reps between 0 and 200),
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (session_exercise_id, user_id) references public.workout_session_exercises (id, user_id) on delete cascade
);
create index workout_sets_user_idx on public.workout_sets (user_id);
create index workout_sets_exercise_idx on public.workout_sets (session_exercise_id);

alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;
revoke all on table public.workout_sessions, public.workout_session_exercises, public.workout_sets from public, anon, authenticated;
grant select, insert, update, delete on table public.workout_sessions, public.workout_session_exercises, public.workout_sets to authenticated;

create policy "workout_sessions_select_own" on public.workout_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sessions_insert_own" on public.workout_sessions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_sessions_update_own" on public.workout_sessions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_sessions_delete_own" on public.workout_sessions for delete to authenticated using (user_id = (select auth.uid()));

create policy "workout_session_exercises_select_own" on public.workout_session_exercises for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_session_exercises_insert_own" on public.workout_session_exercises for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_session_exercises_update_own" on public.workout_session_exercises for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_session_exercises_delete_own" on public.workout_session_exercises for delete to authenticated using (user_id = (select auth.uid()));

create policy "workout_sets_select_own" on public.workout_sets for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sets_insert_own" on public.workout_sets for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_sets_update_own" on public.workout_sets for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_sets_delete_own" on public.workout_sets for delete to authenticated using (user_id = (select auth.uid()));

-- Iniziare una sessione segna lo stato "workout" del giorno (serve ai promemoria di allenamento, Fase 8), come per i pasti
-- (migrazione 012). Gira con i permessi di chi scrive; un suo problema non impedisce mai di salvare la sessione.
create function public.mark_workout_reminder_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.reminder_status (user_id, slot, day)
  values (new.user_id, 'workout', new.session_date)
  on conflict do nothing;
  return new;
exception when others then
  return new;
end;
$$;
create trigger workout_sessions_mark_reminder_done
  after insert on public.workout_sessions
  for each row execute function public.mark_workout_reminder_done();
revoke execute on function public.mark_workout_reminder_done() from public, anon, authenticated;

-- "Ultima volta": per ogni esercizio richiesto, le serie fatte nell'ultima sessione TERMINATA in cui l'esercizio risulta fatto.
-- `security invoker`: vale la RLS di chi chiama (vede solo le proprie sessioni).
create function public.last_sets(p_catalog_ids uuid[], p_user_exercise_ids uuid[])
returns table (catalog_id uuid, user_exercise_id uuid, session_date date, set_number int, kind text, weight_kg numeric, reps smallint)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select distinct on (se.catalog_id, se.user_exercise_id) se.id, se.catalog_id, se.user_exercise_id, s.session_date
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where s.ended_at is not null
      and se.status = 'done'
      and (se.catalog_id = any (p_catalog_ids) or se.user_exercise_id = any (p_user_exercise_ids))
      and exists (select 1 from public.workout_sets w where w.session_exercise_id = se.id and w.done)
    order by se.catalog_id, se.user_exercise_id, s.started_at desc
  )
  select l.catalog_id, l.user_exercise_id, l.session_date, w.set_number, w.kind, w.weight_kg, w.reps
  from latest l
  join public.workout_sets w on w.session_exercise_id = l.id and w.done
  order by l.catalog_id, l.user_exercise_id, w.set_number;
$$;
revoke execute on function public.last_sets(uuid[], uuid[]) from public, anon;
grant execute on function public.last_sets(uuid[], uuid[]) to authenticated;

commit;
