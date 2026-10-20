-- Prova di public.due_reminders() (Fase 2, ADR-087): chi riceve un promemoria, a che ora, anche nei giorni del cambio d'ora.
-- Gira nel database di prova (CI: dopo init-db.sh) e si può eseguire anche nel SQL Editor di Supabase: crea un utente
-- finto @example.invalid, controlla, e annulla tutto (rollback finale). Se un controllo fallisce: errore "FALLITO: …".
-- Dati fittizi, nessun dato reale.
begin;

do $$
declare
  u uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (u, 'prova-promemoria-' || u || '@example.invalid');
  insert into auth.users (id, email) values (other, 'prova-promemoria-' || other || '@example.invalid');
  insert into public.meal_slots (user_id, slot_key, name, position)
  values (u, 'lunch', 'Pranzo', 2), (u, 'dinner', 'Cena', 3), (other, 'lunch', 'Pranzo', 2);
  insert into public.push_subscriptions (user_id, endpoint, p256dh_key, auth_secret)
  values (u, 'https://example.invalid/push/a', repeat('k', 24), repeat('s', 12)), (other, 'https://example.invalid/push/b', repeat('k', 24), repeat('s', 12));
  -- Pranzo 12:30 nei giorni feriali, 10:00 nel fine settimana; cena 20:00 senza orario diverso; l'altro utente è disattivato.
  insert into public.reminder_settings (user_id, slot, enabled, time_weekday, time_weekend)
  values (u, 'meal:lunch', true, '12:30', '10:00'),
         (u, 'meal:dinner', true, '20:00', null),
         (other, 'meal:lunch', false, '12:30', null);
end $$;

-- I controlli veri: ogni riga è (etichetta, istante UTC, slot, atteso).
do $$
declare
  c record;
  got int;
begin
  for c in
    select * from (values
      -- Martedì 20/10/2026, ora legale (UTC+2): il pranzo delle 12:30 è alle 10:30 UTC.
      ('feriale: un minuto prima',        '2026-10-20 10:29:00+00'::timestamptz, 'meal:lunch', 0),
      ('feriale: all''ora esatta',        '2026-10-20 10:30:00+00', 'meal:lunch', 1),
      ('feriale: 59 minuti dopo',         '2026-10-20 11:29:00+00', 'meal:lunch', 1),
      ('feriale: oltre la finestra',      '2026-10-20 11:30:00+00', 'meal:lunch', 0),
      ('feriale: la cena non c''entra',   '2026-10-20 10:30:00+00', 'meal:dinner', 0),
      ('cena senza orario weekend',       '2026-10-20 18:00:00+00', 'meal:dinner', 1),
      -- Sabato 24/10/2026: orario del fine settimana, 10:00 locale = 08:00 UTC.
      ('sabato: orario weekend',          '2026-10-24 08:00:00+00', 'meal:lunch', 1),
      ('sabato: non quello feriale',      '2026-10-24 10:30:00+00', 'meal:lunch', 0),
      ('sabato: cena come in settimana',  '2026-10-24 18:00:00+00', 'meal:dinner', 1),
      -- Domenica 25/10/2026: alle 03:00 locale si torna indietro (UTC+2 → UTC+1). Orario weekend 10:00 locale = 09:00 UTC.
      ('cambio d''ora autunno: 10:00 CET', '2026-10-25 09:00:00+00', 'meal:lunch', 1),
      ('cambio d''ora autunno: non 08:00Z', '2026-10-25 08:00:00+00', 'meal:lunch', 0),
      ('autunno: cena 20:00 CET = 19:00Z', '2026-10-25 19:00:00+00', 'meal:dinner', 1),
      -- Lunedì 26/10/2026, ora solare (UTC+1): 12:30 locale = 11:30 UTC.
      ('lunedì dopo il cambio: 11:30Z',    '2026-10-26 11:30:00+00', 'meal:lunch', 1),
      ('lunedì dopo il cambio: non 10:30Z', '2026-10-26 10:30:00+00', 'meal:lunch', 0),
      -- Domenica 28/3/2027: alle 02:00 locale si va avanti (UTC+1 → UTC+2). Orario weekend 10:00 locale = 08:00 UTC.
      ('cambio d''ora primavera: 10:00 CEST', '2027-03-28 08:00:00+00', 'meal:lunch', 1),
      ('primavera: non 09:00Z',           '2027-03-28 09:00:00+00', 'meal:lunch', 0),
      -- Lunedì 29/3/2027, ora legale: 12:30 locale = 10:30 UTC.
      ('lunedì dopo il cambio primavera', '2027-03-29 10:30:00+00', 'meal:lunch', 1),
      -- Mezzanotte locale: 23:30 UTC del 20/10 è già il 21/10 (01:30): niente pranzo.
      ('giorno locale, non UTC',          '2026-10-20 23:30:00+00', 'meal:lunch', 0)
    ) as t (label, at, slot, expected)
  loop
    select count(*) into got
    from public.due_reminders(c.at) d
    where d.reminder_slot = c.slot
      and d.reminder_user = (select user_id from public.reminder_settings where slot = 'meal:dinner' and enabled limit 1);
    if got <> c.expected then
      raise exception 'FALLITO: % (atteso %, trovato %)', c.label, c.expected, got;
    end if;
  end loop;
end $$;

-- Esclusioni: già fatto, già mandato, nessun dispositivo, pasto cancellato, disattivato.
do $$
declare
  u uuid := (select user_id from public.reminder_settings where slot = 'meal:dinner' and enabled limit 1);
  at timestamptz := '2026-10-20 10:30:00+00';
  n int;
begin
  insert into public.reminder_status (user_id, slot, day) values (u, 'meal:lunch', '2026-10-20');
  select count(*) into n from public.due_reminders(at) where reminder_user = u and reminder_slot = 'meal:lunch';
  if n <> 0 then raise exception 'FALLITO: promemoria dovuto anche se il pasto è già registrato'; end if;
  select count(*) into n from public.due_reminders('2026-10-21 10:30:00+00') where reminder_user = u and reminder_slot = 'meal:lunch';
  if n <> 1 then raise exception 'FALLITO: lo stato "fatto" di ieri non deve valere per oggi'; end if;
  delete from public.reminder_status;

  insert into public.reminder_log (user_id, slot, day, accepted) values (u, 'meal:lunch', '2026-10-20', 1);
  select count(*) into n from public.due_reminders(at) where reminder_user = u and reminder_slot = 'meal:lunch';
  if n <> 0 then raise exception 'FALLITO: promemoria rimandato dopo che è già partito oggi'; end if;
  delete from public.reminder_log;

  update public.reminder_settings set enabled = false where user_id = u and slot = 'meal:lunch';
  select count(*) into n from public.due_reminders(at) where reminder_user = u and reminder_slot = 'meal:lunch';
  if n <> 0 then raise exception 'FALLITO: promemoria dovuto anche se disattivato'; end if;
  update public.reminder_settings set enabled = true where user_id = u and slot = 'meal:lunch';

  delete from public.meal_slots where user_id = u and slot_key = 'lunch';
  select count(*) into n from public.due_reminders(at) where reminder_user = u and reminder_slot = 'meal:lunch';
  if n <> 0 then raise exception 'FALLITO: promemoria dovuto per un pasto cancellato'; end if;

  delete from public.push_subscriptions where user_id = u;
  select count(*) into n from public.due_reminders('2026-10-20 18:00:00+00') where reminder_user = u;
  if n <> 0 then raise exception 'FALLITO: promemoria dovuto senza nessun dispositivo'; end if;
end $$;

-- Il trigger segna il pasto come registrato (aggiunta e spostamento di una voce) e non blocca mai il salvataggio.
do $$
declare
  u uuid := (select user_id from public.reminder_settings where slot = 'meal:dinner' and enabled limit 1);
  entry uuid := gen_random_uuid();
  n int;
begin
  insert into public.meal_slots (user_id, slot_key, name, position) values (u, 'lunch', 'Pranzo', 2) on conflict do nothing;
  insert into public.meal_entries (id, user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g)
  values (entry, u, '2026-10-22', 'lunch', 'Cibo di prova', 100, 100, 1, 1, 1);
  select count(*) into n from public.reminder_status where user_id = u and slot = 'meal:lunch' and day = '2026-10-22';
  if n <> 1 then raise exception 'FALLITO: voce aggiunta ma pasto non segnato come registrato'; end if;
  select count(*) into n from public.due_reminders('2026-10-22 10:30:00+00') where reminder_user = u and reminder_slot = 'meal:lunch';
  if n <> 0 then raise exception 'FALLITO: promemoria dovuto dopo la registrazione del pasto'; end if;

  update public.meal_entries set meal_type = 'dinner' where id = entry;
  select count(*) into n from public.reminder_status where user_id = u and slot = 'meal:dinner' and day = '2026-10-22';
  if n <> 1 then raise exception 'FALLITO: voce spostata ma il nuovo pasto non è segnato'; end if;

  update public.meal_entries set grams = 120 where id = entry;
  select count(*) into n from public.reminder_status where user_id = u and day = '2026-10-22';
  if n <> 2 then raise exception 'FALLITO: righe di stato inattese (%)', n; end if;
end $$;

-- Permessi: l'app (authenticated) e i visitatori (anon) non chiamano le due funzioni; l'utente non scrive il registro.
do $$
declare
  fn text;
begin
  foreach fn in array array['public.due_reminders(timestamptz)', 'public.verify_cron_secret(text)'] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FALLITO: % eseguibile da anon o authenticated', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FALLITO: % non eseguibile da service_role', fn;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.reminder_log', 'insert,update,delete')
     or has_table_privilege('anon', 'public.reminder_log', 'select') then
    raise exception 'FALLITO: permessi sbagliati su reminder_log';
  end if;
end $$;

select 'due_reminders verificata: tutti i controlli superati' as esito;
rollback;
