# Modello dati

Postgres su Supabase. Una migrazione SQL numerata per volta in `supabase/migrations/`, mai modifiche a mano dal pannello senza salvarle come migrazione.

## Convenzioni
- Ogni tabella: `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` e RLS attiva.
- Giorni = colonna `date` (giorno locale Europe/Rome, calcolato dal client con `lib/dates.ts`). Mai `timestamptz` per un giorno: a mezzanotte UTC sbaglierebbe giorno.
- Valori nutrizionali dei cibi (`foods.*_100g`) in `numeric(8,2)`; snapshot delle voci pasto (`meal_entries.kcal` e macro) in `numeric(7,1)`; grammi/ml in `numeric(8,1)`. Calorie intere dove ha senso (`daily_targets`, `tdee_estimates`).
- Snapshot: una voce pasto copia nome, kcal e macro al momento dell'inserimento. Modificare o cancellare un cibo non cambia lo storico.
- Valori nutrizionali dei cibi per 100 g, o per 100 ml quando `unit = 'ml'`. Cibi "a porzione" salvano anche `serving_g` per proporre la quantità.
- `updated_at` si aggiorna da solo con il trigger `set_updated_at()` su `profiles`, `foods` e `daily_targets`.
- Le funzioni dei trigger hanno `set search_path = ''` e nessuno può chiamarle via API (`revoke execute … from public, anon, authenticated`).

## Tabelle

### profiles (una riga per utente)
| Colonna | Tipo | Note |
| --- | --- | --- |
| user_id | uuid PK | |
| sex | text not null | `male` / `female` (serve solo alla formula) |
| birth_date | date not null | inserita nell'app (mai nel repo); l'età si calcola, non si salva |
| height_cm | numeric(5,1) not null | `> 0` (i limiti 100-250 li controlla l'app, §10) |
| activity_factor | numeric(4,3) | default 1.600, `> 0`; la ricalibrazione lo aggiorna |
| surplus_pct | numeric(4,3) | default 0.100 (10%) |
| training_bonus_kcal | int | default 200 |
| goal_weight_kg | numeric(4,1) | nullable, impostato dall'utente nell'app |
| protein_g_per_kg | numeric(3,2) | default 2.00, `>= 0` |
| fat_g_per_kg | numeric(3,2) | default 1.00, `>= 0` |
| water_goal_ml | int | nullable, > 0; obiettivo acqua scelto dall'utente (migrazione 003, ADR-049) |
| created_at, updated_at | timestamptz | |

### foods
| Colonna | Tipo | Note |
| --- | --- | --- |
| id | uuid PK | |
| name | text not null | non vuoto (`length(trim(name)) > 0`) |
| brand | text | |
| barcode | text | unico per utente se presente |
| source | text | `manual` (default) / `open_food_facts` / `recipe` |
| unit | text | `g` (default) / `ml`: per `ml` i valori `_100g` sono per 100 ml (migrazione 003, ADR-048) |
| portions | jsonb | default `[]`, deve essere una lista; elementi `{name, amount}` con `amount` nell'unità del cibo (es. "1 uovo medio", 50), forma controllata dall'app (zod) |
| kcal_100g, protein_100g, carbs_100g, fat_100g | numeric(8,2) not null | non negativi |
| serving_g | numeric(8,1) | opzionale, `> 0` |
| cooked_weight_g | numeric(8,1) | `> 0`, solo `recipe`: peso totale cotto |
| is_favorite | bool | default false |
| last_used_at | timestamptz | per ordinare i "Recenti" |
| created_at, updated_at | timestamptz | |

Vincoli: `foods_nutrients_non_negative` (`kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g` ≥ 0); `foods_cooked_weight_only_recipe` (`cooked_weight_g is null or source = 'recipe'`); `unique (id, user_id)`, che serve alle chiavi esterne composte (ADR-022). Indici: unico parziale su `(user_id, barcode) where barcode is not null`; `(user_id, name)`; `(user_id, last_used_at desc)`.

Trigger `check_food_source_change` (solo quando cambia `source`): un cibo usato come ingrediente non può diventare ricetta, e una ricetta con ingredienti non può cambiare tipo.

### recipe_items
`id`, `recipe_food_id`, `ingredient_food_id`, `grams numeric(8,1) > 0`, `created_at`. Chiavi esterne composte (ADR-022): `(recipe_food_id, user_id)` → `foods (id, user_id)` ON DELETE CASCADE; `(ingredient_food_id, user_id)` → `foods (id, user_id)` ON DELETE RESTRICT. `check (recipe_food_id <> ingredient_food_id)`. Indici su `recipe_food_id` e su `ingredient_food_id`. In v1 un ingrediente non può essere a sua volta una ricetta e `recipe_food_id` deve essere una ricetta (verificato dall'app e dal trigger `check_recipe_item`). Valori della ricetta: somma degli ingredienti diviso `cooked_weight_g` × 100, ricalcolati e salvati su `foods` a ogni modifica.

### meal_entries
| Colonna | Tipo | Note |
| --- | --- | --- |
| id | uuid PK | |
| entry_date | date not null | giorno locale |
| meal_type | text not null | `breakfast` / `morning_snack` / `lunch` / `dinner` / `snack` (`morning_snack` dalla migrazione 004: "Snack"; `snack` nell'app è "Spuntino") |
| food_id | uuid null | `(food_id, user_id)` → `foods (id, user_id)` ON DELETE SET NULL (food_id): si azzera solo `food_id` (ADR-022) |
| food_name | text not null | snapshot |
| grams | numeric(8,1) > 0 | quantità nell'unità `unit` (il nome resta `grams` anche per i ml) |
| unit | text | `g` / `ml`, snapshot dell'unità del cibo (migrazione 003) |
| kcal | numeric(7,1) | snapshot calcolato, `>= 0` |
| protein_g, carbs_g, fat_g | numeric(7,1) | snapshot calcolato, `>= 0` |
| created_at | timestamptz | |

Indici su `(user_id, entry_date)` e su `food_id`.

### weight_logs
`id`, `log_date date not null`, `weight_kg numeric(4,1)` con `check (weight_kg between 30 and 250)`. Unico su `(user_id, log_date)`: una pesata al giorno, la seconda sostituisce la prima (upsert).

### daily_targets
| Colonna | Tipo | Note |
| --- | --- | --- |
| user_id, target_date | PK composta | |
| training_type | text | `rest` (default) / `gym` / `football` / `both` |
| target_kcal | int | già con bonus allenamento |
| protein_g, carbs_g, fat_g | int | |
| maintenance_kcal | int | mantenimento usato quel giorno |
| created_at, updated_at | timestamptz | |

Si crea alla prima apertura del giorno, copiando i parametri del profilo di quel momento. Cambiare il tipo di allenamento aggiorna solo quella riga. I giorni passati non si ricalcolano mai quando cambia il profilo.

### water_entries (migrazione 003)
`id`, `entry_date date not null` (giorno locale), `ml int` con `check (ml > 0 and ml <= 5000)`, `container text` (migrazione 004: `glass` / `small-bottle` / `bottle`, l'id di un contenitore personale, oppure null per una quantità libera; testo e non chiave esterna, così eliminare un contenitore non tocca le aggiunte), `created_at`. Indice su `(user_id, entry_date)`. Niente calorie: l'acqua non entra in `meal_entries`.

### drink_containers (migrazione 003)
`id`, `name text` non vuoto, `ml int` con `check (ml > 0 and ml <= 5000)`, `created_at`. Indice su `user_id`. Contenitori personali (es. borraccia); i tre rapidi (bicchiere, bottiglietta, bottiglia) sono costanti nell'app, non righe.

### tdee_estimates
`id`, `week_start date not null`, `window_days int` (`> 0`), `avg_intake_kcal int`, `trend_slope_kg_week numeric(5,3)`, `estimated_maintenance_kcal int`, `proposed_maintenance_kcal int` (null se nessuna proposta), `status text` (`pending` default / `accepted` / `rejected` / `none`), `created_at`. I valori calcolati possono essere null quando i dati non bastano (`none`). Indice su `(user_id, week_start)`, **non unico**: una riga per settimana la garantisce l'app (ADR-045). Accettare una proposta aggiorna `profiles.activity_factor` (= mantenimento proposto / BMR attuale), non esiste un campo di override (ADR-009).

## Funzioni
- `save_recipe(p_recipe_id, p_name, p_cooked_weight_g, p_kcal_100g, p_protein_100g, p_carbs_100g, p_fat_100g, p_items)` (migrazione 002, ADR-029): crea o aggiorna una ricetta e sostituisce i suoi `recipe_items` in una sola transazione; almeno un ingrediente. `security invoker` (vale la RLS), `set search_path = ''`, `revoke execute … from public, anon` e `grant execute … to authenticated`. I valori per 100 g li calcola l'app.
- Trigger: `set_updated_at`, `check_recipe_item`, `check_food_source_change` (vedi sopra).

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
revoke all on table public.foods from anon, authenticated;   -- prima si toglie tutto (ADR-021: niente TRUNCATE)
grant select, insert, update, delete on table public.foods to authenticated;
-- niente grant a anon; service_role non serve (non lo usiamo)
```
Il grant dice *chi può provare* a toccare la tabella; la RLS dice *quali righe*. Servono entrambi. Dopo ogni migrazione, verificare con due utenti di prova che l'utente A non veda mai le righe di B (test in SECURITY.md).

## Query frequenti (per gli indici)
- Pasti di un giorno: `entry_date = $1` ordinati per `created_at`.
- Recenti: calcolati nell'app dall'elenco completo dei propri cibi (`listFoods`), ordinati per `last_used_at` decrescente e tagliati a 20 (`lib/meals.ts`); nessun `limit` in SQL.
- Ricerca nei propri cibi: nell'app su tutti i propri cibi, senza accenti né maiuscole (`lib/search.ts`, ADR-032); nessun full-text in v1.
- Peso ultimi 28-90 giorni: `log_date >= $1` ordinato per data.
- Statistiche settimana/mese: somma di `meal_entries` per `entry_date` nel range, unita a `daily_targets`.
