-- Verifica RLS con due utenti (docs/SECURITY.md) · da eseguire nel SQL Editor di Supabase
--
-- Cosa fa:
--   1. crea due utenti di prova (A e B) con email finte @example.invalid;
--   2. "diventa" A, come farebbe l'app dopo il login, e inserisce una riga in ogni tabella;
--   3. "diventa" B e prova a leggere, modificare, cancellare le righe di A e a scriverne a nome di A;
--   4. "diventa" un visitatore senza login (anon) e prova a leggere e scrivere;
--   5. cancella i due utenti di prova (e a cascata tutte le loro righe).
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
  tables text[] := array['profiles', 'foods', 'recipe_items', 'meal_entries', 'weight_logs', 'daily_targets', 'tdee_estimates'];
begin
  -- ─── 0. Struttura ────────────────────────────────────────────────────────
  select count(*) into n from pg_tables where schemaname = 'public' and tablename = any (tables);
  if n <> 7 then raise exception 'FALLITO: trovate % tabelle su 7. La migrazione 001 è stata eseguita?', n; end if;

  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  if n > 0 then raise exception 'FALLITO: % tabelle in public senza RLS attiva', n; end if;

  select count(*) into n from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';
  if n > 0 then raise exception 'FALLITO: ci sono % permessi su tabelle di public per anon', n; end if;

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

  -- ─── 5. Pulizia ──────────────────────────────────────────────────────────
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (a, b); -- cancella a cascata anche le loro righe

  select count(*) into n from public.foods where user_id in (a, b);
  if n > 0 then raise exception 'FALLITO: la cancellazione a cascata ha lasciato % cibi', n; end if;
end;
$$;

select 'RLS verificata: tutti i controlli superati' as esito;
