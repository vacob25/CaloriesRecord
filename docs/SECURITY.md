# Sicurezza

Il repo è **pubblico**. Chiunque può leggere ogni file e ogni commit, anche quelli vecchi. Quello che finisce in git va considerato pubblico per sempre.

## Cosa non finisce mai in git
- File `.env`, `.env.local`, chiavi API, token, password, URL con credenziali.
- La chiave `service_role` di Supabase (aggira la RLS: chi la ha legge e scrive tutto).
- Dati personali: pesi, pasti, esportazioni CSV, screenshot dell'app con dati reali, fixture di test con dati veri (usare dati inventati).
- Backup del database.

`.gitignore` deve contenere almeno: `.env`, `.env.*` (con eccezione `!.env.example`), `node_modules`, `dist`, `.vercel`, `*.log`, `.DS_Store`.

## Cosa può stare nel frontend
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (chiave publishable, `sb_publishable_…`). Sono pensate per essere esposte nel browser: la protezione dei dati sta nella RLS, non nel nascondere la chiave. Qualunque variabile `VITE_*` finisce nel bundle pubblico: mai metterci segreti.

## Controllo prima di ogni commit
1. `git status` e `git diff --staged`: nessun file `.env*` (tranne `.env.example`), nessun dato personale.
2. Cercare segreti: `git diff --staged | grep -iE "service_role|secret|password|apikey|api_key|eyJ"`. Una stringa che inizia con `eyJ` è probabilmente un JWT: controllare che sia la chiave publishable e non una secret key o `service_role`.
3. Se un segreto è finito in un commit (anche non pushato): ruotare la chiave dal pannello Supabase prima di tutto. Riscrivere la storia di git NON basta se è già stato pushato.

## Database: RLS
- RLS attiva su **ogni** tabella, subito alla creazione (nella stessa migrazione).
- Nessuna policy e nessun `grant` per il ruolo `anon`: da non loggati non si legge né scrive niente. Per `authenticated` servono sia i `grant` espliciti (vedi `DATA_MODEL.md`) sia le policy.
- Policy per `authenticated` limitate a `user_id = (select auth.uid())` per select, insert, update, delete (modello in `docs/DATA_MODEL.md`). In insert, `user_id` ha default `auth.uid()` e un `with check` che impedisce di scrivere per altri.
- Le viste devono rispettare la RLS (`security_invoker = true`); in v1 meglio non usare viste.
- Nessuna funzione `security definer` senza una ragione scritta in `DECISIONS.md`.
- Funzioni chiamate dall'app (es. `save_recipe`, ADR-029): `security invoker`, `set search_path = ''`, `revoke execute … from public, anon` e `grant execute … to authenticated`. Lo script RLS verifica anche loro.

### Verifica RLS con due utenti (da fare allo step 3 e a ogni nuova tabella)
**Script pronto:** `supabase/checks/rls_two_users.sql`. Supabase → SQL Editor → New query → incolla tutto il file → Run. Esito atteso nell'ultima riga: `RLS verificata: tutti i controlli superati`. Se un controllo fallisce compare un errore che inizia con `FALLITO:` e non resta niente nel database. Lo script crea due utenti finti (`@example.invalid`), "diventa" ciascuno di loro come farebbe l'app dopo il login (ruolo `authenticated` + `auth.uid()`), fa i controlli qui sotto e poi li cancella; non usa dati reali e si può rieseguire. Quando aggiungi una tabella, aggiungila anche allo script.

**Esiti:** 8/10/2026, dopo la migrazione 001 sul progetto Supabase reale → `RLS verificata: tutti i controlli superati`.

Cosa controlla (a mano sarebbe così):
1. Crea due utenti di prova (A e B) con email diverse.
2. Come A inserisci una riga in ogni tabella.
3. Come B: `select` su ogni tabella → 0 righe; `update` e `delete` su una riga di A → 0 righe toccate; `insert` con `user_id` di A → errore.
4. Senza login (solo chiave publishable): `select` su ogni tabella → 0 righe, `insert` → errore.
5. Segna l'esito nel messaggio di commit. Se uno qualunque fallisce, lo step non è finito.

## Login
- **Email e password** (ADR-028): l'app chiama `signInWithPassword({ email, password })`. Mai link magico. Il codice OTP via email (ADR-014) è rinviato allo step 12.
- Password: lunga e unica (meglio una frase di 4-5 parole, o generata dal Portachiavi iCloud), mai riusata altrove. Il repo è pubblico e l'URL dell'app è trovabile: la password è l'unica cosa che protegge l'accesso. In Supabase (Authentication → Sign In / Providers → Email) alzare la lunghezza minima della password ad almeno 12.
- Password dimenticata: Authentication → Users → utente → reimpostala dal pannello. Non c'è recupero via email in app.
- Tentativi di accesso: Supabase limita i login ripetuti (Authentication → Rate Limits); non alzare quei limiti.
- In Supabase: `Site URL` = URL di produzione su Vercel; `Redirect URLs` solo gli URL che servono (produzione e `http://localhost:5173`). Mai `*`.
- Il servizio email predefinito di Supabase invia solo agli indirizzi dei membri del progetto e ha un limite molto basso (non è pensato per la produzione): per un'app personale con te come proprietario basta; se arrivano errori "email not authorized" o limiti di invio, configurare un SMTP personalizzato (es. Resend).
- Creare il proprio utente da Authentication → Users → Add user → Create new user, con email, password e "Auto Confirm User"; poi disattivare le registrazioni aperte (Authentication → Providers → Email → "Allow new users to sign up"). Così, anche se qualcuno trova l'URL, non può creare un account.
- Sessione: gestita da `supabase-js` (storage del browser). Il logout deve cancellare la sessione locale.

## Input e rete
- Validare ogni input con zod prima di scrivere sul database e ogni risposta di Open Food Facts prima di usarla.
- Non usare `dangerouslySetInnerHTML`. Il nome di un cibo preso da Open Food Facts è testo non fidato: React lo escapa, non aggirarlo.
- Open Food Facts: chiamate in sola lettura, senza inviare dati personali (solo codice a barre o testo cercato) e senza credenziali (ADR-041). Il conteggio delle richieste sta in `sessionStorage` (solo orari, nessun dato personale).
- Dipendenze: `npm audit` a ogni step e prima di un deploy. Nessun pacchetto sconosciuto o con pochi download senza averlo detto all'utente.
- Vercel: variabili d'ambiente solo dalle impostazioni del progetto; le anteprime (preview) non devono usare credenziali di produzione se in futuro si aggiungono segreti.

## Privacy
Peso, altezza, data di nascita e abitudini alimentari sono dati personali. Restano nel database Supabase dell'utente, accessibili solo con il suo login. Nessuna analytics di terze parti, nessun tracker, nessuna chiamata a servizi IA con dati reali finché non è una scelta esplicita dell'utente (v2).

## Backup
Il piano gratuito di Supabase in genere non include backup automatici (da verificare nelle condizioni attuali): prevedere l'esportazione CSV (v2) e farla periodicamente. I progetti gratuiti inattivi per un po' (circa una settimana) vengono messi in pausa: usare l'app ogni giorno basta.
