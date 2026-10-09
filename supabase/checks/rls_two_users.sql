-- Verifica RLS con due utenti (docs/SECURITY.md) · da eseguire nel SQL Editor di Supabase
--
-- Cosa fa:
--   1. crea due utenti di prova (A e B) con email finte @example.invalid;
--   2. "diventa" A, come farebbe l'app dopo il login, e inserisce una riga in ogni tabella;
--   3. "diventa" B e prova a leggere, modificare, cancellare le righe di A e a scriverne a nome di A;
--   4. "diventa" un visitatore senza login (anon) e prova a leggere e scrivere;
--   5. (migrazione 005) invito: email non invitata rifiutata, invitata accettata; elenco invisibile all'app;
--      delete_my_account di A cancella tutto di A e niente di B; anon non può chiamarla;
--   6. cancella i due utenti di prova (e a cascata tutte le loro righe).
-- Se un controllo fallisce si ferma con un errore che inizia con "FALLITO" e annulla tutto.
-- Se va tutto bene l'ultima riga mostra: "RLS verificata: tutti i controlli superati".
--
-- Non contiene dati reali: valori del profilo fittizio di docs/DOMAIN_RULES.md.
-- Si può rieseguire quante volte si vuole (gli utenti di prova hanno id casuali e vengono cancellati).

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_ingredient uuid;
  a_recipe uuid;
  b_food uuid;
  n int;
  t text;
  b_before jsonb := '{}'::jsonb;
  hook_result jsonb;
  invited text := 'rls-invitato-' || gen_random_uuid() || '@example.invalid';
  tables text[] := array['profiles', 'foods', 'recipe_items', 'meal_entries', 'weight_logs', 'daily_targets', 'tdee_estimates'];
  -- Tabelle della migrazione 003 (step 14-15), controllate solo se esistono.
  extra text[] := array['water_entries', 'drink_containers'];
begin
  -- ─── 0. Struttura ────────────────────────────────────────────────────────
  select count(*) into n from pg_tables where schemaname = 'public' and tablename = any (tables);
  if n <> 7 then raise exception 'FALLITO: trovate % tabelle su 7. La migrazione 001 è stata eseguita?', n; end if;
  foreach t in array extra loop
    if to_regclass('public.' || t) is not null then tables := tables || t; end if;
  end loop;

  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  if n > 0 then raise exception 'FALLITO: % tabelle in public senza RLS attiva', n; end if;

  select count(*) into n from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';
  if n > 0 then raise exception 'FALLITO: ci sono % permessi su tabelle di public per anon', n; end if;

  -- ADR-021: agli utenti loggati solo select/insert/update/delete (niente TRUNCATE, REFERENCES, TRIGGER).
  select count(*) into n from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated'
    and privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  if n > 0 then raise exception 'FALLITO: % permessi in più per authenticated (ammessi solo i 4 di ADR-021)', n; end if;

  -- ─── 1. Due utenti di prova ──────────────────────────────────────────────
  insert into auth.users (id, email, aud, role) values
    (a, 'rls-a-' || a || '@example.invalid', 'authenticated', 'authenticated'),
    (b, 'rls-b-' || b || '@example.invalid', 'authenticated', 'authenticated');

  -- ─── 2. Come A: una riga in ogni tabella ─────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.profiles (sex, birth_date, height_cm) values ('male', date '2006-01-01', 180.0);
  insert into public.foods (name, kcal_100g, protein_100g, carbs_100g, fat_100g)
    values ('Cibo di prova', 350, 10, 70, 2) returning id into a_ingredient;
  insert into public.foods (name, source, kcal_100g, protein_100g, carbs_100g, fat_100g, cooked_weight_g)
    values ('Ricetta di prova', 'recipe', 150, 5, 25, 3, 500) returning id into a_recipe;
  insert into public.recipe_items (recipe_food_id, ingredient_food_id, grams) values (a_recipe, a_ingredient, 100);
  insert into public.meal_entries (entry_date, meal_type, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g)
    values (current_date, 'lunch', a_ingredient, 'Cibo di prova', 100, 350, 10, 70, 2);
  insert into public.weight_logs (log_date, weight_kg) values (current_date, 75.0);
  insert into public.daily_targets (target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal)
    values (current_date, 'rest', 3130, 150, 464, 75, 2848);
  insert into public.tdee_estimates (week_start, window_days, status) values (current_date, 21, 'none');
  if 'water_entries' = any (tables) then
    insert into public.water_entries (entry_date, ml) values (current_date, 200);
    insert into public.drink_containers (name, ml) values ('Borraccia di prova', 750);
  end if;

  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n;
    if n = 0 then raise exception 'FALLITO: A non vede le proprie righe in %', t; end if;
    execute format('select count(*) from public.%I where user_id <> %L', t, a) into n;
    if n > 0 then raise exception 'FALLITO: A vede righe non sue in %', t; end if;
  end loop;

  -- ─── 3. Come B: le righe di A sono invisibili e intoccabili ──────────────
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then raise exception 'FALLITO: B legge % righe di A in %', n, t; end if;

    execute format('update public.%I set user_id = user_id', t);
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FALLITO: B ha modificato % righe di A in %', n, t; end if;

    execute format('delete from public.%I', t);
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FALLITO: B ha cancellato % righe di A in %', n, t; end if;
  end loop;

  -- B non può scrivere righe a nome di A (una per tabella).
  begin
    insert into public.profiles (user_id, sex, birth_date, height_cm) values (a, 'male', date '2006-01-01', 180.0);
    raise exception 'FALLITO: B ha inserito in profiles a nome di A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.foods (user_id, name, kcal_100g, protein_100g, carbs_100g, fat_100g) values (a, 'x', 1, 1, 1, 1);
    raise exception 'FALLITO: B ha inserito in foods a nome di A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.recipe_items (user_id, recipe_food_id, ingredient_food_id, grams) values (a, a_recipe, a_ingredient, 1);
    raise exception 'FALLITO: B ha inserito in recipe_items a nome di A';
  -- il trigger delle ricette può fermarlo prima della RLS (B non vede i cibi di A): va bene lo stesso
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g)
      values (a, current_date, 'snack', 'x', 1, 1, 1, 1, 1);
    raise exception 'FALLITO: B ha inserito in meal_entries a nome di A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.weight_logs (user_id, log_date, weight_kg) values (a, current_date - 1, 75.0);
    raise exception 'FALLITO: B ha inserito in weight_logs a nome di A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.daily_targets (user_id, target_date, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal)
      values (a, current_date - 1, 1, 1, 1, 1, 1);
    raise exception 'FALLITO: B ha inserito in daily_targets a nome di A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tdee_estimates (user_id, week_start, window_days) values (a, current_date, 21);
    raise exception 'FALLITO: B ha inserito in tdee_estimates a nome di A';
  exception when insufficient_privilege then null;
  end;

  if 'water_entries' = any (tables) then
    begin
      execute format('insert into public.water_entries (user_id, entry_date, ml) values (%L, current_date, 100)', a);
      raise exception 'FALLITO: B ha inserito in water_entries a nome di A';
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('insert into public.drink_containers (user_id, name, ml) values (%L, %L, 100)', a, 'x');
      raise exception 'FALLITO: B ha inserito in drink_containers a nome di A';
    exception when insufficient_privilege then null;
    end;
  end if;

  -- B non può "regalare" una sua riga ad A.
  insert into public.foods (name, kcal_100g, protein_100g, carbs_100g, fat_100g) values ('Cibo di B', 1, 1, 1, 1)
    returning id into b_food;
  begin
    update public.foods set user_id = a where id = b_food;
    raise exception 'FALLITO: B ha spostato una sua riga su A';
  exception when insufficient_privilege then null;
  end;

  -- B non può collegare le sue righe ai cibi di A (chiavi esterne composte).
  begin
    insert into public.recipe_items (recipe_food_id, ingredient_food_id, grams) values (a_recipe, b_food, 1);
    raise exception 'FALLITO: B ha aggiunto un ingrediente alla ricetta di A';
  exception when foreign_key_violation or check_violation then null;
  end;
  begin
    insert into public.meal_entries (entry_date, meal_type, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g)
      values (current_date, 'snack', a_ingredient, 'x', 1, 1, 1, 1, 1);
    raise exception 'FALLITO: B ha registrato un pasto con un cibo di A';
  exception when foreign_key_violation then null;
  end;

  -- B non può modificare la ricetta di A con save_recipe (migrazione 002), se presente.
  if to_regprocedure('public.save_recipe(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb)') is not null then
    begin
      perform public.save_recipe(a_recipe, 'x', 100, 1, 1, 1, 1,
        jsonb_build_array(jsonb_build_object('ingredient_food_id', b_food, 'grams', 1)));
      raise exception 'FALLITO: B ha modificato la ricetta di A con save_recipe';
    exception when no_data_found then null;
    end;
    -- ...né usare un cibo di A come ingrediente di una sua ricetta.
    begin
      perform public.save_recipe(null, 'Ricetta di B', 100, 1, 1, 1, 1,
        jsonb_build_array(jsonb_build_object('ingredient_food_id', a_ingredient, 'grams', 1)));
      raise exception 'FALLITO: B ha usato un cibo di A in una sua ricetta';
    exception when foreign_key_violation or check_violation then null;
    end;
  end if;

  -- ─── 4. Senza login (anon): niente lettura, niente scrittura ─────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;

  foreach t in array tables loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then raise exception 'FALLITO: senza login si leggono % righe di %', n, t; end if;
    exception when insufficient_privilege then null; -- atteso: anon non ha permessi
    end;
  end loop;
  begin
    insert into public.foods (name, kcal_100g, protein_100g, carbs_100g, fat_100g) values ('x', 1, 1, 1, 1);
    raise exception 'FALLITO: senza login si scrive in foods';
  exception when insufficient_privilege then null;
  end;
  if to_regprocedure('public.save_recipe(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb)') is not null then
    begin
      perform public.save_recipe(null, 'x', 100, 1, 1, 1, 1, '[]'::jsonb);
      raise exception 'FALLITO: senza login si chiama save_recipe';
    exception when insufficient_privilege then null;
    end;
  end if;

  -- ─── 5. Migrazione 005: inviti ed eliminazione dell'account ──────────────
  reset role;
  if to_regprocedure('public.delete_my_account()') is not null then
    -- 5a. La hook accetta solo le email nell'elenco (senza distinguere maiuscole).
    -- Nel SQL Editor di Supabase non si può "diventare" supabase_auth_admin: la logica si prova
    -- chiamando la funzione direttamente, i permessi di quel ruolo si controllano con has_*_privilege.
    if not has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') then
      raise exception 'FALLITO: supabase_auth_admin non può eseguire la hook';
    end if;
    if not has_table_privilege('supabase_auth_admin', 'public.allowed_emails', 'select') then
      raise exception 'FALLITO: supabase_auth_admin non può leggere allowed_emails';
    end if;
    if has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute')
       or has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute') then
      raise exception 'FALLITO: la hook è eseguibile da anon o authenticated';
    end if;
    insert into public.allowed_emails (email) values (invited);
    hook_result := public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', upper(invited))));
    if hook_result <> '{}'::jsonb then raise exception 'FALLITO: email invitata rifiutata: %', hook_result; end if;
    hook_result := public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'mai-invitato@example.invalid')));
    if (hook_result -> 'error' ->> 'http_code') is distinct from '403' then
      raise exception 'FALLITO: email non invitata accettata: %', hook_result;
    end if;
    hook_result := public.hook_before_user_created('{}'::jsonb);
    if hook_result -> 'error' is null then raise exception 'FALLITO: registrazione senza email accettata'; end if;
    delete from public.allowed_emails where email = invited;

    -- 5b. L'elenco degli invitati e la hook non sono raggiungibili dall'app.
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform count(*) from public.allowed_emails;
      raise exception 'FALLITO: un utente loggato legge allowed_emails';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.hook_before_user_created('{}'::jsonb);
      raise exception 'FALLITO: un utente loggato chiama la hook';
    exception when insufficient_privilege then null;
    end;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    begin
      perform count(*) from public.allowed_emails;
      raise exception 'FALLITO: senza login si legge allowed_emails';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.delete_my_account();
      raise exception 'FALLITO: senza login si chiama delete_my_account';
    exception when insufficient_privilege then null;
    end;
    reset role;

    -- 5c. B ha una riga in ogni tabella; si contano prima dell'eliminazione di A.
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.profiles (sex, birth_date, height_cm) values ('female', date '1996-01-01', 165.0);
    insert into public.foods (name, source, kcal_100g, protein_100g, carbs_100g, fat_100g, cooked_weight_g)
      values ('Ricetta di B', 'recipe', 100, 5, 10, 3, 300) returning id into a_recipe;
    insert into public.recipe_items (recipe_food_id, ingredient_food_id, grams) values (a_recipe, b_food, 50);
    insert into public.meal_entries (entry_date, meal_type, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g)
      values (current_date, 'dinner', b_food, 'Cibo di B', 100, 1, 1, 1, 1);
    insert into public.weight_logs (log_date, weight_kg) values (current_date, 60.0);
    insert into public.daily_targets (target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal)
      values (current_date, 'rest', 2000, 120, 250, 60, 1800);
    insert into public.tdee_estimates (week_start, window_days, status) values (current_date, 21, 'none');
    if 'water_entries' = any (tables) then
      insert into public.water_entries (entry_date, ml) values (current_date, 500);
      insert into public.drink_containers (name, ml) values ('Bottiglia di B', 1000);
    end if;
    reset role;
    foreach t in array tables loop
      execute format('select count(*) from public.%I where user_id = %L', t, b) into n;
      if n = 0 then raise exception 'FALLITO: B non ha righe in % prima del test', t; end if;
      b_before := b_before || jsonb_build_object(t, n);
    end loop;

    -- 5d. A elimina il proprio account: sparisce tutto di A, niente di B.
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.delete_my_account();
    reset role;
    select count(*) into n from auth.users where id = a;
    if n > 0 then raise exception 'FALLITO: delete_my_account non ha cancellato l''utente A'; end if;
    foreach t in array tables loop
      execute format('select count(*) from public.%I where user_id = %L', t, a) into n;
      if n > 0 then raise exception 'FALLITO: dopo delete_my_account restano % righe di A in %', n, t; end if;
      execute format('select count(*) from public.%I where user_id = %L', t, b) into n;
      if n <> (b_before ->> t)::int then raise exception 'FALLITO: delete_my_account di A ha toccato le righe di B in %', t; end if;
    end loop;
  end if;

  -- ─── 6. Pulizia ──────────────────────────────────────────────────────────
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (a, b); -- cancella a cascata anche le loro righe

  select count(*) into n from public.foods where user_id in (a, b);
  if n > 0 then raise exception 'FALLITO: la cancellazione a cascata ha lasciato % cibi', n; end if;
end;
$$;

select 'RLS verificata: tutti i controlli superati' as esito;

-- Elenco finale: ogni tabella di public con la RLS attiva (deve dire "sì" ovunque).
select tablename as tabella, case when rowsecurity then 'sì' else 'NO' end as rls_attiva
from pg_tables where schemaname = 'public' order by tablename;
