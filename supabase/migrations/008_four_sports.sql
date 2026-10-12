-- Migrazione 008 (step 21): fino a 4 sport e giorni con più sport insieme.
-- Da eseguire dopo la 007, nel SQL Editor di Supabase. Non cancella dati.

-- 1. Sport del profilo: da 2 a 4. Il vecchio vincolo non ha un nome scelto a mano: lo si cerca e lo si sostituisce.
do $$
declare
  old_name text;
begin
  select conname into old_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%sports%';
  if old_name is not null then
    execute format('alter table public.profiles drop constraint %I', old_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_sports_check
  check (jsonb_typeof(sports) = 'array' and jsonb_array_length(sports) <= 4);

-- 2. Tipo di giorno: 'rest', oppure gli sport fatti quel giorno come 'sport_1', 'sport_1+sport_3' (numeri in ordine,
--    posizione dello sport nell'elenco del profilo). Il vecchio 'both' (due sport) diventa 'sport_1+sport_2'.
alter table public.daily_targets drop constraint daily_targets_training_type_check;

update public.daily_targets set training_type = 'sport_1+sport_2' where training_type = 'both';

alter table public.daily_targets
  add constraint daily_targets_training_type_check
  check (training_type = 'rest' or training_type ~ '^sport_[1-4](\+sport_[1-4]){0,3}$');
