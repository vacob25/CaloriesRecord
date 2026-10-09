# Piano di sviluppo

Regola: uno step alla volta. Alla fine di ogni step Claude Code si ferma, elenca cosa è stato fatto, cosa va provato sull'iPhone e cosa non è stato fatto. Si passa al successivo solo dopo conferma dell'utente. Ogni step è un branch o almeno uno o più commit con messaggio chiaro.

**Criteri validi per tutti gli step:** `typecheck`, `lint`, `test`, `build` passano; nessun segreto in git (`docs/SECURITY.md`); l'app si apre dall'icona sulla schermata Home dell'iPhone.

| # | Step | Stato |
| --- | --- | --- |
| 1 | Design | fatto |
| 2 | Setup, PWA, deploy | fatto |
| 3 | Database e login | fatto (8/10/2026: login con password nella PWA installata, Esci e rientro, riapertura; da annotare: sessione dopo 1 giorno e 1 settimana) |
| 4 | Cibi e ricette | in prova (fatto e provato contro Postgres + PostgREST locali; manca: migrazione 002 su Supabase e prova sull'iPhone) |
| 5 | Registro pasti | in prova (fatto e provato contro Postgres + PostgREST locali; manca: prova sull'iPhone) |
| 6 | Target e macro | in prova (fatto e provato contro Postgres + PostgREST locali; manca: prova sull'iPhone) |
| 7 | Peso | in prova (fatto e provato contro Postgres + PostgREST locali; manca: prova sull'iPhone) |
| 8 | Open Food Facts e barcode | in prova (fatto; provato con OFF simulato e fotocamera finta con un vero EAN-13; manca: 5 prodotti reali con l'iPhone, anche con poca luce) |
| 9 | Statistiche | in prova (fatto e provato contro Postgres + PostgREST locali con una settimana calcolata a mano; manca: prova sull'iPhone) |
| 10 | Ricalibrazione | in prova (fatto e provato contro Postgres + PostgREST locali; manca: conferma di ADR-044 e uso reale di qualche settimana) |
| 11 | Rifinitura e uso reale | in corso (parte tecnica fatta: accessibilità 0 violazioni, aree ≥ 44 px, banner offline, npm audit pulito; mancano: icona e avvio definitivi, 2 settimane di uso reale) |
| 12 | Login con codice OTP | superato da ADR-064 (password definitiva; codici via email solo se un giorno si compra un dominio) |
| 13 | Peso più visibile e promemoria | in prova (fatto e provato contro Postgres + PostgREST locali; manca: prova sull'iPhone) |
| 14 | Porzioni casalinghe e liquidi in ml | in prova (fatto e provato contro Postgres + PostgREST locali; manca: migrazione 003 su Supabase e prova sull'iPhone) |
| 15 | Acqua | in prova (fatto e provato contro Postgres + PostgREST locali; manca: migrazione 003 su Supabase e prova sull'iPhone) |
| 16 | Catalogo di ingredienti mediterranei | in prova (195 voci CREA importate e validate; manca: prova sull'iPhone e le voci non trovate: uva, vitello, zucchero, tè, più quelle assenti dal CREA come bulgur, edamame, semi, patata dolce) |
| 17 | Snack, acqua a contatori, peso giornaliero, Cibi con preferiti | in prova (fatto e provato contro Postgres + PostgREST locali; manca: migrazione 004 su Supabase e prova sull'iPhone) |
| 18 | Tester invitati: registrazione, privacy, esporta, elimina account | in prova (fatto e provato contro Postgres + PostgREST locali con la hook vera; manca: migrazione 005 e impostazioni in Supabase, prova sull'iPhone) |

Gli step 1-7 portano a un primo uso reale quotidiano. Gli step 8-10 e 13-16 sono fatti e in prova, l'11 è in corso (vedi tabella); lo step 12 (OTP) resta da fare e si può anticipare in qualunque momento.

---

## Step 2 · Setup, PWA, deploy
Fare: progetto Vite + React + TypeScript nella radice; Tailwind con i token di `DESIGN.md`; Vitest; vite-plugin-pwa (manifest in italiano, icone 192/512/maskable, apple-touch-icon 180, `display: standalone`, `registerType: 'prompt'`); struttura cartelle di `ARCHITECTURE.md`; layout con barra di navigazione e schermate segnaposto; `.gitignore` e `.env.example`; deploy Vercel da GitHub.
Accettazione:
- Da iPhone: "Aggiungi alla schermata Home" crea l'icona, l'app si apre a schermo intero senza barra di Safari.
- La barra in basso rispetta la safe area e non copre contenuti.
- Manifest valido e service worker registrato (Chrome DevTools → Application, sul computer).
Non fare: nessuna logica, nessun database.

## Step 3 · Database e login
Fare: progetto Supabase; migrazione 001 con tutte le tabelle di `DATA_MODEL.md`, `grant` espliciti a `authenticated` (e nessuno ad `anon`), RLS e indici; login con **email e password** (ADR-028; l'OTP di ADR-014 è rinviato allo step 12); guardia di route (senza sessione → login); client in `data/supabase.ts`. La schermata dati personali è spostata allo step 6 (ADR-027).
Accettazione:
- Verifica RLS con due utenti completata (`SECURITY.md`) e annotata.
- Registrazioni aperte disattivate dopo la creazione dell'utente.
- Login con email e password funzionante **dentro la PWA installata** (non solo in Safari), con la password proposta dal Portachiavi iCloud; si resta collegati.
- Sessione: chiudere e riaprire l'app dopo qualche minuto, dopo un giorno e dopo una settimana; se chiede di nuovo il login, annotarlo in `DECISIONS.md`.
- Utente creato dal pannello con password lunga e "Auto Confirm User"; lunghezza minima della password alzata in Supabase.
- Nessuna chiave diversa dalla publishable nel repo.

## Step 4 · Cibi e ricette
Fare: elenco e ricerca dei propri cibi, creazione/modifica/eliminazione, preferiti; ricette con ingredienti, peso cotto e calcolo per 100 g (`lib/nutrition.ts` con test).
Accettazione:
- "Pasta al ragù" creata come ricetta da 3 ingredienti: i valori per 100 g tornano con il calcolo a mano.
- Validazione di `DOMAIN_RULES.md` §9 attiva (macro > 100 g rifiutati).
- Eliminare un ingrediente usato in una ricetta è bloccato con messaggio chiaro.

## Step 5 · Registro pasti
Fare: schermata Oggi con card pasto; aggiunta rapida (recenti, preferiti, ricerca, grammi con − / +); modifica ed eliminazione voce; totali del giorno; aggiornamento di `last_used_at`; snapshot di nome, kcal e macro.
Accettazione:
- Registrare un pasto richiede al massimo 3 tocchi per un cibo recente.
- Modificare i valori di un cibo NON cambia le voci già registrate.
- Cancellare un cibo lascia le voci con il loro nome.

## Step 6 · Target e macro
Fare: **schermata dati personali alla prima apertura** (sesso, data di nascita, altezza, peso obiettivo; crea la riga di `profiles`, senza profilo l'app porta lì; ADR-027); profilo con parametri; `lib/nutrition.ts` (BMR, mantenimento, target, macro) con tutti i test di `TESTING.md`; creazione di `daily_targets` alla prima apertura del giorno; anello e barre macro; selettore tipo di giorno.
Accettazione:
- Prima apertura senza profilo → schermata dati personali; dopo il salvataggio non ricompare.
- Limiti di validazione dei dati personali decisi con l'utente e scritti in `DOMAIN_RULES.md` prima di scrivere il codice.
- Con il profilo di esempio fittizio di `DOMAIN_RULES.md` il target è 3130 (riposo) e 3330 (calcio), macro 150/75/464 e 150/75/514.
- Cambiare un parametro nel profilo non modifica i giorni passati.
- Oltre il target l'anello mostra "oltre di N kcal".

## Step 7 · Peso
Fare: inserimento del peso mattutino (upsert per giorno), media mobile 7 giorni con minimo 4 pesate, grafico con punti e linea, distanza dal traguardo, pendenza.
Accettazione:
- Test di `weight.ts` passati.
- Una seconda pesata nello stesso giorno sostituisce la prima.
- Con meno di 4 pesate non appare la media, solo i punti.
- Il BMR usa la media mobile quando disponibile, altrimenti l'ultima pesata.

## Step 8 · Open Food Facts e barcode
Fare: ricerca testuale e per barcode via Open Food Facts; conversione e validazione della risposta in un tipo interno; salvataggio nei propri cibi alla prima scelta; scanner con `@zxing/browser`.
Prima di scrivere: leggere la documentazione attuale di Open Food Facts per endpoint, parametri, limiti di richieste e requisiti (ad esempio l'identificazione dell'app). Non assumere URL o campi a memoria.
Accettazione:
- Scansione di 5 prodotti reali diversi su iPhone, nella PWA installata, anche con poca luce (o con la torcia).
- Prodotto senza dati nutrizionali o con campi mancanti → proposta di creazione manuale, mai valori a zero silenziosi.
- Permesso fotocamera negato gestito.
- Un fixture di risposta (con dati inventati o pubblici del prodotto) testa la conversione.

## Step 9 · Statistiche
Fare: `lib/stats.ts` con test; schermata con selettore settimana/mese, numeri chiave, grafico calorie/target, peso, distribuzione pasti, cibi frequenti.
Accettazione:
- I giorni non registrati sono esclusi da medie e conteggi.
- Un periodo vuoto mostra lo stato vuoto.
- I numeri tornano con un calcolo a mano su una settimana di prova.

## Step 10 · Ricalibrazione
Fare: `lib/recalibration.ts` con tutti i test di `TESTING.md`; esecuzione settimanale lazy (alla prima apertura dopo la scadenza); scheda in Profilo con proposta, numeri e pulsanti accetta/rifiuta; scrittura su `tdee_estimates`.
Accettazione:
- Con meno di 21 giorni, 80% di registrazione o 10 pesate: messaggio "servono più dati", nessuna proposta.
- Pendenza tra +0,20 e +0,40 kg/sett.: nessuna proposta.
- Accettare aggiorna `activity_factor` e vale dal giorno dopo; rifiutare non cambia nulla.

## Step 11 · Rifinitura e uso reale
Fare: icona e schermata di avvio definitive, prestazioni, stati vuoti/errore/offline ovunque, accessibilità (contrasto, aree toccabili, label), 2 settimane di uso reale con elenco dei problemi.
Accettazione: lista di problemi incontrati dall'utente corretta o classificata come v2; `npm audit` senza vulnerabilità alte.

## Step 12 · Login con codice OTP (rinviato dallo step 3)
Si può anticipare in qualunque momento dopo lo step 3: non dipende dagli altri step.
Prima di scrivere: decidere con l'utente se l'OTP **sostituisce** la password o si **aggiunge** (es. "Accedi con un codice" come alternativa). Riprendere il codice dalla storia di git (commit `3a69c12`: schermata a due passaggi, timer di reinvio, login in attesa salvato, errori) invece di riscriverlo.
Fare: invio email funzionante (Resend con API key dello stesso account del destinatario e mittente `onboarding@resend.dev`, oppure dominio verificato su Resend); template "Magic Link" di Supabase con `{{ .Token }}` e senza link; schermata codice con `inputmode="numeric"` e `autocomplete="one-time-code"`; "Invia un nuovo codice" dopo 60 s.
Accettazione:
- La mail con il codice arriva in Posta in arrivo (non solo in Spam) in meno di un minuto.
- Login con codice funzionante **dentro la PWA installata**: si chiede il codice, lo si inserisce nell'app, si resta collegati.
- `signInWithOtp` con `shouldCreateUser: false`; `verifyOtp` con `type: 'email'`; un'email non registrata non viene rivelata.
- Codice sbagliato/scaduto, troppi tentativi e rete assente hanno messaggi chiari; la sessione resiste come allo step 3.

## Step 13 · Peso più visibile e promemoria (richiesta dell'utente, 8/10/2026)
Le regole di calcolo del peso (§4) NON cambiano: pesarsi spesso resta il modo per avere media, pendenza e ricalibrazione.
Fare: voce "Peso" raggiungibile anche da Statistiche; promemoria in Oggi se non ti pesi da 5 giorni o più (o non c'è nessuna pesata); in Peso un riepilogo "ultimi 5 giorni" (pesate, media, variazione rispetto ai 5 giorni prima).
Accettazione:
- Con l'ultima pesata di 6 giorni fa compare il promemoria; dopo aver registrato il peso sparisce.
- Il riepilogo degli ultimi 5 giorni torna con un calcolo a mano.

## Step 14 · Porzioni casalinghe e liquidi in ml
Fare: ogni cibo ha un'unità (g o ml: per i liquidi i valori sono per 100 ml, come nelle etichette) e una lista di porzioni con nome e quantità ("1 uovo medio = 50 g", "1 cucchiaio = 10 g", "1 bicchiere = 200 ml"); nel pannello si sceglie la porzione e quante (es. 2 uova) e la quantità si calcola da sola, restando modificabile; snapshot della voce con l'unità; migrazione 003.
Accettazione:
- "2 uova medie" registra 100 g con i valori giusti.
- Un latte in ml registra 200 ml con i valori per 100 ml dell'etichetta.
- Le voci già registrate non cambiano se cambi le porzioni del cibo.

## Step 15 · Acqua
Fare: card Acqua in Oggi con un tocco per bicchiere (200 ml), bottiglietta (500 ml), bottiglia (1,5 L) e per i propri contenitori salvati (es. borraccia), più una quantità libera; obiettivo giornaliero impostato dall'utente nel Profilo (nessun valore predefinito); annulla l'ultima aggiunta; l'acqua non ha calorie e non entra nel diario dei pasti. Migrazione 003.
Accettazione:
- Tre tocchi diversi sommano correttamente nel giorno (giorno locale Europe/Rome).
- Un contenitore personalizzato resta salvato e compare tra i tasti rapidi.
- Senza obiettivo si vede solo il totale; con obiettivo "bevuti / obiettivo".

## Step 16 · Catalogo di ingredienti mediterranei
Fare: catalogo di alimenti semplici (niente piatti composti) con kcal e macro per 100 g e porzioni casalinghe, prodotto in un'altra chat con il testo di `docs/prompts/catalogo-ingredienti.md` e fonte per ogni voce (CREA come fonte principale); file JSON nel repo (dati pubblici, nessun dato personale), validato con zod e regole §9 da un test; scheda "Catalogo" in Aggiungi pasto; alla prima scelta la voce si salva tra i propri cibi.
Accettazione:
- Il test di validazione del catalogo passa su tutte le voci (nessuna con macro > 100 g o kcal incoerenti senza nota).
- Ogni voce ha la fonte.
- Scegliere una voce del catalogo la salva tra i propri cibi una sola volta.

## Step 17 · Richieste dell'utente dell'8/10/2026
Fare: promemoria del peso ogni giorno in cima a Oggi (pulsante a destra) finché non ti pesi; nuovo pasto "Snack" tra colazione e pranzo e il vecchio "Snack" rinominato "Spuntino" (migrazione 004); acqua con "− N +" per ogni contenitore e per le quantità libere; salvare un contenitore non aggiunge acqua; Cibi con "Preferiti" (stella, matita per modificare) e "Alimenti recenti" (al massimo 8), pulsanti Nuovo cibo / Nuova ricetta in alto, elenco completo con "Tutti i tuoi cibi"; catalogo a riquadri con icona per categoria e stella su ogni voce, i preferiti in cima alla categoria.
Accettazione:
- Senza pesata di oggi il promemoria è il primo elemento sotto l'intestazione; dopo la pesata sparisce.
- Una voce registrata nello Snack resta in "Snack"; le voci "snack" già registrate compaiono in "Spuntino".
- Due bicchieri → contatore 2; "−" ne toglie uno; 200 ml scritti a mano non contano come bicchiere.
- Salvare la borraccia lascia invariato il totale del giorno; il suo "+" aggiunge 750 ml.
- Stella su una voce del catalogo → in cima alla categoria e in "Preferiti" di Cibi.
- "Alimenti recenti" mostra al massimo 8 cibi, dal più recente.

---


## Step 18 · Tester invitati (richiesta dell'utente del 9/10/2026)
Fare: migrazione 005 (`allowed_emails`, hook "Before User Created", `delete_my_account`, indice mancante); schermata Registrati con consenso esplicito (dati sulla salute) salvato nei metadati; link "Registrati", "Password dimenticata?" e "Privacy" su Accedi; pagina pubblica `/privacy`; nel Profilo "Esporta i miei dati" ed "Elimina account" (scrivere ELIMINA); all'uscita pulizia di cache, localStorage e sessionStorage. Script RLS esteso e script curl senza sessione. Nessuna nuova funzione dell'app.
Accettazione:
- Email non invitata: rifiutata con "Registrazione solo su invito…"; email invitata (maiuscole diverse comprese): account creato e si arriva al Benvenuto.
- Senza consenso o con password sotto 8 caratteri non parte nessuna richiesta.
- Il nuovo utente non vede nessun dato degli altri; l'esportazione contiene solo i suoi dati, da tutte le tabelle.
- Dopo "Esci" nel browser non resta nessuna chiave con dati dell'utente.
- "Elimina account" cancella l'utente e tutte le sue righe e niente degli altri.
- `rls_two_users.sql` e `no_session.sh` passano sul progetto reale.
## Step 19 · Obiettivo, sport e tutorial (richiesta dell'utente del 9/10/2026)
Fare: migrazione 006 (`profiles.goal`, `cut_rate_pct`, `sports`, `tutorial_done_at`; tipi di giorno `rest`/`sport_1`/`sport_2`/`both`); obiettivo Mettere massa / Mantenere / Definizione (cut) con ritmo in % del peso a settimana (ADR-066); sport liberi (max 2) con "Palestra" consigliato, da cui nascono i tipi di giorno ("Palestra + calcio"); Benvenuto in 3 passi (Dati, Obiettivo, Allenamento con livello di attività); nel Profilo "Obiettivo e sport"; ricalibrazione con bande per obiettivo; tutorial a popup "1/8" sulle funzioni principali, riapribile da "Rivedi il tutorial".
Accettazione:
- Cut: target di riposo = mantenimento − (peso · ritmo% · 7700 / 7), arrotondato a 10 (75 kg, 0,5%: 2848 → 2440); senza un peso obiettivo sotto il peso attuale non si salva.
- Con Palestra e Calcio i tipi di giorno sono Riposo, Palestra, Calcio, Palestra + calcio; togliendo uno sport un giorno che lo usava torna a Riposo.
- Il profilo del titolare (migrato) resta identico: stessi target di prima.
- Il tutorial parte da solo al primo accesso, va da 1/8 a 8/8 cambiando schermata, "Salta"/"Fine" lo segnano come visto, "Rivedi il tutorial" lo riapre.
- Typecheck, lint, test, build e tutti gli e2e passano; axe senza violazioni.

## Fuori scope in v1 (v2+)
Foto del piatto con stima IA, stima IA per piatti composti, notifiche (promemoria peso), esportazione CSV e backup, target per giorno della settimana, misure corporee e foto progresso, modalità offline vera.
