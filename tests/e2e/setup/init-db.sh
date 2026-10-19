#!/usr/bin/env bash
# Crea da zero il database "e2e": Supabase simulato + tutte le migrazioni di supabase/migrations, in ordine.
# Usa le variabili standard di psql (PGHOST, PGPORT, PGUSER, PGPASSWORD). Va lanciato prima di avviare PostgREST.
set -euo pipefail
cd "$(dirname "$0")/../../.."
DB="${E2E_DATABASE:-e2e}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/e2e/setup/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  echo "migrazione $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null
done
echo "database $DB pronto"
