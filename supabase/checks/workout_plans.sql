-- Prova delle schede di allenamento (Fase 4, ADR-090): vincoli, duplicazione e protezione degli esercizi usati.
-- Gira nel database di prova (CI: dopo init-db.sh) e si può eseguire anche nel SQL Editor: crea un utente finto
-- @example.invalid e annulla tutto (rollback finale). Se un controllo fallisce: errore "FALLITO: …". Dati fittizi.
begin;

do $$
declare
  u uuid := gen_random_uuid();
  custom uuid;
  plan uuid;
  day uuid;
  copy_plan uuid;
  copy_day uuid;
  n int;
begin
  insert into auth.users (id, email) values (u, 'prova-schede-' || u || '@example.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.user_exercises (name, equipment, primary_muscles) values ('Mio esercizio', 'cable', array['lats']) returning id into custom;
  insert into public.workout_plans (name) values ('Scheda prova') returning id into plan;
  insert into public.workout_days (plan_id, name, weekday, position) values (plan, 'Push', 1, 0) returning id into day;
  insert into public.workout_days (plan_id, name, position) values (plan, 'Gambe', 1);
  insert into public.workout_day_exercises (day_id, user_exercise_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds, note)
    values (day, custom, 0, 3, 8, 12, array[60.0, null, 62.5], 90, 'nota');
  insert into public.workout_day_exercises (day_id, catalog_id, position) select day, id, 1 from public.exercise_catalog limit 1;

  -- Vincoli
  begin
    insert into public.workout_day_exercises (day_id, catalog_id, sets, weights_kg) select day, id, 2, array[10, 20, 30] from public.exercise_catalog limit 1;
    raise exception 'FALLITO: più pesi che serie accettati';
  exception when check_violation then null; end;
  begin
    insert into public.workout_day_exercises (day_id, catalog_id, weights_kg) select day, id, array[-5] from public.exercise_catalog limit 1;
    raise exception 'FALLITO: peso negativo accettato';
  exception when check_violation then null; end;
  begin
    insert into public.workout_day_exercises (day_id, catalog_id, reps_min, reps_max) select day, id, 12, 8 from public.exercise_catalog limit 1;
    raise exception 'FALLITO: intervallo di ripetizioni al contrario accettato';
  exception when check_violation then null; end;
  begin
    insert into public.workout_day_exercises (day_id, catalog_id, user_exercise_id) select day, id, custom from public.exercise_catalog limit 1;
    raise exception 'FALLITO: esercizio sia del catalogo sia personale accettato';
  exception when check_violation then null; end;
  begin
    insert into public.workout_day_exercises (day_id) values (day);
    raise exception 'FALLITO: esercizio senza riferimento accettato';
  exception when check_violation then null; end;
  begin
    insert into public.workout_days (plan_id, name, weekday) values (plan, 'x', 8);
    raise exception 'FALLITO: giorno della settimana 8 accettato';
  exception when check_violation then null; end;
  begin
    insert into public.workout_plans (name) values ('   ');
    raise exception 'FALLITO: nome di scheda vuoto accettato';
  exception when check_violation then null; end;

  -- Un esercizio usato in una scheda non si cancella.
  begin
    delete from public.user_exercises where id = custom;
    raise exception 'FALLITO: cancellato un esercizio usato in una scheda';
  exception when foreign_key_violation then null; end;

  -- Duplica scheda: giorni ed esercizi copiati, pesi compresi, nome con "(copia)".
  copy_plan := public.duplicate_workout_plan(plan);
  select count(*) into n from public.workout_days where plan_id = copy_plan;
  if n <> 2 then raise exception 'FALLITO: la copia ha % giorni invece di 2', n; end if;
  select count(*) into n from public.workout_day_exercises e join public.workout_days d on d.id = e.day_id where d.plan_id = copy_plan;
  if n <> 2 then raise exception 'FALLITO: la copia ha % esercizi invece di 2', n; end if;
  select count(*) into n from public.workout_plans where id = copy_plan and name = 'Scheda prova (copia)';
  if n <> 1 then raise exception 'FALLITO: nome della copia sbagliato'; end if;
  select count(*) into n from public.workout_day_exercises e join public.workout_days d on d.id = e.day_id
    where d.plan_id = copy_plan and weights_kg = array[60.0, null, 62.5]::numeric(6,1)[] and rest_seconds = 90 and note = 'nota';
  if n <> 1 then raise exception 'FALLITO: la copia non porta pesi, recupero e nota'; end if;
  select count(*) into n from public.workout_days where plan_id = plan;
  if n <> 2 then raise exception 'FALLITO: la scheda originale è cambiata'; end if;

  -- Duplica giorno: in fondo alla scheda, senza giorno della settimana.
  copy_day := public.duplicate_workout_day(day);
  select count(*) into n from public.workout_days where id = copy_day and plan_id = plan and weekday is null and position = 2 and name = 'Push (copia)';
  if n <> 1 then raise exception 'FALLITO: giorno duplicato sbagliato'; end if;
  select count(*) into n from public.workout_day_exercises where day_id = copy_day;
  if n <> 2 then raise exception 'FALLITO: il giorno duplicato ha % esercizi', n; end if;

  -- Cancellare una scheda cancella giorni ed esercizi; poi l'esercizio personale si può cancellare.
  delete from public.workout_plans where id in (plan, copy_plan);
  select count(*) into n from public.workout_days where plan_id in (plan, copy_plan);
  if n <> 0 then raise exception 'FALLITO: giorni rimasti dopo la cancellazione della scheda'; end if;
  delete from public.user_exercises where id = custom;

  reset role;
end $$;

-- Senza login niente: le funzioni non sono chiamabili da anon.
do $$
begin
  if has_function_privilege('anon', 'public.duplicate_workout_plan(uuid)', 'execute')
     or has_function_privilege('anon', 'public.duplicate_workout_day(uuid)', 'execute') then
    raise exception 'FALLITO: duplicate_workout_* eseguibili da anon';
  end if;
end $$;

select 'schede verificate: tutti i controlli superati' as esito;
rollback;
