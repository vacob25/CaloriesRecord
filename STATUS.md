# STATUS

Stato di lavoro per le funzioni che procedono "a blocchi". I documenti di riferimento restano in `docs/` (vedi `CLAUDE.md`).

## Stato dell'app (12/10/2026)
- PWA (React 19, Vite 8, TypeScript, Tailwind v4, vite-plugin-pwa), servita da Vercel come file statici; nessun backend proprio.
- Supabase: Auth con email e password (registrazione su invito), Postgres con RLS su ogni tabella, nessuna Edge Function, nessuna `service_role` (ADR-065).
- Utenti: il titolare più alcuni tester invitati (step 18), ognuno con i propri dati.
- Fuso: giorni locali Europe/Rome (`YYYY-MM-DD`), calcolati con `Intl` in `src/lib/dates.ts`.
- Step completati: 1-23 (vedi `docs/ROADMAP.md`). Ultima migrazione: 008.

## Piano HO (revisione, promemoria, allenamenti) — dal 19/10/2026
Ordine: Fase 0 revisione → correzioni scelte da Riccardo (PR piccole) → Fase 1 prova push su iPhone → Fase 2 promemoria → Fasi 3-8 allenamenti. Una fase alla volta, STOP a fine fase. Da ora ogni fase passa da una PR (niente più pubblicazione diretta su `main`).

### Fase 0 · Revisione dell'app — FATTA, IN ATTESA DELLA SCELTA DELLE CORREZIONI
- Report: `docs/REVIEW_2026-10-19.md` (55 problemi: 2 alti, 25 medi, 28 bassi) con le obiezioni ai file HO. Nessuna modifica al codice.
- Decisioni che servono prima di andare avanti: quali correzioni fare e in che ordine; bonus allenamento (tenere lo step 22 o tornare al bonus unico); rete dell'ambiente per aprire le fonti (PubMed/PMC, Supabase docs) o PDF caricati; da dove parte il push di prova della Fase 1; sospensione automatica dopo 5 "non registrati"; seconda fonte per gli esercizi; ok a `@playwright/test` e `axe-core` per i test end-to-end nel repo.

## Funzione: promemoria intelligenti (peso, pranzo, cena)

### Blocco 1 · Diagnosi dello stack e proposta di consegna — FATTO, IN ATTESA DELL'OK
- Diagnosi e tre modalità di consegna (con costi, manutenzione e rischi) consegnate a Riccardo in chat il 12/10/2026.
- Nessun codice scritto. Nessuna scelta fatta: tocca stack, costi e trattamento dati.
- Decisioni che servono (elenco completo in chat): modalità di consegna; se si accettano una Edge Function + una chiave server + la chiave VAPID privata (finora esclusi da ADR-065); come si definisce "promemoria ignorato"; Pranzo e Cena = i pasti con chiave `lunch` e `dinner` (rinominabili dall'utente).

### Blocchi successivi (non iniziati)
2. Modello dati delle impostazioni + logica "invia solo se non registrato" con test (ora legale 2026-10-25 e 2027-03-28)
3. Consegna delle notifiche sul metodo approvato
4. Impostazioni, richiesta del permesso, apertura diretta dello slot
5. Verifica su Android e su iPhone reali
