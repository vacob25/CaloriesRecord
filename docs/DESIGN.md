# Design

Riferimento visivo: canvas "App Calorie – Design v1" (schermate Oggi, Aggiungi pasto, Statistiche). Se codice e canvas divergono, vince questo documento; segnala la differenza all'utente.

**Attenzione ai dati di esempio del canvas:** i numeri sono illustrativi e non coerenti tra loro (ad esempio i macro mostrati non sommano esattamente al target). Le regole vere sono in `docs/DOMAIN_RULES.md`.

## Principi
1. Registrare un pasto in pochi tocchi, con un pollice.
2. Una cosa importante per schermata: Oggi = calorie restanti; Aggiungi = quantità in grammi; Statistiche = andamento.
3. Tema chiaro, grafici colorati ma con significato fisso (vedi colori).
4. Mai solo il colore a portare informazione: sempre anche testo o forma.

## Token
| Token | Valore | Uso |
| --- | --- | --- |
| `--bg` | #F4F6F9 | sfondo app |
| `--surface` | #FFFFFF | card |
| `--ink` | #15171E | testo principale |
| `--ink-2` | #3A3F4B | testo secondario forte |
| `--muted` | #5B6170 | etichette, testo secondario |
| `--line` | #E4E8EE | bordi e divisori |
| `--green` | #1A7F5A | calorie, azione primaria, "obiettivo rispettato" |
| `--green-dark` | #11573E | testo su fondo verde chiaro |
| `--green-tint` | #DCF3E8 | badge verdi |
| `--blue` | #2F62D9 | proteine, peso, traguardo |
| `--orange` | #E9861F | carboidrati, giorni sotto target |
| `--orange-text` | #C4680C | testo arancio (contrasto) |
| `--magenta` | #B83E95 | grassi |

Regole sul colore: verde = calorie e azioni; blu = proteine e peso; arancio = carboidrati e "sotto target"; magenta = grassi. Non riusare questi colori con altri significati. Il testo arancio chiaro (#E9861F) non va su fondo bianco per testi piccoli: usare `--orange-text`.

## Tipografia
Plus Jakarta Sans, servito dall'app con `@fontsource-variable/plus-jakarta-sans` (ADR-017: niente Google Fonts, il font è nel precache), pesi 400-800. Numeri grandi 800; titoli 800; etichette 600-700. Scala: 11 (nav) · 12-13 (etichette) · 15 (voci) · 18-22 (valori) · 28 (titolo schermata) · 32 (numero dell'anello).

## Forma e spazio
Raggi: card 20-24, pulsanti 16, pill 999, sheet 28 in alto. Margini laterali 20 px. Spazi a multipli di 4. Ombre leggere e solo sulle card. Larghezza di riferimento 390 px, con tutto fluido fino a 360 px; oltre i 480 px il contenuto si centra con larghezza massima 480.

## Accessibilità
- Aree toccabili ≥ 44×44 px.
- Contrasto testo ≥ 4,5:1 (3:1 sopra i 24 px). Verificare in particolare i testi piccoli su fondi tinta.
- Elementi cliccabili sono `<button>` o `<a>`, mai `<div onClick>`. Pulsanti con sola icona hanno `aria-label`.
- Ogni campo ha `<label>`. Campi numerici con `inputmode="decimal"` o `"numeric"`.
- Rispettare `prefers-reduced-motion`. Safe area iOS gestite (notch e barra in basso).
- I grafici hanno un testo alternativo che dice il risultato (es. "Peso in salita di 0,6 kg in 4 settimane").

## Schermate

### Oggi (home)
- Intestazione: data per esteso, titolo "Oggi", pill con peso del giorno (tocco → registra/modifica il peso).
- Card riepilogo: anello con "kcal restanti" al centro; a lato obiettivo, mangiate e badge del tipo di giorno ("Giorno calcio +200"); sotto tre barre macro (proteine, carboidrati, grassi) con "mangiati / obiettivo".
- Se le kcal superano il target: l'anello mostra "oltre di N kcal", non numeri negativi, senza colore di allarme (in un bulk non è un errore grave).
- Promemoria del peso (step 17) in cima, sotto l'intestazione, finché il peso di oggi non è registrato: testo a sinistra, pulsante "Registra peso" a destra.
- Cinque card pasto (Colazione, Snack, Pranzo, Cena, Spuntino) con totale kcal e voci; un pasto vuoto è una card tratteggiata "+ Aggiungi". Tocco su una voce → modifica grammi o elimina.
- Card Acqua (step 15) sotto i pasti: totale del giorno ("1,45 L", e "di 2 L" solo se c'è un obiettivo, con barra blu e "Mancano …"); una riga per contenitore (step 17) con icona, nome, capienza e "− N +" (N = quante volte oggi): Bicchiere 200 ml, Bottiglietta 500 ml, Bottiglia 1,5 L, poi i contenitori personali; ultima riga "Altra quantità" con il totale libero del giorno, il suo "−" e un "+" che apre il pannello (ml, oppure "Salva come contenitore" che salva senza aggiungere acqua). Pulsanti "Aggiungi Bicchiere" / "Togli Bicchiere" (44 px).
- Tipo di giorno (riposo/palestra/calcio/entrambi): selettore sul badge; cambia il target del solo giorno.
- Promemoria peso (step 13, ADR-047): card sotto l'intestazione se non ci si pesa da `WEIGHT_REMINDER_DAYS` giorni o più (o non c'è nessuna pesata), con la pill del peso. Non compare se la card del target sta già chiedendo il peso.
- Ricalibrazione: se c'è una proposta in attesa, un avviso "Nuova proposta di ricalibrazione ›" porta alla sezione Ricalibrazione del Profilo.
- Tocco su una voce: pannello con quantità, modifica ed elimina; se il cibo esiste ancora con la stessa unità mostra anche le sue porzioni casalinghe (i valori restano quelli dello snapshot, ADR-035).
- Barra di navigazione in basso: Oggi, Cibi, "+" centrale, Statistiche, Profilo.

### Aggiungi pasto
- Barra in alto: indietro, titolo "Aggiungi a {pasto}". Scelta del pasto a 4 segmenti (default: in base all'ora).
- Ricerca testuale + pulsante barcode. Schede: Recenti, Preferiti, I miei cibi, Ricette.
- Elenco con nome, fonte (I miei cibi / Open Food Facts / Ricetta) e kcal per 100 g.
- Pannello inferiore alla selezione: grammi con − / + a passi di 10 g e campo numerico, anteprima kcal e macro in tempo reale, pulsante "Aggiungi a {pasto}". Se il cibo ha porzioni casalinghe (step 14), chip "1 uovo medio (50 g)": scelta la porzione compare un contatore − / + a passi di ½ e la quantità si calcola da sola; scrivere a mano o usare − / + da 10 deseleziona la porzione. Senza porzioni, se il cibo ha `serving_g`, scorciatoia "1 porzione". Quantità proposta: l'ultima usata, poi `serving_g`, poi la prima porzione casalinga (1×, già selezionata), poi 100. Per i liquidi l'etichetta è "Millilitri" e l'unità "ml".
- Il pulsante fa un'unica azione e torna a Oggi. Annulla possibile con un avviso "Aggiunto · Annulla" per alcuni secondi.
- Scheda "Catalogo" (step 16, riquadri dallo step 17): 12 riquadri a 3 colonne con icona a linea, nome e numero di voci; dentro una categoria ogni voce ha kcal per 100 g/ml e la stella dei preferiti, con i preferiti in cima; durante una ricerca le voci del catalogo compaiono sotto i propri cibi in "Dal catalogo". Una nota spiega da dove vengono i valori e che la voce si copia tra i propri cibi. Le voci già copiate mostrano "Già tra i tuoi cibi". Se non hai ancora nessun cibo la scheda Catalogo è quella aperta all'inizio. Il catalogo si cerca anche nella scelta degli ingredienti di una ricetta (da 2 lettere).

### Cibi
In alto Nuovo cibo e Nuova ricetta, poi la ricerca. Senza ricerca (step 17): "★ Preferiti" e "Alimenti recenti" (al massimo 8), ogni riga con stella e matita (Modifica); in fondo "Tutti i tuoi cibi (N)" apre l'elenco completo. "Nuovo cibo": nome, marca, unità (grammi o millilitri), kcal e macro per 100 g/ml (o per porzione, con conversione), porzioni casalinghe facoltative (nome + quantità), barcode opzionale. "Nuova ricetta": ingredienti con grammi, peso totale cotto, risultato per 100 g. Modifica ed eliminazione sempre disponibili (l'eliminazione non tocca lo storico).

### Scanner barcode
Fotocamera a schermo intero con riquadro di inquadratura, pulsante torcia se disponibile, annulla. Prodotto non trovato → "Non trovato su Open Food Facts. Crealo a mano" con codice già compilato. Permesso fotocamera negato → spiegazione e alternativa di ricerca testuale.

### Peso
Inserimento del peso mattutino, grafico con punti grezzi e media mobile, distanza dal peso obiettivo del profilo, pendenza in kg/settimana. Nota fissa: "Conta la tendenza, non la singola pesata".
- Riepilogo "Ultimi 5 giorni" (step 13): pesate, media e variazione rispetto ai 5 giorni prima.
- Si apre anche da Statistiche: la freccia indietro torna a Statistiche (altrimenti a Oggi).

### Statistiche
Selettore Settimana/Mese con intervallo date. Tre numeri chiave (media giornaliera, giorni rispettati, peso in kg/settimana), grafico a barre calorie contro linea del target (verde = rispettato, arancio = sotto), grafico peso 4 settimane con traguardo, distribuzione calorie per pasto, cibi più frequenti. Periodo senza dati: stato vuoto, non grafici a zero.

### Profilo
Dati personali (sesso, data di nascita, altezza), parametri (fattore attività, surplus, bonus allenamento, peso obiettivo, g/kg proteine e grassi), proposta di ricalibrazione (accetta/rifiuta con spiegazione dei numeri), Acqua (obiettivo facoltativo in litri, elenco dei propri contenitori con elimina), esci. Ogni parametro ha una nota breve che spiega cosa cambia.

### Benvenuto (prima apertura)
`/benvenuto`, mostrata finché non esiste il profilo (ADR-037): sesso, data di nascita, altezza, peso di oggi (salvato come prima pesata) e peso obiettivo facoltativo. Limiti di DOMAIN_RULES §10. Dopo il salvataggio non ricompare.

### Login
Email e password (ADR-028, ADR-064):
- Campo email (`type="email"`, `autocomplete="username"`) e campo password (`autocomplete="current-password"`), così il Portachiavi iCloud propone e salva l'accesso. Pulsante "Mostra/Nascondi" la password (≥ 44 px, con `aria-label`). Pulsante "Accedi".
- Errore unico "Email o password non corretti." (non dice quale dei due è sbagliato). Dopo un errore i campi restano compilati.
- Sotto: "Non hai un account? Registrati", "Password dimenticata?" (si apre una spiegazione: la reimposta l'amministratore, l'app non invia email) e "Privacy". Tutti ≥ 44 px.

### Registrati (step 18)
Email, password (`autocomplete="new-password"`, "Mostra", aiuto "Almeno 8 caratteri…"), link "Leggi l'informativa privacy" su una riga sua (≥ 44 px), casella di consenso che nomina i dati sulla salute, pulsante "Registrati". Errori sotto ogni campo; il rifiuto del server (es. "Registrazione solo su invito…") in un riquadro con `role="alert"`. A registrazione riuscita si va al Benvenuto.

### Privacy (step 18)
Pagina pubblica, leggibile anche senza login (`/privacy`): avviso in testa "Testo di base da far rivedere", poi dati raccolti, perché, dove stanno, chi li vede, esportare e cancellare, contatto. Link da Accedi, Registrati e Profilo.

### Profilo · I tuoi dati (step 18)
"Esporta i miei dati" apre il foglio di condivisione di iOS con il file JSON; se non disponibile mostra il testo con "Copia tutto". "Elimina account": spiegazione, campo "Scrivi ELIMINA per confermare", pulsante distruttivo "Elimina account e dati" attivo solo con la parola esatta.

## Stati comuni
Caricamento = scheletro con la stessa forma del contenuto. Errore = messaggio + "Riprova". Vuoto = frase + azione. Offline = banner "Serve la connessione". L'avviso "Nuova versione disponibile" (Aggiorna / Dopo) sta sopra l'avviso "Aggiunto · Annulla": i due non si sovrappongono mai.

## Icone e logo
Icone a tratto (stroke 2, angoli arrotondati), stile uniforme. Icona dell'app: forma semplice su fondo `--green`, senza testo; 192, 512 (anche maskable) e 180 px per iOS.
