-- Migrazione 012 (Fase 2 delle notifiche, ADR-087): promemoria dei pasti. Da eseguire dopo la 011, nel SQL Editor di Supabase.
-- Tre tabelle personali + due funzioni che usa solo la Edge Function `send-reminders` (chiave di servizio, mai l'app).
-- Lo scheduler (pg_cron) non sta qui: dipende dal progetto, vedi supabase/setup/reminders_cron.sql.
--
-- reminder_settings: per ogni pasto (slot `meal:<slot_key>`; in Fase 8 anche `workout`) se è attivo e a che ora.
--   Gli orari sono ora locale + fuso Europe/Rome: l'istante lo calcola Postgres con AT TIME ZONE (ora legale compresa).
-- reminder_status: "fatto" per pasto e giorno locale; lo scrive un trigger quando si registra o si sposta una voce in quel pasto.
-- reminder_log: promemoria già partiti (uno per pasto e giorno) e quanti dispositivi li hanno accettati; lo scrive solo la funzione.

begin;

create table public.reminder_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot text not null check (slot ~ '^(meal:[a-z0-9_]{1,40}|workout)$'),
  enabled boolean not null default false,
  time_weekday time not null default '12:30',
  -- Orario diverso nel fine settimana; null = lo stesso dei giorni feriali.
  time_weekend time,
  timezone text not null default 'Europe/Rome' check (timezone = 'Europe/Rome'),
  -- Giorno in cui l'utente ha scelto "Continua" davanti alla proposta di sospendere: da lì si riconta.
  proposal_dismissed_day date,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  -- Lo scheduler gira ogni 5 minuti: orari a passi di 5 minuti, senza secondi.
  constraint reminder_settings_weekday_step check (extract(minute from time_weekday)::int % 5 = 0 and extract(second from time_weekday) = 0),
  constraint reminder_settings_weekend_step check (time_weekend is null or (extract(minute from time_weekend)::int % 5 = 0 and extract(second from time_weekend) = 0))
);

create table public.reminder_status (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot text not null check (slot ~ '^(meal:[a-z0-9_]{1,40}|workout)$'),
  day date not null,
  done_at timestamptz not null default now(),
  primary key (user_id, slot, day)
);

create table public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot ~ '^(meal:[a-z0-9_]{1,40}|workout)$'),
  day date not null,
  sent_at timestamptz not null default now(),
  -- Dispositivi per cui il servizio push ha risposto 2xx (ADR-086: conta solo questo, non "arrivato sul telefono").
  accepted int not null default 0 check (accepted >= 0),
  primary key (user_id, slot, day)
);

alter table public.reminder_settings enable row level security;
alter table public.reminder_status enable row level security;
alter table public.reminder_log enable row level security;
revoke all on table public.reminder_settings, public.reminder_status, public.reminder_log from anon, authenticated;
grant select, insert, update, delete on table public.reminder_settings to authenticated;
grant select, insert, update, delete on table public.reminder_status to authenticated;
-- Il registro lo scrive solo la funzione con la chiave di servizio: l'utente lo può solo leggere (serve alla proposta).
grant select on table public.reminder_log to authenticated;

create policy "reminder_settings_select_own" on public.reminder_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reminder_settings_insert_own" on public.reminder_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "reminder_settings_update_own" on public.reminder_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reminder_settings_delete_own" on public.reminder_settings
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "reminder_status_select_own" on public.reminder_status
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reminder_status_insert_own" on public.reminder_status
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "reminder_status_update_own" on public.reminder_status
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reminder_status_delete_own" on public.reminder_status
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "reminder_log_select_own" on public.reminder_log
  for select to authenticated using (user_id = (select auth.uid()));

-- "Pasto registrato": lo segna il database, non l'app. Così vale per ogni strada (aggiunta, spostamento, salvataggio
-- ripetuto dopo un'interruzione di rete) e l'app non fa richieste in più. Gira con i permessi di chi scrive la voce:
-- la riga è sua, quindi la RLS la lascia passare. Un giorno già segnato non cambia.
create function public.mark_meal_reminder_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.reminder_status (user_id, slot, day)
  values (new.user_id, 'meal:' || new.meal_type, new.entry_date)
  on conflict do nothing;
  return new;
exception when others then
  -- Un problema dei promemoria non deve mai impedire di salvare un pasto.
  return new;
end;
$$;

create trigger meal_entries_mark_reminder_done
  after insert or update of meal_type, entry_date on public.meal_entries
  for each row execute function public.mark_meal_reminder_done();
-- Funzione solo da trigger: nessuno la chiama dall'esterno (come nella 010).
revoke execute on function public.mark_meal_reminder_done() from public, anon, authenticated;

-- Promemoria da mandare adesso. Uno è "da mandare" se: attivo; l'orario di oggi (locale) è passato da meno di un'ora
-- (se lo scheduler era fermo non si manda un promemoria del pranzo alle 18); il pasto esiste ancora; l'utente ha almeno
-- un dispositivo; non è già partito oggi; il pasto non è già stato registrato oggi.
-- Ha un parametro `p_now` solo per poterla provare con date a scelta (ora legale).
create function public.due_reminders(p_now timestamptz default now())
returns table (reminder_user uuid, reminder_slot text, reminder_day date, slot_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.slot, d.local_day, m.name
  from public.reminder_settings s
  cross join lateral (select (p_now at time zone s.timezone)::date as local_day) d
  cross join lateral (
    select ((d.local_day
      + case when extract(isodow from d.local_day) in (6, 7) then coalesce(s.time_weekend, s.time_weekday) else s.time_weekday end)
      at time zone s.timezone) as scheduled_at
  ) t
  join public.meal_slots m on m.user_id = s.user_id and 'meal:' || m.slot_key = s.slot
  where s.enabled
    and t.scheduled_at <= p_now
    and p_now < t.scheduled_at + interval '60 minutes'
    and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
    and not exists (select 1 from public.reminder_log l where l.user_id = s.user_id and l.slot = s.slot and l.day = d.local_day)
    and not exists (select 1 from public.reminder_status r where r.user_id = s.user_id and r.slot = s.slot and r.day = d.local_day);
$$;

-- La funzione Edge si presenta con un segreto condiviso con il cron (messo in Vault da supabase/setup/reminders_cron.sql):
-- questa funzione lo confronta. plpgsql perché `vault` esiste solo su Supabase (non nel database di prova dei test).
create function public.verify_cron_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'cron_secret';
  return expected is not null and p_secret is not null and p_secret <> '' and expected = p_secret;
end;
$$;

-- Le due funzioni le chiama solo la Edge Function con la chiave di servizio (e il cron, come postgres).
-- Supabase dà `execute` ad anon e authenticated di default: va tolto (come nella 010).
revoke execute on function public.due_reminders(timestamptz) from public, anon, authenticated;
revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;
grant execute on function public.verify_cron_secret(text) to service_role;

commit;
