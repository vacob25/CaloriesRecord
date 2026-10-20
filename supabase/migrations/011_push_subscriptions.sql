-- Migrazione 011 (Fase 1 delle notifiche push, ADR-086): un indirizzo tecnico per ogni dispositivo che ha attivato
-- le notifiche. Da eseguire dopo la 010, nel SQL Editor di Supabase.
--
-- La "subscription" è ciò che il browser dà all'app quando si attivano le notifiche: l'indirizzo del servizio push di
-- Apple o Google (`endpoint`) e due chiavi per cifrare il messaggio (`p256dh_key`, `auth_secret`). Non contiene dati
-- sulla salute. Da sola non basta per mandare notifiche: serve anche la chiave VAPID privata, che sta solo nei segreti
-- di Supabase. Un utente ne può avere una per dispositivo; le vede e le cancella solo lui (RLS).

begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) between 20 and 2048),
  p256dh_key text not null check (char_length(p256dh_key) between 20 and 200),
  auth_secret text not null check (char_length(auth_secret) between 8 and 100),
  created_at timestamptz not null default now(),
  -- Lo stesso dispositivo che si riattiva aggiorna la sua riga invece di crearne un'altra.
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

commit;

-- Controllo (facoltativo): la tabella c'è e la RLS è attiva.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'push_subscriptions';
