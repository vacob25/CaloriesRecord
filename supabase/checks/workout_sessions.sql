-- Prova delle sessioni di allenamento (Fase 5a, ADR-091): vincoli, istantanea, "ultima volta", stato "workout" e storico che sopravvive.
-- Gira nel database di prova (CI: dopo init-db.sh) e si può eseguire anche nel SQL Editor: crea due utenti finti
-- @example.invalid e annulla tutto (rollback finale). Se un controllo fallisce: errore "FALLITO: …". Dati fittizi.
begin;

do $$
declare
  u uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  plan uuid;
  the_day uuid;
  custom uuid;
  catalog uuid;
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  e3 uuid := gen_random_uuid();
  n int;
  r record;
begin
  insert into auth.users (id, email) values (u, 'prova-sessioni-' || u || '@example.invalid'), (other, 'prova-sessioni2-' || other || '@example.invalid');
  select id into catalog from public.exercise_catalog limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.user_exercises (name, equipment, primary_muscles) values ('Mio esercizio', 'cable', array['lats']) returning id into custom;
  insert into public.workout_plans (name) values ('Scheda') returning id into plan;
  insert into public.workout_days (plan_id, name) values (plan, 'Push') returning id into the_day;

  -- Sessione 1 (terminata) con istantanea e serie.
  insert into public.workout_sessions (id, session_date, started_at, ended_at, plan_id, day_id, plan_name, day_name)
    values (s1, '2026-10-19', '2026-10-19 16:00+00', '2026-10-19 17:00+00', plan, the_day, 'Scheda', 'Push');
  insert into public.workout_session_exercises (id, session_id, position, exercise_name, equipment, primary_muscles, catalog_id, status, planned_sets, planned_reps_min)
    values (e1, s1, 0, 'Nome di allora', 'dumbbell', array['chest'], catalog, 'done', 3, 8);
  insert into public.workout_session_exercises (id, session_id, position, exercise_name, equipment, primary_muscles, user_exercise_id, status)
    values (e2, s1, 1, 'Mio esercizio', 'cable', array['lats'], custom, 'skipped');
  insert into public.workout_sets (session_exercise_id, set_number, kind, weight_kg, reps, done, completed_at) values
    (e1, 1, 'warmup', 20, 12, true, now()), (e1, 2, 'normal', 60, 8, true, now()), (e1, 3, 'normal', 62.5, 6, false, null);

  -- Il trigger ha segnato lo stato "workout" del giorno.
  select count(*) into n from public.reminder_status where slot = 'workout' and day = '2026-10-19';
  if n <> 1 then raise exception 'FALLITO: stato workout non segnato'; end if;

  -- Vincoli
  begin insert into public.workout_sets (session_exercise_id, set_number, weight_kg) values (e1, 4, 1001); raise exception 'FALLITO: peso 1001 accettato'; exception when check_violation then null; end;
  begin insert into public.workout_sets (session_exercise_id, set_number, kind) values (e1, 4, 'boh'); raise exception 'FALLITO: tipo di serie sconosciuto accettato'; exception when check_violation then null; end;
  begin insert into public.workout_sets (session_exercise_id, set_number) values (e1, 0); raise exception 'FALLITO: serie numero 0 accettata'; exception when check_violation then null; end;
  begin update public.workout_session_exercises set status = 'boh' where id = e1; raise exception 'FALLITO: stato sconosciuto accettato'; exception when check_violation then null; end;
  begin update public.workout_sessions set ended_at = '2026-10-19 15:00+00' where id = s1; raise exception 'FALLITO: fine prima dell''inizio accettata'; exception when check_violation then null; end;
  begin
    insert into public.workout_session_exercises (session_id, exercise_name, equipment, catalog_id, user_exercise_id) values (s1, 'x', 'other', catalog, custom);
    raise exception 'FALLITO: doppio riferimento accettato';
  exception when check_violation then null; end;

  -- "Ultima volta": solo sessioni terminate, esercizi fatti, serie fatte.
  select count(*) into n from public.last_sets(array[catalog], array[custom]);
  if n <> 2 then raise exception 'FALLITO: last_sets ha % righe invece di 2 (le due serie fatte)', n; end if;
  select count(*) into n from public.last_sets(array[catalog], array[]::uuid[]) where user_exercise_id is not null;
  if n <> 0 then raise exception 'FALLITO: last_sets ha restituito un esercizio non richiesto'; end if;
  -- L'esercizio saltato non conta come "ultima volta".
  select count(*) into n from public.last_sets(array[]::uuid[], array[custom]);
  if n <> 0 then raise exception 'FALLITO: last_sets usa un esercizio saltato'; end if;

  -- Sessione 2 non terminata: non conta. Sessione 3 terminata più recente: vince.
  insert into public.workout_sessions (id, session_date, started_at) values (s2, '2026-10-20', '2026-10-20 16:00+00');
  insert into public.workout_session_exercises (id, session_id, exercise_name, equipment, catalog_id, status) values (e3, s2, 'Nome di oggi', 'dumbbell', catalog, 'done');
  insert into public.workout_sets (session_exercise_id, set_number, weight_kg, reps, done) values (e3, 1, 70, 5, true);
  select count(*) into n from public.last_sets(array[catalog], array[]::uuid[]) where weight_kg = 70;
  if n <> 0 then raise exception 'FALLITO: last_sets usa una sessione non terminata'; end if;
  update public.workout_sessions set ended_at = '2026-10-20 17:00+00' where id = s2;
  select count(*) into n from public.last_sets(array[catalog], array[]::uuid[]) where weight_kg = 70 and session_date = '2026-10-20';
  if n <> 1 then raise exception 'FALLITO: last_sets non prende la sessione più recente'; end if;

  -- L'istantanea non cambia se l'esercizio viene rinominato o l'esercizio personale eliminato; lo storico sopravvive alla scheda.
  insert into public.user_exercises (catalog_id, name) values (catalog, 'Rinominato dopo');
  select exercise_name into r from public.workout_session_exercises where id = e1;
  if r.exercise_name <> 'Nome di allora' then raise exception 'FALLITO: l''istantanea è cambiata'; end if;
  delete from public.workout_plans where id = plan;
  select count(*) into n from public.workout_sessions where id = s1 and plan_id is null and day_id is null and plan_name = 'Scheda' and day_name = 'Push';
  if n <> 1 then raise exception 'FALLITO: eliminando la scheda la sessione ha perso i nomi o non ha azzerato i riferimenti'; end if;
  delete from public.user_exercises where id = custom;
  select count(*) into n from public.workout_session_exercises where id = e2 and user_exercise_id is null and exercise_name = 'Mio esercizio';
  if n <> 1 then raise exception 'FALLITO: eliminando l''esercizio personale lo storico ha perso il nome'; end if;

  -- Un altro utente non vede niente, nemmeno con last_sets.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.last_sets(array[catalog], array[]::uuid[]);
  if n <> 0 then raise exception 'FALLITO: last_sets mostra le serie di un altro utente'; end if;
  select count(*) into n from public.workout_sessions;
  if n <> 0 then raise exception 'FALLITO: un altro utente vede le sessioni'; end if;
  begin
    insert into public.workout_sets (session_exercise_id, set_number) values (e1, 9);
    raise exception 'FALLITO: un altro utente ha aggiunto una serie alla sessione di un altro';
  exception when foreign_key_violation then null; end;
  reset role;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.last_sets(uuid[], uuid[])', 'execute') then raise exception 'FALLITO: last_sets eseguibile da anon'; end if;
  if has_function_privilege('authenticated', 'public.mark_workout_reminder_done()', 'execute') then raise exception 'FALLITO: la funzione trigger è eseguibile dall''app'; end if;
end $$;

select 'sessioni verificate: tutti i controlli superati' as esito;
rollback;
