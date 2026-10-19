# Test end-to-end

L'app vera (build di produzione) contro un **Supabase simulato**: Postgres con tutte le migrazioni di `supabase/migrations`, PostgREST e un'autenticazione finta scritta in `support/harness.ts`. Nessun segreto e nessun accesso al progetto Supabase reale; i dati sono fittizi (profilo di esempio di `docs/DOMAIN_RULES.md`). Open Food Facts è simulato dove serve.

La CI (`.github/workflows/ci.yml`) li esegue su ogni PR. In locale servono Linux, macOS o WSL, Docker e Node 22.

## Da zero

```bash
# 1. Postgres usa e getta (porta 54329 per non disturbare altri database)
docker run -d --name cr-e2e-db -e POSTGRES_PASSWORD=postgres-e2e-locale -p 54329:5432 postgres:16
export PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres-e2e-locale

# 2. Database dei test: Supabase simulato + migrazioni (da rifare dopo ogni migrazione nuova)
bash tests/e2e/setup/init-db.sh

# 3. PostgREST (stessa versione della CI). Su macOS al posto di --network host:
#    -p 3001:3001 e nell'URI host.docker.internal:54329
docker run -d --name cr-e2e-postgrest --network host \
  -e PGRST_DB_URI=postgres://authenticator:authenticator-e2e-locale@localhost:54329/e2e \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=segreto-solo-per-i-test-locali-0123456789 -e PGRST_SERVER_PORT=3001 \
  postgrest/postgrest:v12.2.3

# 4. Browser, build con l'URL finto e test
npx playwright install chromium
npm run build:e2e
npm run test:e2e
```

Un solo test: `npm run test:e2e -- step20`. Rifare `init-db.sh` richiede di fermare prima PostgREST (`docker stop cr-e2e-postgrest`), perché il database viene cancellato e ricreato.

## Come sono fatti

- Ogni file `*.e2e.ts` è uno step della roadmap (o una correzione) e parte da un database pulito (`resetDatabase()`): i test girano uno alla volta e non dipendono dall'ordine.
- `check(condizione, 'etichetta')` è un controllo "morbido": il test continua e alla fine fallisce elencando tutte le etichette sbagliate.
- `sql()` prepara e controlla i dati con `psql` (variabili `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`).
- Lo scanner usa la fotocamera finta di Chromium con un video del codice a barre generato durante il test (`support/barcodeVideo.ts`).
- `accessibilita.e2e.ts` passa axe-core (WCAG 2.1 A/AA) e il controllo delle aree toccabili (≥ 44 px) su tutte le schermate.
- I segreti che si vedono qui (password del database, chiave JWT di PostgREST) valgono solo per questi database usa e getta: non sono quelli del progetto reale e non proteggono niente.
- Il typecheck (`npm run typecheck`) non copre questa cartella; il lint sì.
