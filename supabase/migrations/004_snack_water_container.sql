-- Migrazione 004 (step 17): snack di metà mattina e contenitore delle aggiunte d'acqua.
-- Da eseguire dopo la 003, nel SQL Editor di Supabase. Non tocca i dati esistenti:
-- le voci "snack" già registrate restano tali (nell'app si chiamano ora "Spuntino").

-- 1. Nuovo pasto 'morning_snack' ("Snack", tra colazione e pranzo).
--    Il vincolo della 001 non ha un nome scelto a mano: lo si cerca e lo si sostituisce.
do $$
declare
  old_name text;
begin
  select conname into old_name
  from pg_constraint
  where conrelid = 'public.meal_entries'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%meal_type%';
  if old_name is not null then
    execute format('alter table public.meal_entries drop constraint %I', old_name);
  end if;
end $$;

alter table public.meal_entries
  add constraint meal_entries_meal_type_check
  check (meal_type in ('breakfast', 'morning_snack', 'lunch', 'dinner', 'snack'));

-- 2. Da quale contenitore viene un'aggiunta d'acqua (per il conteggio "− N +" di ogni contenitore).
--    'glass' / 'small-bottle' / 'bottle' per i tre rapidi, l'id di drink_containers per quelli personali,
--    null per una quantità libera. Testo e non chiave esterna: eliminare un contenitore non tocca le aggiunte.
alter table public.water_entries
  add column container text check (container is null or length(container) between 1 and 64);
