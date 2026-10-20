-- Migrazione 010 (correzione #28 della revisione del 19/10/2026).
-- La funzione del trigger della 007 (seed_meal_slots) non aveva il `revoke execute` che hanno le funzioni dei
-- trigger della 001: nessun rischio reale (una funzione che restituisce `trigger` non si può chiamare via API), ma
-- la regola scritta in DATA_MODEL dice che nessuno le chiama. Qui la si rende coerente.
-- Il trigger continua a funzionare: il permesso di esecuzione di una funzione trigger non si controlla quando scatta.
-- Da eseguire dopo la 009, nel SQL Editor di Supabase.

begin;

revoke execute on function public.seed_meal_slots() from public, anon, authenticated;

commit;
