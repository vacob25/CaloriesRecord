#!/usr/bin/env bash
# Verifica dall'esterno: l'API REST senza sessione (solo la chiave publishable) non restituisce dati.
# Uso (nessun segreto nel repo, i valori stanno solo nel tuo terminale):
#   SUPABASE_URL=https://<progetto>.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_... bash supabase/checks/no_session.sh
# Esito: "OK" per ogni tabella e funzione, poi "Nessun dato senza sessione". Esce con errore al primo problema.
set -u
: "${SUPABASE_URL:?imposta SUPABASE_URL (URL base, senza /rest/v1)}"
: "${SUPABASE_PUBLISHABLE_KEY:?imposta SUPABASE_PUBLISHABLE_KEY (sb_publishable_...)}"
case "$SUPABASE_PUBLISHABLE_KEY" in sb_secret_*) echo "Usa la chiave publishable, mai la secret." >&2; exit 2 ;; esac

REST="${SUPABASE_URL%/}/rest/v1"
TABLES="profiles foods recipe_items meal_entries weight_logs daily_targets tdee_estimates water_entries drink_containers allowed_emails"
failed=0

for t in $TABLES; do
  body=$(curl -sS -w '\n%{http_code}' "$REST/$t?select=*&limit=1" -H "apikey: $SUPABASE_PUBLISHABLE_KEY")
  code=${body##*$'\n'}; data=${body%$'\n'*}
  # Atteso: 401/403 (nessun permesso) oppure 200 con elenco vuoto. Mai righe.
  if [ "$code" = "200" ] && [ "$data" != "[]" ]; then echo "FALLITO: $t restituisce dati senza sessione: $data"; failed=1
  elif [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "403" ]; then echo "OK   $t ($code)"
  else echo "FALLITO: $t risposta inattesa $code: $data"; failed=1; fi
done

for fn in delete_my_account save_recipe hook_before_user_created; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$REST/rpc/$fn" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{}')
  # Atteso: 401/403 (permesso negato) o 404 (funzione non esposta). Mai 200/204.
  case "$code" in 401|403|404) echo "OK   rpc/$fn ($code)" ;; *) echo "FALLITO: rpc/$fn senza sessione risponde $code"; failed=1 ;; esac
done

[ "$failed" = 0 ] && echo "Nessun dato senza sessione" || exit 1
