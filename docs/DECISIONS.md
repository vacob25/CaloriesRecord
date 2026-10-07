# Registro delle decisioni (ADR)

Formato: decisione, motivo, alternative scartate, quando rivederla. Prima di cambiare una scelta già presa, leggi qui e dillo all'utente. Aggiungi una voce ogni volta che prendi una decisione tecnica non banale.

## Decise

**ADR-001 · PWA invece di app nativa**
Costo 0 € contro 99 €/anno per l'Apple Developer Program (TestFlight). Uso personale su iPhone. Limiti accettati: niente notifiche affidabili e fotocamera meno fluida. Da rivedere se servono widget o notifiche.

**ADR-002 · Dati online su Supabase, non solo locali**
iOS può cancellare i dati locali dei siti poco usati. Il database online dà backup, accesso da più dispositivi e RLS. Scartato: solo localStorage/IndexedDB.

**ADR-003 · Un solo target giornaliero, nessun recupero**
Scelta dell'utente, coerente con l'obiettivo di massa: recuperare calorie saltate in blocco porta a mangiate forzate. Le statistiche settimanali sono descrittive. Variante: bonus fisso nei giorni di allenamento (gym/calcio/entrambi, un solo bonus).

**ADR-004 · Mifflin-St Jeor come partenza, poi ricalibrazione adattiva**
Mifflin è l'equazione più precisa tra le comuni, ma sbaglia anche di centinaia di kcal sul singolo. Per questo la stima iniziale si corregge con peso e calorie reali, come proposta da confermare. Scartato: formula fissa per sempre; aggiustamento automatico senza conferma.

**ADR-005 · Calcoli in `lib/` con test**
Un errore in una formula sposta il target di giorni di dieta senza che nessuno se ne accorga. Funzioni pure testate con casi calcolati a mano (`TESTING.md`).

**ADR-009 · Accettare la ricalibrazione aggiorna `activity_factor`**
Mantenere un solo parametro (nessun override in kcal) fa sì che il BMR continui a salire col peso. Scartato: campo `maintenance_override_kcal` (resterebbe fermo mentre il peso cresce).

**ADR-010 · Giorni come stringa locale `YYYY-MM-DD`**
Evita errori di giorno a mezzanotte UTC e con l'ora legale. Il fuso è Europe/Rome.

**ADR-011 · Snapshot nelle voci pasto**
Il diario deve restare invariato se un cibo viene corretto o cancellato.

**ADR-012 · Ricette solo con ingredienti semplici in v1**
Una ricetta non può contenere un'altra ricetta (niente cicli, calcolo più semplice).

**ADR-014 · Login con codice OTP via email invece del link magico**
Su iOS la PWA installata ha storage separato da Safari (problema noto di WebKit): il link nella mail si apre in Safari e accede lì, non nell'app. Con il codice numerico lo si inserisce direttamente nella PWA. Resta passwordless, quindi rispetta la richiesta dell'utente. Costo: un passaggio in più (copiare il codice). Alternativa se dà problemi: email + password con sessione lunga. Da verificare allo step 3 sull'iPhone vero.

**ADR-015 · Nessun dato personale reale nel repo**
Il repo è pubblico: peso, altezza, data di nascita e obiettivo stanno solo nel database (tabella `profiles`). Test ed esempi usano un profilo fittizio (uomo, 75 kg, 180 cm, 20 anni).

**ADR-013 · Registrazioni disattivate dopo la creazione dell'utente**
App a utente singolo con repo pubblico: nessuno deve poter creare un account.

## Decise il 7 ottobre 2026 (confermate dall'utente)

**ADR-006 · react-router-dom per la navigazione**
Pro: URL per schermata, tasto indietro, standard. Contro: una dipendenza in più. Alternativa: stato locale con schermate condizionali (più semplice, ma perde indietro/avanti e deep link).

**ADR-007 · TanStack Query per i dati dal server**
Pro: cache, invalidazione, stati di caricamento/errore già gestiti. Contro: una libreria da imparare. Alternativa: `useEffect` + `useState` scritti a mano (più codice, più bug).

**ADR-008 · zod per la validazione**
Pro: un solo schema per form e risposte API, tipi derivati. Contro: dipendenza in più.

## Punti aperti (rispondere prima dello step indicato)
- **Step 3:** verificare sull'iPhone che con l'OTP la sessione nella PWA duri (chiudere/riaprire, dopo 1 giorno, dopo 1 settimana) e che il servizio email predefinito di Supabase regga l'uso quotidiano; altrimenti SMTP personalizzato.
- **Step 4:** unità "porzione" per i cibi: solo grammi con scorciatoia da `serving_g`, o anche millilitri per i liquidi? (Latte, olio.) Proposta: solo grammi in v1, con densità ignorata e dichiarata.
- **Step 6:** sesso e data di nascita si inseriscono nell'app alla prima apertura (schermata profilo) e restano nel database, non nel repo.
- **Step 8:** requisiti e limiti attuali di Open Food Facts da verificare nella documentazione ufficiale.
- **Step 10:** valore di `ENERGY_PER_KG` (7700): tenere come costante modificabile e rivalutare dopo qualche mese di dati reali.
