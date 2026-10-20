-- Scheduler dei promemoria (Fase 2, ADR-087). NON è una migrazione: dipende dal progetto (indirizzo, segreto) e usa
-- estensioni che esistono solo su Supabase. Si esegue una volta nel SQL Editor DOPO la migrazione 012 e dopo aver
-- pubblicato la funzione `send-reminders`.
--
-- Sostituisci <PROJECT_URL> con l'indirizzo del progetto (https://<progetto>.supabase.co, senza / finale).
-- Il segreto condiviso lo genera il database e non lo vede nessuno: la funzione lo confronta con verify_cron_secret().

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Segreti in Vault (se esistono già non si toccano: per cambiarli, vault.update_secret).
select vault.create_secret('<PROJECT_URL>', 'project_url')
where not exists (select 1 from vault.secrets where name = 'project_url');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret')
where not exists (select 1 from vault.secrets where name = 'cron_secret');

-- Ogni 5 minuti: chiama la funzione SOLO se c'è almeno un promemoria da mandare (così quasi sempre non parte niente).
select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from public.due_reminders());
  $$
);
