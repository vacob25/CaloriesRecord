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

Dalla migrazione 005 lo script controlla anche: email non invitata rifiutata e invitata accettata dalla hook (senza distinguere maiuscole), elenco invisibile all'app e ad anon, `delete_my_account` di A che cancella tutto di A e niente di B, anon che non può chiamarla. Alla fine mostra l'elenco delle tabelle con RLS. Provato in locale anche "rompendo" apposta grant, hook e funzione: ogni volta si ferma con FALLITO.

**Senza sessione, dall'esterno:** `SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=sb_publishable_… bash supabase/checks/no_session.sh` (valori solo nel terminale): ogni tabella e funzione deve rispondere senza dati.

Lo script ora controlla anche che `authenticated` non abbia permessi in più oltre a select/insert/update/delete (niente TRUNCATE, REFERENCES, TRIGGER, ADR-021) e controlla anche le tabelle della migrazione 003 (`water_entries`, `drink_containers`) e `save_recipe` (002), se presenti. **Da rieseguire** sul progetto reale dopo le migrazioni 002 e 003; esito da annotare qui dall'utente: _(da fare)_.

Cosa controlla (a mano sarebbe così):
1. Crea due utenti di prova (A e B) con email diverse.
2. Come A inserisci una riga in ogni tabella.
3. Come B: `select` su ogni tabella → 0 righe; `update` e `delete` su una riga di A → 0 righe toccate; `insert` con `user_id` di A → errore.
4. Senza login (solo chiave publishable): `select` su ogni tabella → 0 righe, `insert` → errore.
5. Segna l'esito nel messaggio di commit. Se uno qualunque fallisce, lo step non è finito.

## Login
- **Email e password** (ADR-028, ADR-064): `signInWithPassword` e, per i tester invitati, `signUp`. Mai link magico, mai OTP.
- Password: lunga e unica (meglio una frase di 4-5 parole, o generata dal Portachiavi iCloud), mai riusata altrove. Il repo è pubblico e l'URL dell'app è trovabile: la password è l'unica cosa che protegge l'accesso. In Supabase (Authentication → Sign In / Providers → Email) lunghezza minima della password 8, la stessa dell'app (scelta dell'utente, ADR-064).
- Password dimenticata: Authentication → Users → utente → reimpostala dal pannello. Non c'è recupero via email in app.
- Tentativi di accesso: Supabase limita i login ripetuti (Authentication → Rate Limits); non alzare quei limiti.
- In Supabase: `Site URL` = URL di produzione su Vercel; `Redirect URLs` solo gli URL che servono (produzione e `http://localhost:5173`). Mai `*`. Con il login attuale (utente creato a mano, nessuna email dall'app) contano poco, ma vanno tenuti giusti: diventano essenziali con lo step 12.
- **Solo per lo step 12 (OTP via email):** il servizio email predefinito di Supabase invia solo agli indirizzi dei membri del progetto e ha un limite molto basso (non è pensato per la produzione): per un'app personale con te come proprietario basta; se arrivano errori "email not authorized" o limiti di invio, configurare un SMTP personalizzato (es. Resend).
- **Registrazione su invito (step 18, ADR-064)**, in quest'ordine:
  1. eseguire la migrazione 005;
  2. Authentication → Hooks → "Before User Created" → tipo Postgres → `public.hook_before_user_created` → attivare;
  3. Authentication → Sign In / Providers → Email: "Confirm email" OFF, poi "Allow new users to sign up" ON (mai prima della hook: senza, chiunque troverebbe l'URL potrebbe registrarsi);
  4. invitare: `insert into public.allowed_emails (email) values ('nome@dominio');` dal SQL Editor (minuscolo). Per togliere un invito non usato: `delete from public.allowed_emails where email = '…';`.
- Rischio dichiarato: senza conferma via email, chi conosce l'email di un invitato potrebbe registrarsi prima di lui. Invitare solo quando la persona è pronta; se succede, eliminare l'utente da Authentication → Users.
- Eliminazione dell'account: funzione `delete_my_account()` (migrazione 005), solo per l'utente della sessione. Nessuna service_role, nessuna Edge Function.
- Sessione: gestita da `supabase-js` (storage del browser). All'uscita: `signOut({ scope: 'local' })`, `queryClient.clear()` e rimozione da localStorage/sessionStorage delle chiavi `sb-…`, `off.…`, `caloriesrecord.…` (`clearUserStorage`, testato).

## Input e rete
- Validare ogni input con zod prima di scrivere sul database e ogni risposta di Open Food Facts prima di usarla.
- Non usare `dangerouslySetInnerHTML`. Il nome di un cibo preso da Open Food Facts è testo non fidato: React lo escapa, non aggirarlo.
- Open Food Facts: chiamate in sola lettura, senza inviare dati personali (solo codice a barre o testo cercato) e senza credenziali (ADR-041). Il conteggio delle richieste sta in `sessionStorage` (solo orari, nessun dato personale).
- Dipendenze: `npm audit` a ogni step e prima di un deploy. Nessun pacchetto sconosciuto o con pochi download senza averlo detto all'utente.
- Intestazioni di sicurezza in `vercel.json` per tutte le risposte: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()` (fotocamera solo per l'app stessa, per lo scanner).
- Vercel: variabili d'ambiente solo dalle impostazioni del progetto; le anteprime (preview) non devono usare credenziali di produzione se in futuro si aggiungono segreti.

## Privacy
Peso, altezza, data di nascita e abitudini alimentari sono dati personali e, peso e alimentazione, **dati sulla salute** (art. 9 GDPR): servono consenso esplicito (casella alla registrazione, ADR-065) e un'informativa (`/privacy`, testo di base da far rivedere). Database nella regione di Francoforte. Ognuno vede solo i propri dati (RLS); l'amministratore tecnico può accedere al database dal pannello. Consenso salvato nei metadati dell'utente (`privacy_version`, `privacy_accepted_at`, `health_data_consent`): soluzione base, senza storico delle versioni. Nessuna analytics di terze parti, nessun tracker, nessuna chiamata a servizi IA con dati reali finché non è una scelta esplicita dell'utente (v2).

## Backup, pausa e limiti del piano gratuito (verificati il 9/10/2026)
- Backup: il piano gratuito **non** ha backup automatici (i backup giornalieri sono del piano Pro, [pricing](https://supabase.com/pricing)). Backup semplice: ogni utente può fare "Esporta i miei dati"; per tutto il database, dal computer, `supabase db dump` (CLI di Supabase, con la password del database solo nel terminale, mai nel repo) una volta a settimana.
- Pausa: un progetto gratuito senza attività per circa una settimana viene messo in pausa; Supabase manda un'email al proprietario prima. Con 5 tester che usano l'app ogni giorno non succede; se succede l'app mostra "Il server … non risponde" e si riattiva dal pannello.
- Limiti: database 500 MB e 50.000 utenti attivi al mese: lontanissimi per questo uso.
- Email: con "Confirm email" spento l'app non ne invia. L'email integrata di Supabase invia solo ai membri del progetto; Resend senza dominio verificato solo al proprietario dell'account.
