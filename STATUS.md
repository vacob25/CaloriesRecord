# STATUS

Stato di lavoro per le funzioni che procedono "a blocchi". I documenti di riferimento restano in `docs/` (vedi `CLAUDE.md`).

## Stato dell'app (12/10/2026)
- PWA (React 19, Vite 8, TypeScript, Tailwind v4, vite-plugin-pwa), servita da Vercel come file statici; nessun backend proprio.
- Supabase: Auth con email e password (registrazione su invito), Postgres con RLS su ogni tabella, nessuna Edge Function, nessuna `service_role` (ADR-065).
- Utenti: il titolare più alcuni tester invitati (step 18), ognuno con i propri dati.
- Fuso: giorni locali Europe/Rome (`YYYY-MM-DD`), calcolati con `Intl` in `src/lib/dates.ts`.
- Step: 1-25 fatti; 4-10 e 13-23 ancora da provare sull'iPhone, l'11 in corso (stato per step in `docs/ROADMAP.md`). Ultima migrazione: 009.

## Piano HO (revisione, promemoria, allenamenti) — dal 19/10/2026
Ordine: Fase 0 revisione → correzioni scelte da Riccardo (PR piccole) → Fase 1 prova push su iPhone → Fase 2 promemoria → Fasi 3-8 allenamenti. Una fase alla volta, STOP a fine fase. Da ora ogni fase passa da una PR (niente più pubblicazione diretta su `main`).

### Fase 0 · Revisione dell'app — FATTA (PR #2)
- Report: `docs/REVIEW_2026-10-19.md` (55 problemi: 2 alti, 25 medi, 28 bassi) con le obiezioni ai file HO. Nessuna modifica al codice.
- Piano HO nel repo: `docs/ho/` (copie dei tre file con le correzioni del 19/10).

**Decisioni di Riccardo (19/10/2026)**
1. Correzioni in 7 PR. Priorità: a) #18 urgente (sport dei tester azzerati e scelti alla prossima apertura, mai indovinati); b) test end-to-end nel repo + CI (`@playwright/test` e `axe-core` solo di sviluppo, versioni bloccate, Supabase simulato, nessun segreto né accesso al progetto reale); c) salvataggi senza rete con id generato dal client e inserimento idempotente, progettato una volta e riusato per le sessioni di allenamento, con messaggio di attesa; d) #10 pulsanti "Sposta su/giù"; e) il resto nell'ordine del report. **Dopo a) e b) STOP in attesa dell'ok.**
2. Bonus: resta lo step 22 (calorie per sport sommate). Fase 8 riscritta: la sessione di palestra segna lo sport "palestra" del giorno (con annulla), il calcio resta manuale; nessuna stima di calorie per singola sessione.
3. Fonti: servono solo prima delle Fasi 6-7; Riccardo aggiunge i domini alla rete dell'ambiente.
4. Push di prova (Fase 1): dalla Edge Function già in Fase 1, con ADR che modifica ADR-065; verifica il JWT, legge con la RLS solo la subscription di chi chiama, nessuna `service_role` (si valuta in Fase 2 per il cron). Chiavi VAPID generate da Riccardo, privata solo nei segreti di Supabase.
5. Promemoria "non registrati": solo una proposta dopo 5 giorni consecutivi (contatore sugli invii accettati dal push service, azzerato quando si registra il pasto). Nessuna sospensione automatica.
6. Esercizi: controllo incrociato con `wger` (dati da GitHub) solo per verificare, niente copiato; terza fonte nei casi in disaccordo; niente scraping di ExRx.
7. Notifiche: `importScripts` nel service worker attuale invece di `injectManifest`; al logout si cancella solo la subscription del dispositivo, con l'eliminazione dell'account tutte.

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
