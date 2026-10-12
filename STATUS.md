# STATUS

Stato di lavoro per le funzioni che procedono "a blocchi". I documenti di riferimento restano in `docs/` (vedi `CLAUDE.md`).

## Stato dell'app (12/10/2026)
- PWA (React 19, Vite 8, TypeScript, Tailwind v4, vite-plugin-pwa), servita da Vercel come file statici; nessun backend proprio.
- Supabase: Auth con email e password (registrazione su invito), Postgres con RLS su ogni tabella, nessuna Edge Function, nessuna `service_role` (ADR-065).
- Utenti: il titolare più alcuni tester invitati (step 18), ognuno con i propri dati.
- Fuso: giorni locali Europe/Rome (`YYYY-MM-DD`), calcolati con `Intl` in `src/lib/dates.ts`.
- Step completati: 1-23 (vedi `docs/ROADMAP.md`). Ultima migrazione: 008.

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
