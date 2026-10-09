-- Migrazione 005 (step 18): registrazione su invito per i tester ed eliminazione del proprio account.
-- Da eseguire dopo la 004, nel SQL Editor di Supabase. Poi, in Authentication:
--   1. Hooks → "Before User Created" → Postgres → public.hook_before_user_created
--   2. Sign In / Providers → Email: "Allow new users to sign up" ON, "Confirm email" OFF (ADR-064)
-- Nessuna service_role: tutto passa da RLS, grant e funzioni con permessi minimi.

-- ─── allowed_emails: chi può registrarsi (le aggiungi tu dal SQL Editor) ───
-- Esempio: insert into public.allowed_emails (email) values ('nome.cognome@example.com');

create table public.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email like '_%@_%.__%'),
  note text,
  created_at timestamptz not null default now()
);

-- RLS attiva e nessun permesso dall'app: anon e authenticated non vedono né toccano l'elenco.
alter table public.allowed_emails enable row level security;
revoke all on table public.allowed_emails from anon, authenticated, public;

-- Solo il ruolo di Supabase Auth può leggerlo (serve alla hook qui sotto).
grant select on table public.allowed_emails to supabase_auth_admin;
create policy "allowed_emails_read_by_auth" on public.allowed_emails
  for select to supabase_auth_admin using (true);

-- ─── Hook "Before User Created": rifiuta le email non invitate ─────────────
-- La chiama Supabase Auth prima di creare un utente, con il ruolo supabase_auth_admin.
-- {} = crea l'utente; {"error": {...}} = rifiuta e il messaggio arriva all'app.
-- Non è security definer: gira con i permessi minimi di supabase_auth_admin (lettura dell'elenco).

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  user_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if user_email <> '' and exists (select 1 from public.allowed_emails where email = user_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Registrazione solo su invito: questa email non è nell''elenco dei tester.'
    )
  );
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ─── delete_my_account: ognuno può cancellare solo sé stesso ───────────────
-- security definer perché authenticated non ha permessi su auth.users; search_path vuoto e
-- nomi completi contro le funzioni "dirottate". Cancella SOLO l'utente della sessione:
-- le tabelle con user_id si svuotano a cascata (on delete cascade).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Serve una sessione per eliminare l''account' using errcode = '42501';
  end if;
  -- Prima le righe delle ricette (la chiave verso l'ingrediente è ON DELETE RESTRICT, ADR-022).
  -- In prova la cascata funziona anche senza questa riga: resta come sicurezza, non cambia il risultato.
  delete from public.recipe_items where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─── Indice su user_id che mancava (le policy RLS filtrano per user_id) ────
-- Le altre tabelle hanno già un indice o una chiave che comincia con user_id.
create index recipe_items_user_idx on public.recipe_items (user_id);
