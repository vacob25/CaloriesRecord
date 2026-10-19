-- Supabase simulato per i test end-to-end (solo locale e CI, mai il progetto reale).
-- Contiene solo ciò che le migrazioni e l'app usano: i ruoli di Supabase, lo schema auth con auth.users e auth.uid().
-- Nessun dato reale: gli utenti di prova li crea tests/e2e/support/harness.ts.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
  -- PostgREST si collega come authenticator e passa ad anon o authenticated secondo il JWT (come su Supabase).
  -- Password solo per il database usa e getta dei test: non protegge nulla.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator-e2e-locale';
  end if;
end $$;

grant anon, authenticated to authenticator;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique,
  aud text,
  role text,
  is_sso_user boolean not null default false,
  created_at timestamptz default now()
);

-- Come su Supabase: l'utente della richiesta viene dal JWT che PostgREST mette nelle impostazioni della sessione.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Caso peggiore voluto: i vecchi progetti Supabase davano tutto ad anon e authenticated sulle tabelle nuove.
-- Le migrazioni devono toglierlo da sole (revoke all), e i test lo verificano.
alter default privileges in schema public grant all on tables to anon, authenticated;
