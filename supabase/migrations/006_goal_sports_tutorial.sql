-- Migrazione 006 (step 19): obiettivo (massa / mantenimento / cut), sport personali, tutorial.
-- Da eseguire dopo la 005, nel SQL Editor di Supabase. Non cancella dati.
-- Chi ha già un profilo resta com'era: obiettivo "massa" e giorni Riposo / Palestra / Calcio / Palestra + calcio.

-- 1. Obiettivo del profilo.
--    goal: bulk = massa, maintain = mantenimento, cut = definizione.
--    surplus_pct vale per il massa (invariato). Per il cut conta il ritmo di perdita in % del peso a settimana.
alter table public.profiles
  add column goal text not null default 'bulk' check (goal in ('bulk', 'maintain', 'cut'));
alter table public.profiles
  add column cut_rate_pct numeric(4,3) not null default 0.005 check (cut_rate_pct > 0 and cut_rate_pct <= 0.05);

-- 2. Sport dell'utente (testo libero, al massimo 2): da questi derivano i tipi di giorno.
alter table public.profiles
  add column sports jsonb not null default '[]'::jsonb
  check (jsonb_typeof(sports) = 'array' and jsonb_array_length(sports) <= 2);
-- I profili esistenti avevano i giorni Palestra e Calcio: si conservano come sport.
update public.profiles set sports = '["Palestra", "Calcio"]'::jsonb;

-- 3. Tutorial visto (null = da mostrare). Per chi esiste già si mostra una volta alla prossima apertura.
alter table public.profiles add column tutorial_done_at timestamptz;

-- 4. Tipo di giorno generico: 'sport_1' e 'sport_2' sono il primo e il secondo sport del profilo.
--    Il vecchio vincolo non ha un nome scelto a mano: lo si cerca e lo si sostituisce.
do $$
declare
  old_name text;
begin
  select conname into old_name
  from pg_constraint
  where conrelid = 'public.daily_targets'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%training_type%';
  if old_name is not null then
    execute format('alter table public.daily_targets drop constraint %I', old_name);
  end if;
end $$;

update public.daily_targets
set training_type = case training_type when 'gym' then 'sport_1' when 'football' then 'sport_2' else training_type end;

alter table public.daily_targets
  add constraint daily_targets_training_type_check
  check (training_type in ('rest', 'sport_1', 'sport_2', 'both'));
