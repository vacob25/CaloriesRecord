# HO 02 · Area Allenamenti

> Copia nel repo con le correzioni decise dopo la Fase 0 (19/10/2026), segnate **[Aggiornato 19/10]**. La Fase 8 è riscritta sul modello degli step 21-22 (sport liberi fino a 4, giorno = insieme di sport, calorie per sport sommate).

Fasi 3-8 di `HO_00_MASTER.md`. Valgono le regole di quel file: una fase alla volta, STOP a fine fase, nessun numero di dominio senza fonte (`docs/TRAINING_RULES.md`), nessun dato personale nel repo.

## Cosa voglio

Una macro area per gli allenamenti in palestra (manubri e attrezzi), con:

- una **libreria di esercizi** (principali e di nicchia), ognuno con nome e dati modificabili e una zona **note** mia;
- una sezione **Crea scheda**: scelgo i giorni, poi per ogni giorno scelgo gli esercizi divisi per gruppo muscolare, e per ognuno posso aumentare o diminuire serie e ripetizioni e mettere il peso per ogni serie;
- l'**allenamento**: quando scelgo una scheda devo spuntare gli esercizi che faccio, perché a volte ne salto uno e dev'essere visibile;
- i **progressi**: i pesi registrati sessione dopo sessione costruiscono un grafico per esercizio, con il carico che sale nei mesi e i miglioramenti;
- l'**analisi del carico**: dimmi se sto allenando troppo un muscolo (serve riposo) o troppo poco (es. petto una volta a settimana);
- le **tecniche** (superset ecc.) e i tempi di recupero, con dati verificati;
- i **collegamenti con la nutrizione** e la **notifica** "oggi è il giorno di (scheda/gruppo muscolare)".

## Punti critici che voglio da te prima di scrivere codice

1. **Rete in palestra.** L'app oggi non ha modalità offline. In palestra spesso non c'è segnale: una sessione che perde i dati è inaccettabile. Proponi una bozza locale della sessione in corso (IndexedDB o simile) che si sincronizza appena torna la rete, con avviso chiaro se non è ancora salvata. Sul telefono iOS può cancellare i dati locali di un sito poco usato: dichiaralo e limita il rischio (sincronizza a ogni serie completata quando c'è rete). Serve un ADR perché è un'eccezione a una regola esistente.
2. **Eccezione alla regola "ogni tabella ha `user_id`".** Il catalogo esercizi è uguale per tutti: tabella globale, `select` solo per `authenticated`, nessuna scrittura da client. Le modifiche e le note stanno in una tabella personale con `user_id`. ADR con alternative: (A) copiare tutto il catalogo a ogni utente alla registrazione (semplice, ma gli aggiornamenti non arrivano); (B) catalogo globale + copia personale creata alla prima modifica o al primo uso. Io preferisco B; decidilo nel piano con i pro e i contro.
3. **Colori.** `DESIGN.md` dice "non riusare i colori con altri significati" (blu = proteine e peso corporeo). Per i grafici di allenamento serve un nuovo colore con significato fisso, con contrasto verificato. Proponilo e aggiorna `DESIGN.md`.

## Fase 3 · Libreria esercizi

**Fonte dati.** Parti da `free-exercise-db` (GitHub `yuhonas/free-exercise-db`): licenza Unlicense (pubblico dominio), oltre 800 esercizi in JSON con `name`, `force`, `level`, `mechanic`, `equipment`, `category`, `primaryMuscles`, `secondaryMuscles`, `instructions`. Attenzione: nomi in inglese; `force`, `mechanic` ed `equipment` sono incompleti in alcuni file; i termini delle immagini non sono dichiarati, quindi **niente immagini** in v1. **Non usare `wger`**: i suoi dati sono CC-BY-SA 3.0 (obbligo di attribuzione e share-alike su un repo e un database pubblici) salvo mio ok esplicito. Riapri tu il README e la licenza e confermami quanto sopra.

**"Tutti gli esercizi, anche di nicchia" non significa inventarli.** Importa solo ciò che sta nella fonte. Gli esercizi che mancano li aggiungo io dall'app (esercizio personalizzato).

**Importazione.**
- Script una tantum in `scripts/` (non nel build dell'app) che scarica il JSON, filtra per attrezzatura da palestra (manubri, bilanciere, cavi, macchine, kettlebell, corpo libero; escludi ciò che non c'entra, dimmi cosa scarti), mappa i muscoli a un vocabolario controllato nostro (chiave interna + etichetta italiana: petto, dorsali, parte alta della schiena, lombari, trapezi, spalle, bicipiti, tricipiti, avambracci, addominali, glutei, quadricipiti, femorali, polpacci, adduttori, abduttori; verifica i valori reali della fonte, non fidarti di questo elenco), traduce i nomi in italiano con un glossario coerente (`docs/GLOSSARIO_ESERCIZI.md`) e produce un seed SQL.
- Ogni riga porta `source`, `source_id` e un campo di revisione. **Verifica:** 100% degli esercizi mappati con regole esplicite; controllo incrociato di 40 esercizi a campione con una seconda fonte autorevole; nel report elenca scartati, ambigui e il campione con l'esito. Quello che non regge non entra.
- Dopo l'importazione niente dipendenza dalla rete esterna: i dati stanno nel nostro database.

**Funzioni.** Ricerca e filtro per gruppo muscolare e attrezzatura. Scheda esercizio con: nome, gruppi primari e secondari, attrezzatura, **note mie** (testo libero, private, per utente), possibilità di modificare tutto (nome compreso), nascondere un esercizio, creare un esercizio personalizzato. Le modifiche non toccano lo storico (vedi snapshot).

**[Aggiornato 19/10] Controllo incrociato dei 40 esercizi:** confronto programmatico con `wger` usato **solo per verificare** (dati da GitHub, che è raggiungibile; niente copiato nel nostro database né nel repo): nel report resta solo "concorda / non concorda" per esercizio. Dove le due fonti non concordano, si apre una terza fonte autorevole per quel caso e decide Riccardo. Niente scraping di ExRx (termini d'uso propri).

**Dati.** Tabelle (nomi indicativi, decidi tu): catalogo globale, esercizi personali con `catalog_id` opzionale. RLS su tutte; chiavi esterne composte `(id, user_id)` come nella migrazione 001; grant espliciti e nessuno ad `anon`; indici su `user_id`.

**Test:** script RLS esteso (un utente non vede né modifica gli esercizi o le note di un altro; il catalogo non è scrivibile da client); unit test del mapping dei muscoli.

## Fase 4 · Schede

**Flusso "Crea scheda".** Nome della scheda → quanti giorni e come si chiamano (es. "Push", "Gambe", "Giorno A"), con giorno della settimana facoltativo → per ogni giorno scelgo gli esercizi **divisi per gruppo muscolare** (elenco a gruppi espandibili, un tocco per aggiungere) → per ogni esercizio:
- numero di serie con + e −;
- ripetizioni per serie (un numero o un intervallo);
- peso per ogni serie (facoltativo nella scheda: serve soprattutto in sessione);
- tempo di recupero suggerito (valore da `TRAINING_RULES.md`, modificabile);
- tecnica (vedi Fase 7) e nota dell'esercizio nella scheda;
- riordino, rimozione, duplica giorno, duplica scheda, archivia scheda.

**Dati (indicativi):** scheda → giorni → esercizi del giorno → serie previste. Giorno locale come stringa `YYYY-MM-DD` dove serve (regola 6). Nessun esercizio cancellato fisicamente se usato in una scheda o in una sessione: archivia.

**UI:** tutto raggiungibile con un pollice, aree ≥ 44 px, stati vuoto/caricamento/errore come in `ARCHITECTURE.md`.

## Fase 5 · Sessione di allenamento

- **Inizia allenamento:** scelgo scheda e giorno (suggerisci il giorno in base al giorno della settimana o al prossimo nella rotazione, senza imporlo).
- **Checklist degli esercizi:** devo toccare per segnare ciò che ho fatto. Tre stati visibili: da fare, fatto, **saltato**. Gli esercizi saltati restano ben visibili durante la sessione e nel riepilogo finale; posso terminare l'allenamento con esercizi saltati.
- **Serie:** per ogni serie peso, ripetizioni e spunta. Precompila con i valori dell'ultima volta e mostra "ultima volta: 3×8 a 60 kg". Tipi di serie: riscaldamento, normale, drop set. Posso aggiungere o togliere serie, aggiungere un esercizio non previsto, scrivere una nota di sessione.
- **Timer di recupero** sullo schermo, calcolato da un orario di inizio (non da un `setInterval`, che iOS sospende). Niente push per il timer.
- **Snapshot:** la sessione salva nome dell'esercizio, gruppi muscolari e attrezzatura al momento dell'allenamento (come ADR-011), così rinominare o archiviare un esercizio non cambia lo storico.
- **Rete:** vedi punto critico 1.
- Quando inizio una sessione scrivo lo stato `workout` del giorno (serve ai promemoria, Fase 8).

**Test:** unit test delle funzioni pure (precompilazione dai dati dell'ultima sessione, stato saltato/fatto, riepilogo); RLS sulle tabelle di sessione.

## Fase 6 · Progressi

Per ogni esercizio un grafico con scala temporale (1 mese, 3 mesi, 6 mesi, tutto):
- **carico massimo** per sessione (serie di lavoro, esclusi i riscaldamenti);
- **1RM stimato** con una formula **scelta con fonte** (le più note sono Epley e Brzycki; verifica quale si usa, per quante ripetizioni è affidabile e non calcolarlo fuori da quell'intervallo; dichiara che è una stima);
- **volume** (serie × ripetizioni × peso) per settimana;
- **record personali** evidenziati (peso massimo, 1RM stimato, ripetizioni massime a un dato peso) e una lista "miglioramenti";
- testo alternativo che dice il risultato ("Panca piana: da 60 a 72,5 kg in 4 mesi").

Calcoli in funzioni pure in `src/lib/` con test Vitest e casi calcolati a mano in `TESTING.md`. Stato "dati insufficienti" finché non ci sono almeno N sessioni (N con fonte o dichiarato come scelta di prodotto). Se vuoi suggerire "è ora di aumentare il carico" (doppia progressione), servono regola e fonte in `TRAINING_RULES.md` e il mio ok.

## Fase 7 · Carico e recupero per gruppo muscolare, tecniche

**Analisi** (calcolata dai dati reali, sulle serie di lavoro, riscaldamenti esclusi):
- **Serie settimanali per gruppo muscolare** nelle ultime 1-4 settimane. Come contare i gruppi secondari è una convenzione (es. primario = 1, secondario = 0,5): se la usi, dichiarala "convenzione, non dato sperimentale" e chiedimi conferma.
- **Fascia di riferimento:** punto di partenza 12-20 serie a settimana (Baz-Valle 2022, vedi `HO_00`), **indicativa** e modificabile da me nelle impostazioni. Mostra stato "sotto / nella fascia / sopra".
- **Giorni dall'ultima sessione** del gruppo e **sessioni a settimana** nelle ultime 4 settimane. Per la frequenza, apri e riporta fedelmente le fonti (Schoenfeld 2016 e le successive): se a volume uguale la differenza si riduce, dillo, non semplificare in "due volte a settimana è meglio".
- **Recupero:** ore dall'ultima sessione con volume significativo per quel gruppo. La soglia (es. 48 ore) va in `TRAINING_RULES.md` solo se trovi una fonte. Messaggio come "ultima sessione 20 ore fa, probabile recupero incompleto", mai "sovrallenamento".
- Non mostrare nulla finché non ci sono almeno 2 settimane di dati.

**Tecniche** (solo ciò che è utile e verificabile): v1 = riscaldamento, drop set, **superset** (esercizi collegati in un gruppo, il recupero conta dopo la coppia; antagonisti o stesso muscolo). Elenca per le altre (giant set, rest-pause, cluster, myo-reps, tempo) cosa dicono le fonti e proponimi se valgono la complessità: non implementarle senza il mio ok.

**Tempi di recupero:** valori di default per tipo di esercizio (multiarticolare, di isolamento) e obiettivo (forza, ipertrofia) solo con fonte; le fonti sono quelle candidate di `HO_00`.

## Fase 8 · Ponti nutrizione ↔ allenamento e notifica

**Sì, in questo ordine di utilità:**
1. **Sport "palestra" del giorno automatico. [Aggiornato 19/10]** Quando inizio una sessione, l'app propone di aggiungere al giorno lo sport "palestra" del mio profilo (quello riconosciuto come palestra, vedi `src/lib/sportEnergy.ts`; se non c'è o è ambiguo, lo scelgo io una volta nelle impostazioni), lasciando gli altri sport già segnati (es. il calcio). C'è "Annulla". Il target del solo giorno cambia con le calorie per sport dello step 22 (ADR-075), sommate agli altri sport. Il calcio e gli altri sport restano manuali. Nessun calcolo di calorie per singola sessione. Non modificare nulla in silenzio.
2. **Card in "Oggi":** "Allenamento di oggi: Push" con stato (da fare, in corso, fatto) e tocco per iniziare.
3. **Forza contro peso corporeo** (in Peso o Statistiche, dopo almeno 4 settimane): tendenza del peso (funzioni esistenti, soglie di `DOMAIN_RULES.md`) accanto alla tendenza della forza (1RM stimato medio sugli esercizi principali). Lettura: peso e forza in salita = coerente con un bulk; peso in salita veloce e forza ferma = forse surplus alto; peso e forza in calo = forse deficit o recupero insufficiente. È un'euristica, chiamala così, con testo prudente.
4. **Statistiche:** media di kcal, proteine e percentuale di giorni rispettati nei giorni di allenamento contro i giorni di riposo.
5. **Notifica del giorno di allenamento** (infrastruttura di `HO_01`): giorno e orario per ogni giorno scheda, testo scelto da me o generico.

**No, e perché:**
- calorie bruciate stimate per singola sessione (impreciso, conteggio doppio con fattore di attività e con le calorie per sport dello step 22, che restano la regola);
- macro diversi per giorno di allenamento senza una fonte verificata (rimandiamo: prima servono dati miei);
- qualsiasi recupero delle calorie non assunte (regola 5, resta valida).

Aggiorna `ARCHITECTURE.md`, `DATA_MODEL.md`, `DESIGN.md`, `TESTING.md`, `SECURITY.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md`, `TRAINING_RULES.md`.

## Sicurezza e privacy (valgono per ogni fase)

- RLS attiva su **ogni** nuova tabella, 4 policy, grant solo ad `authenticated`, `user_id` con default `auth.uid()`, chiavi esterne composte dove una tabella punta a un'altra personale, indice su `user_id`.
- Estendi `supabase/checks/rls_two_users.sql` per ogni nuova tabella: l'utente B non legge, modifica o cancella nulla di A; `anon` niente; inserimento con `user_id` altrui fallisce.
- La pagina privacy, l'esportazione e l'eliminazione account includono le nuove tabelle (verifica automatica).
- Nessun dato di allenamento nei messaggi push se non l'etichetta scelta da me.
- Nessuna libreria nuova senza dirlo e motivarla: per i grafici usa Recharts, già presente.

## Criteri di accettazione di ogni fase

Per ogni fase: `typecheck`, `lint`, `test` e `build` passano; RLS verificata sulle tabelle nuove; documenti aggiornati; PR dedicata; elenco di ciò che non hai potuto verificare (iPhone, rete, notifiche reali); lista di cosa provo io sull'iPhone con l'app installata.
