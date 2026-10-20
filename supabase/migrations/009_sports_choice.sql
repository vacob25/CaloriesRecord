-- Migrazione 009 (correzione #18 della revisione del 19/10/2026, ADR-077).
-- La 006 aveva impostato "Palestra + Calcio" a TUTTI i profili esistenti, tester compresi, invece che al solo
-- titolare. Qui quegli sport si azzerano e l'app chiede a ognuno di sceglierli alla prossima apertura.
-- Non si indovina niente: chi ha ancora esattamente ["Palestra", "Calcio"] (il valore messo dalla 006) viene
-- azzerato, anche il titolare, che li riseleziona con un tocco. Chi li ha già cambiati non viene toccato.
-- Da eseguire dopo la 008, nel SQL Editor di Supabase, PRIMA di pubblicare la versione dell'app che la usa.

begin;

-- 1. true = gli sport vanno scelti (solo i profili azzerati qui). I profili nuovi li scelgono nel Benvenuto.
alter table public.profiles
  add column sports_choice_pending boolean not null default false;

-- 2. Azzeramento degli sport messi dalla 006 e dei target di oggi (e di eventuali giorni futuri) di quei profili:
--    l'app li ricrea come giorni di riposo. I giorni passati non si toccano (ADR-039): restano come sono stati.
with reset as (
  update public.profiles
  set sports = '[]'::jsonb, sports_choice_pending = true
  where sports = '["Palestra", "Calcio"]'::jsonb
  returning user_id
)
delete from public.daily_targets as t
using reset as r
where t.user_id = r.user_id
  and t.target_date >= (now() at time zone 'Europe/Rome')::date;

commit;

-- Controllo (facoltativo): quanti profili devono scegliere gli sport.
-- select count(*) from public.profiles where sports_choice_pending;
