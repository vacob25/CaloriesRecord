# Modello dati

Postgres su Supabase. Una migrazione SQL numerata per volta in `supabase/migrations/`, mai modifiche a mano dal pannello senza salvarle come migrazione.

## Convenzioni
- Ogni tabella: `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` e RLS attiva.
- Giorni = colonna `date` (giorno locale Europe/Rome, calcolato dal client con `lib/dates.ts`). Mai `timestamptz` per un giorno: a mezzanotte UTC sbaglierebbe giorno.
- Quantità nutrizionali in `numeric(8,2)`, grammi in `numeric(8,1)`. Calorie intere dove ha senso.
- Snapshot: una voce pasto copia nome, kcal e macro al momento dell'inserimento. Modificare o cancellare un cibo non cambia lo storico.
- Valori nutrizionali dei cibi sempre per 100 g. Cibi "a porzione" salvano anche `serving_g` per proporre i grammi.

## Tabelle

### profiles (una riga per utente)
| Colonna | Tipo | Note |
| --- | --- | --- |
| user_id | uuid PK | |
| sex | text | `male` / `female` (serve solo alla formula) |
| birth_date | date | inserita nell'app (mai nel repo); l'età si calcola, non si salva |
| height_cm | numeric(5,1) | |
| activity_factor | numeric(4,3) | default 1.600; la ricalibrazione lo aggiorna |
| surplus_pct | numeric(4,3) | default 0.100 (10%) |
| training_bonus_kcal | int | default 200 |
| goal_weight_kg | numeric(4,1) | nullable, impostato dall'utente nell'app |
| protein_g_per_kg | numeric(3,2) | default 2.00 |
| fat_g_per_kg | numeric(3,2) | default 1.00 |
| created_at, updated_at | timestamptz | |

### foods
| Colonna | Tipo | Note |
| --- | --- | --- |
| id | uuid PK | |
| name | text not null | |
| brand | text | |
| barcode | text | unico per utente se presente |
| source | text | `manual` / `open_food_facts` / `recipe` |
| kcal_100g, protein_100g, carbs_100g, fat_100g | numeric | non negativi |
| serving_g | numeric(8,1) | opzionale |
| cooked_weight_g | numeric(8,1) | solo `recipe`: peso totale cotto |
| is_favorite | bool | default false |
| last_used_at | timestamptz | per ordinare i "Recenti" |
| created_at, updated_at | timestamptz | |

Vincoli: `check (kcal_100g >= 0 and protein_100g >= 0 and carbs_100g >= 0 and fat_100g >= 0)`; indice unico parziale su `(user_id, barcode) where barcode is not null`; indice su `(user_id, name)`.

### recipe_items
`id`, `recipe_food_id` → foods (ON DELETE CASCADE), `ingredient_food_id` → foods (ON DELETE RESTRICT), `grams numeric(8,1) > 0`. In v1 un ingrediente non può essere a sua volta una ricetta (verificato dall'app e da trigger). Valori della ricetta: somma degli ingredienti diviso `cooked_weight_g` × 100, ricalcolati e salvati su `foods` a ogni modifica.

### meal_entries
| Colonna | Tipo | Note |
| --- | --- | --- |
| id | uuid PK | |
| entry_date | date not null | giorno locale |
| meal_type | text | `breakfast` / `lunch` / `dinner` / `snack` |
| food_id | uuid null | FK foods, ON DELETE SET NULL |
| food_name | text not null | snapshot |
| grams | numeric(8,1) > 0 | |
| kcal | numeric(7,1) | snapshot calcolato |
| protein_g, carbs_g, fat_g | numeric(7,1) | snapshot calcolato |
| created_at | timestamptz | |

Indice su `(user_id, entry_date)`.

### weight_logs
`id`, `log_date date not null`, `weight_kg numeric(4,1)` con `check (weight_kg between 30 and 250)`. Unico su `(user_id, log_date)`: una pesata al giorno, la seconda sostituisce la prima (upsert).

### daily_targets
| Colonna | Tipo | Note |
| --- | --- | --- |
| user_id, target_date | PK composta | |
| training_type | text | `rest` / `gym` / `football` / `both` |
| target_kcal | int | già con bonus allenamento |
| protein_g, carbs_g, fat_g | int | |
| maintenance_kcal | int | mantenimento usato quel giorno |
| created_at, updated_at | timestamptz | |

Si crea alla prima apertura del giorno, copiando i parametri del profilo di quel momento. Cambiare il tipo di allenamento aggiorna solo quella riga. I giorni passati non si ricalcolano mai quando cambia il profilo.

### tdee_estimates
`id`, `week_start date`, `window_days int`, `avg_intake_kcal int`, `trend_slope_kg_week numeric(5,3)`, `estimated_maintenance_kcal int`, `proposed_maintenance_kcal int` (null se nessuna proposta), `status text` (`pending` / `accepted` / `rejected` / `none`), `created_at`. Accettare una proposta aggiorna `profiles.activity_factor` (= mantenimento proposto / BMR attuale), non esiste un campo di override (ADR-009).

## Row Level Security (modello da applicare a TUTTE le tabelle)
```sql
alter table public.foods enable row level security;

create policy "foods_select_own" on public.foods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "foods_insert_own" on public.foods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "foods_update_own" on public.foods
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "foods_delete_own" on public.foods
  for delete to authenticated using (user_id = (select auth.uid()));
```
Nessuna policy e **nessun grant** per `anon`: senza login non si legge né scrive niente.

### Grant espliciti (obbligatori)
Dal 2026 le tabelle create nello schema `public` non sono più esposte automaticamente alla Data API: senza `grant` l'app riceve l'errore `42501 permission denied for table …` (progetti nuovi dal 30 maggio 2026, tutti i progetti dal 30 ottobre 2026). Ogni tabella della migrazione deve avere, subito dopo `create table`:
```sql
grant select, insert, update, delete on public.foods to authenticated;
-- niente grant a anon; service_role non serve (non lo usiamo)
```
Il grant dice *chi può provare* a toccare la tabella; la RLS dice *quali righe*. Servono entrambi. Dopo ogni migrazione, verificare con due utenti di prova che l'utente A non veda mai le righe di B (test in SECURITY.md).

## Query frequenti (per gli indici)
- Pasti di un giorno: `entry_date = $1` ordinati per `created_at`.
- Recenti: cibi ordinati per `last_used_at desc limit 20`.
- Ricerca nei propri cibi: `name ilike '%…%'` (ok per poche centinaia di righe; nessun full-text in v1).
- Peso ultimi 28-90 giorni: `log_date >= $1` ordinato per data.
- Statistiche settimana/mese: somma di `meal_entries` per `entry_date` nel range, unita a `daily_targets`.
