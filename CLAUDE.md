# CaloriesRecord

PWA personale (un solo utente) per registrare calorie e macro da iPhone. Obiettivo: aumento di massa magra, ritmo +0,2-0,35 kg/settimana. Peso, altezza, data di nascita e peso obiettivo sono dati personali: si inseriscono nell'app (database), mai nel repo.

## Come lavorare
- Un passo alla volta, seguendo `docs/ROADMAP.md`. Finito lo step, fermati: l'utente prova sull'iPhone e conferma.
- L'utente sta imparando: spiega in breve ogni scelta tecnica importante (perché, non solo cosa).
- Se un'idea è sbagliata o rischiosa, dillo chiaramente e proponi un'alternativa. Non dire sempre di sì.
- Prima di aggiungere una libreria non prevista in `docs/ARCHITECTURE.md` (sezione Dipendenze), dillo e motivala.
- Se una regola in questi file è ambigua o manca, chiedi. Non inventare numeri di dominio.

## Mappa dei documenti (leggi solo quello che serve allo step)
| File | Ruolo | Leggilo quando |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | Struttura cartelle, livelli, flusso dati, dipendenze, PWA/iOS | Crei file, componenti, hook, routing |
| `docs/DATA_MODEL.md` | Schema Postgres, SQL, RLS, convenzioni su date e snapshot | Tocchi database o tipi |
| `docs/DOMAIN_RULES.md` | Formule: BMR, target, macro, media mobile, ricalibrazione | Scrivi qualunque calcolo |
| `docs/TESTING.md` | Strategia di test e casi con valori attesi | Scrivi o cambi funzioni in `src/lib/` |
| `docs/DESIGN.md` | Token, componenti, schermate, accessibilità | Scrivi UI |
| `docs/SECURITY.md` | Repo pubblico, segreti, RLS, dati personali | Mai da saltare prima di ogni commit e step 3 |
| `docs/ROADMAP.md` | Step 1-16 con criteri di accettazione | Inizio e fine di ogni step |
| `docs/DECISIONS.md` | Registro decisioni (ADR) e punti aperti | Prima di cambiare una scelta già presa |

## Regole non negoziabili
1. Il repo è PUBBLICO: mai committare `.env`, chiavi, token, dati personali (peso, pasti).
2. Nel frontend solo la chiave publishable di Supabase (`sb_publishable_…`). Mai la secret key (`sb_secret_…`) né la `service_role`.
3. Ogni tabella ha `user_id` e Row Level Security attiva.
4. I calcoli stanno in funzioni pure in `src/lib/`, con test Vitest. Mai formule dentro i componenti.
5. Nessun recupero delle calorie non assunte: l'obiettivo è solo giornaliero.
6. Le date sono giorni locali Europe/Rome (stringa `YYYY-MM-DD`), mai timestamp UTC per i giorni.
7. Lingua dell'interfaccia: italiano. Unità: kg, cm, kcal, g.
8. Login con email e password (ADR-028), mai con link magico. Il codice OTP via email (ADR-014) è rinviato allo step 12 di `docs/ROADMAP.md`.
9. Nessun dato personale reale nel repo, nemmeno in test o esempi: si usa il profilo fittizio di `docs/DOMAIN_RULES.md`.

## Comandi
- `npm install` — installa le dipendenze
- `npm run dev` — server di sviluppo (http://localhost:5173)
- `npm run build` — typecheck + build di produzione in `dist/` (con service worker)
- `npm run preview` — serve `dist/` in locale per provare la PWA
- `npm run test` — Vitest una volta (`npm run test:watch` per la modalità watch)
- `npm run lint` — oxlint, gli avvisi fanno fallire il comando
- `npm run typecheck` — TypeScript strict, senza generare file
- Prima di dichiarare uno step finito: `typecheck`, `lint`, `test` e `build` devono passare.
