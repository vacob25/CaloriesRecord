-- Migrazione 007 (step 20): pasti su misura. Ognuno crea, rinomina, ordina ed elimina i propri pasti.
-- Da eseguire dopo la 006, nel SQL Editor di Supabase. Non cancella dati: chi esiste già mantiene
-- Colazione, Snack, Pranzo, Cena e Spuntino con le voci già registrate.

-- 1. I pasti dell'utente. slot_key è l'identificativo stabile (non cambia se rinomini): i cinque di partenza
--    mantengono le vecchie chiavi, quelli nuovi hanno una chiave generata dall'app (es. custom_ab12cd34).
create table public.meal_slots (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot_key text not null check (slot_key ~ '^[a-z0-9_]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 20 and name = btrim(name)),
  position int not null check (position between 0 and 99),
  created_at timestamptz not null default now(),
  primary key (user_id, slot_key)
);

-- Due pasti dello stesso utente non possono avere lo stesso nome (senza distinguere le maiuscole).
create unique index meal_slots_user_name_key on public.meal_slots (user_id, lower(name));

alter table public.meal_slots enable row level security;
revoke all on table public.meal_slots from anon, authenticated;
grant select, insert, update, delete on table public.meal_slots to authenticated;
create policy "meal_slots_select_own" on public.meal_slots
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meal_slots_insert_own" on public.meal_slots
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meal_slots_update_own" on public.meal_slots
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meal_slots_delete_own" on public.meal_slots
  for delete to authenticated using (user_id = (select auth.uid()));

-- 2. I cinque pasti di partenza per chi esiste già (chi ha un profilo o delle voci).
insert into public.meal_slots (user_id, slot_key, name, position)
select u.user_id, d.slot_key, d.name, d.position
from (select user_id from public.profiles union select user_id from public.meal_entries) as u
cross join (values
  ('breakfast', 'Colazione', 0),
  ('morning_snack', 'Snack', 1),
  ('lunch', 'Pranzo', 2),
  ('dinner', 'Cena', 3),
  ('snack', 'Spuntino', 4)
) as d (slot_key, name, position)
on conflict do nothing;

-- 3. Gli stessi cinque pasti per chi crea il profilo da adesso in poi.
--    Funzione con i permessi di chi la chiama: la riga è dell'utente stesso, quindi la RLS la lascia passare.
create function public.seed_meal_slots()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.meal_slots (user_id, slot_key, name, position)
  values
    (new.user_id, 'breakfast', 'Colazione', 0),
    (new.user_id, 'morning_snack', 'Snack', 1),
    (new.user_id, 'lunch', 'Pranzo', 2),
    (new.user_id, 'dinner', 'Cena', 3),
    (new.user_id, 'snack', 'Spuntino', 4)
  on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_seed_meal_slots
  after insert on public.profiles
  for each row execute function public.seed_meal_slots();

-- 4. Le voci del diario puntano al pasto: sostituisce il vecchio elenco fisso di cinque valori.
--    NO ACTION (non RESTRICT): un pasto con voci non si può eliminare, ma cancellando l'account
--    le righe spariscono insieme e senza errori.
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
  add constraint meal_entries_slot_fkey
  foreign key (user_id, meal_type) references public.meal_slots (user_id, slot_key);
