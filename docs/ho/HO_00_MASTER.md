# HO MASTER · Revisione, promemoria e area Allenamenti

> Copia nel repo del piano ricevuto il 19/10/2026, con le correzioni decise dopo la Fase 0 (risposte di Riccardo, 19/10/2026) segnate come **[Aggiornato 19/10]**. La revisione è in `docs/REVIEW_2026-10-19.md`.

Rispondo alla tua analisi dei promemoria (blocco 1) e allargo il lavoro. Questo file è l'ordine generale e le regole comuni. `HO_01_NOTIFICHE.md` e `HO_02_ALLENAMENTI.md` li leggi solo quando arriva la loro fase.

## Ruolo e regole

- Sei il developer di questa app. Spiegazioni brevi, solo quando servono. Se una mia idea è sbagliata o rischiosa, dimmelo chiaramente e proponi l'alternativa. Se manca un'informazione, chiedimela prima di assumere.
- Valgono tutte le regole di `CLAUDE.md`. **Una fase alla volta: finita la fase, fermati.** Io provo sull'iPhone e confermo. Non iniziare la fase dopo senza il mio ok.
- Se questo piano viola una regola o un ADR esistente (es. "ogni tabella ha `user_id`", ADR-065 "nessun codice server"), dimmelo e scrivi un ADR con motivo e alternative. Non decidere in silenzio.
- Lo stato reale è quello del repo, non quello che ricordo io. Prima di tutto leggi `STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/SECURITY.md`, `docs/DATA_MODEL.md`, `docs/DOMAIN_RULES.md`, `docs/TESTING.md`, `docs/DESIGN.md`. Assegna tu i numeri di step in `ROADMAP.md`: qui parlo di "fasi".
- Repo pubblico: nessun dato personale reale, nemmeno in test, esempi o seed. Nessuna chiave nel repo. Mai `service_role` nel client.

## Obiettivo

1. Revisionare tutta l'app e portarmi un report dei problemi.
2. Promemoria push (modalità A scelta, vedi `HO_01`).
3. Nuova area **Allenamenti** (vedi `HO_02`): libreria esercizi, schede, sessioni, progressi, carico e recupero per gruppo muscolare.
4. Collegamenti utili tra nutrizione e allenamento.

## Regola sui dati: "verificato" vuol dire con fonte

- **Nessun numero di dominio inventato.** Ogni regola o valore sull'allenamento (serie settimanali, recuperi, frequenze, incrementi di carico, formule) va in `docs/TRAINING_RULES.md` con una riga per voce: regola, valore, fonte (URL o DOI che hai aperto davvero con WebFetch, non a memoria), tipo di prova (meta-analisi, RCT, posizione di una società scientifica, opinione di esperti), limiti (chi è stato studiato), stato (`verificato` / `da confermare`).
- Se non riesci ad aprire la fonte, la voce resta `da confermare` e **non entra nell'app**. Elencale a parte, non nasconderle.
- Prima di scrivere codice che usa quei valori, mostrami la tabella e aspetta il mio ok (come per `DOMAIN_RULES.md`).
- Gli avvisi nell'app sono suggerimenti, non consigli medici: una riga di testo visibile lo dice. Niente diagnosi ("sei in sovrallenamento"): l'app non ha i dati per dirlo.
- **Fonti già controllate da me** (puoi partire da qui, ma riapri tu gli originali):
  - Baz-Valle et al., *J Hum Kinet* 2022, 81:199–210 (PMC8884877): suggerisce 12–20 serie settimanali per gruppo muscolare per l'ipertrofia. Limiti dichiarati dagli autori: 7 studi, solo uomini 18–35 anni con almeno un anno di allenamento, volume non standardizzato. Quindi **indicativo**, non una legge.
  - Per `free-exercise-db`: licenza Unlicense (pubblico dominio) dichiarata nel README; campi `force`, `mechanic`, `equipment` incompleti in alcuni file; termini delle immagini non dichiarati.
  - Per `wger`: dati iniziali degli esercizi sotto CC-BY-SA 3.0, codice AGPL.
- **[Aggiornato 19/10] Rete dell'ambiente.** Oggi PubMed, PMC e la documentazione di Supabase non si raggiungono dall'ambiente di sviluppo; prima delle Fasi 6-7 Riccardo aggiunge i domini necessari (elenco minimo nella risposta alla Fase 0). Fino ad allora le voci restano `da confermare`.
- **Candidate da verificare tu** (non ho potuto aprirle, i dettagli non vanno dati per buoni): Schoenfeld et al. 2016 sulla frequenza di allenamento (*Sports Med*, PMID 27102172) e le meta-analisi successive sulla frequenza a volume pareggiato; Schoenfeld et al. 2016 sui recuperi tra le serie (*J Strength Cond Res*); Schoenfeld, Ogborn, Krieger 2017 sulla relazione dose-risposta del volume (*J Sports Sci*); posizione ACSM sulla progressione nell'allenamento coi pesi; studi sui superset. Se un titolo o un dato non torna, dimmelo.

## Ordine di lavoro (ogni fase termina con STOP)

| Fase | Cosa | File |
| --- | --- | --- |
| 0 | Revisione dell'intera app: **solo report**, nessuna modifica | questo file |
| 1 | Prova di fattibilità push su iPhone | `HO_01` |
| 2 | Promemoria completi (pasti) | `HO_01` |
| 3 | Libreria esercizi (importazione, modifica, note) | `HO_02` |
| 4 | Schede: giorni, esercizi per gruppo muscolare, serie e ripetizioni | `HO_02` |
| 5 | Sessione di allenamento: checklist, pesi per serie, esercizi saltati | `HO_02` |
| 6 | Progressi e grafici per esercizio | `HO_02` |
| 7 | Carico e recupero per gruppo muscolare, tecniche (superset ecc.) | `HO_02` |
| 8 | Ponti nutrizione↔allenamento e notifica "oggi è il giorno di…" | `HO_02` + `HO_01` |

Per ogni fase: piano breve → aspetti il mio ok → implementi → test → documenti aggiornati → PR separata → riepilogo con "cosa provare sull'iPhone" e "cosa non ho potuto verificare". Se una fase ti sembra troppo grande, spezzala e dimmelo.

## Fase 0 · Revisione (SOLO LETTURA)

Non modificare codice in questa fase. Produci `docs/REVIEW_2026-10-19.md` con una tabella: gravità (alta/media/bassa), area, file e riga, problema, correzione proposta, impegno stimato. Poi fermati: io scelgo quali correzioni applicare, che si fanno in PR piccole e separate **prima** della Fase 3 (le gravità alte prima di tutto).

Aree da controllare:

1. **Sicurezza:** RLS attiva su ogni tabella e policy corrette; grant (nessuno ad `anon`); funzioni `security definer` con `search_path` vuoto e `execute` revocato a `public` e `anon`; segreti nella cronologia git; `npm audit`; intestazioni HTTP in `vercel.json`; l'app rifiuta chiavi `sb_secret_`.
2. **Correttezza dei calcoli:** esegui i casi di `TESTING.md` e confrontali con `DOMAIN_RULES.md`; date come giorni locali Europe/Rome; ora legale (2026-10-25, 2027-03-28).
3. **Sessione e rete:** login, logout, pulizia cache e storage, token scaduto, offline, messaggi d'errore (con codice tecnico per gli sconosciuti).
4. **PWA iOS:** safe area, flusso "Nuova versione disponibile", icone, avvio da schermata Home, comportamento dopo giorni di inattività.
5. **Accessibilità e design:** aree toccabili ≥ 44 px, `<label>`, contrasto, `prefers-reduced-motion`, rispetto dei token di `DESIGN.md`.
6. **Prestazioni:** dimensione del bundle, query ridondanti, chiavi di cache di TanStack Query, invalidazioni.
7. **Pulizia:** codice morto (residui del login OTP), duplicati, TODO, numerazione ADR, coerenza tra `STATUS.md`, `ROADMAP.md` e `DECISIONS.md`.
8. **Test:** cosa manca, cosa è fragile.
9. **Privacy:** esportazione, eliminazione account e pagina privacy coprono **tutte** le tabelle attuali (e una verifica automatica lo garantisce per quelle future).
10. **Idee mie sbagliate o rischiose** in questi tre file: dimmele ora, non dopo.

## Decisioni mie (contestale se vedi un problema)

1. **Una sola infrastruttura di promemoria** per pasti e allenamenti (slot di tipo diverso). Vedi `HO_01`.
2. **Nessuna stima di "calorie bruciate" per sessione.** Le stime da pesi sono molto imprecise e verrebbero contate due volte. **[Aggiornato 19/10]** Resta la regola dello step 22 (ADR-075): ogni sport del profilo vale una quantità fissa di calorie calcolata sul peso, e più sport nello stesso giorno si sommano. La sessione di palestra non calcola nulla di suo: segna solo lo sport "palestra" del giorno (Fase 8).
3. **Nessuna immagine o video degli esercizi in v1** (peso del sito, termini delle immagini non chiari).
4. **Esercizi a catalogo globale in sola lettura**, con copia personale modificabile per utente. È un'eccezione alla regola "ogni tabella ha `user_id`": serve un ADR esplicito. Dettagli in `HO_02`.
5. **Funziona anche senza rete in palestra** (bozza locale della sessione, sincronizzata appena torna la connessione). Contraddice "nessuna modalità offline in v1" solo per la sessione in corso: ADR, vedi `HO_02`.

## Cosa mi servirà da me

Alla fine di ogni fase dimmi in poche righe cosa devo fare io (configurazioni Supabase, segreti Vercel, prove sull'iPhone).
