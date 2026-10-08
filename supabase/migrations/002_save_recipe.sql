-- 002_save_recipe.sql · Salvataggio atomico di una ricetta (step 4)
--
-- Da eseguire UNA volta nel SQL Editor di Supabase, dopo la 001.
--
-- Perché una funzione: una ricetta è una riga di `foods` più le sue righe di
-- `recipe_items`. supabase-js non può fare transazioni: con più chiamate, un
-- errore a metà lascerebbe una ricetta senza ingredienti. Qui è tutto o niente.
--
-- security invoker (il default): gira con i permessi di chi la chiama, quindi
-- la RLS vale anche qui dentro. Nessun security definer (docs/SECURITY.md).
-- I valori per 100 g li calcola l'app (src/lib/nutrition.ts, con test).

begin;

create function public.save_recipe(
  p_recipe_id uuid,            -- null = nuova ricetta
  p_name text,
  p_cooked_weight_g numeric,
  p_kcal_100g numeric,
  p_protein_100g numeric,
  p_carbs_100g numeric,
  p_fat_100g numeric,
  p_items jsonb                -- [{"ingredient_food_id": "<uuid>", "grams": 120}, ...]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Una ricetta deve avere almeno un ingrediente' using errcode = 'check_violation';
  end if;

  if p_recipe_id is null then
    insert into public.foods (name, source, kcal_100g, protein_100g, carbs_100g, fat_100g, cooked_weight_g)
    values (p_name, 'recipe', p_kcal_100g, p_protein_100g, p_carbs_100g, p_fat_100g, p_cooked_weight_g)
    returning id into v_id;
  else
    update public.foods
    set name = p_name,
        kcal_100g = p_kcal_100g,
        protein_100g = p_protein_100g,
        carbs_100g = p_carbs_100g,
        fat_100g = p_fat_100g,
        cooked_weight_g = p_cooked_weight_g
    where id = p_recipe_id and source = 'recipe'
    returning id into v_id;
    -- Nessuna riga: la ricetta non esiste o è di un altro utente (la RLS la nasconde).
    if v_id is null then
      raise exception 'Ricetta non trovata' using errcode = 'no_data_found';
    end if;
    delete from public.recipe_items where recipe_food_id = v_id;
  end if;

  insert into public.recipe_items (recipe_food_id, ingredient_food_id, grams)
  select v_id, (item ->> 'ingredient_food_id')::uuid, (item ->> 'grams')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

-- Le funzioni nuove sono eseguibili da tutti per default: si restringe ai soli utenti collegati.
revoke execute on function public.save_recipe(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb)
  from public, anon;
grant execute on function public.save_recipe(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb)
  to authenticated;

commit;
