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
Plus Jakarta Sans (Google Fonts, pesi 400-800). Numeri grandi 800; titoli 800; etichette 600-700. Scala: 11 (nav) · 12-13 (etichette) · 15 (voci) · 18-22 (valori) · 28 (titolo schermata) · 32 (numero dell'anello).

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
- Quattro card pasto (Colazione, Pranzo, Cena, Snack) con totale kcal e voci; un pasto vuoto è una card tratteggiata "+ Aggiungi". Tocco su una voce → modifica grammi o elimina.
- Card Acqua (step 15) sotto i pasti: totale del giorno ("1,45 L", e "di 2 L" solo se c'è un obiettivo, con barra blu e "Mancano …"); griglia a 3 colonne di tocchi rapidi con icona, nome e quantità (Bicchiere 200 ml, Bottiglietta 500 ml, Bottiglia 1,5 L, poi i contenitori personali) e "Altra quantità" (pannello con ml e "Salva come contenitore"); riga "Ultima aggiunta: … · Annulla". Il nome visibile fa parte del nome accessibile ("Aggiungi Bicchiere 200 ml").
- Tipo di giorno (riposo/palestra/calcio/entrambi): selettore sul badge; cambia il target del solo giorno.
- Barra di navigazione in basso: Oggi, Cibi, "+" centrale, Statistiche, Profilo.

### Aggiungi pasto
- Barra in alto: indietro, titolo "Aggiungi a {pasto}". Scelta del pasto a 4 segmenti (default: in base all'ora).
- Ricerca testuale + pulsante barcode. Schede: Recenti, Preferiti, I miei cibi, Ricette.
- Elenco con nome, fonte (I miei cibi / Open Food Facts / Ricetta) e kcal per 100 g.
- Pannello inferiore alla selezione: grammi con − / + a passi di 10 g e campo numerico, anteprima kcal e macro in tempo reale, pulsante "Aggiungi a {pasto}". Se il cibo ha porzioni casalinghe (step 14), chip "1 uovo medio (50 g)": scelta la porzione compare un contatore − / + a passi di ½ e la quantità si calcola da sola; scrivere a mano o usare − / + da 10 deseleziona la porzione. Senza porzioni, se il cibo ha `serving_g`, scorciatoia "1 porzione". Per i liquidi l'etichetta è "Millilitri" e l'unità "ml".
- Il pulsante fa un'unica azione e torna a Oggi. Annulla possibile con un avviso "Aggiunto · Annulla" per alcuni secondi.
- Scheda "Catalogo" (step 16): ingredienti divisi per categoria con kcal per 100 g/ml; durante una ricerca le voci del catalogo compaiono sotto i propri cibi in "Dal catalogo". Una nota spiega da dove vengono i valori e che la voce si copia tra i propri cibi.

### Cibi
Elenco dei cibi e delle ricette con ricerca. "Nuovo cibo": nome, marca, unità (grammi o millilitri), kcal e macro per 100 g/ml (o per porzione, con conversione), porzioni casalinghe facoltative (nome + quantità), barcode opzionale. "Nuova ricetta": ingredienti con grammi, peso totale cotto, risultato per 100 g. Modifica ed eliminazione sempre disponibili (l'eliminazione non tocca lo storico).

### Scanner barcode
Fotocamera a schermo intero con riquadro di inquadratura, pulsante torcia se disponibile, annulla. Prodotto non trovato → "Non trovato su Open Food Facts. Crealo a mano" con codice già compilato. Permesso fotocamera negato → spiegazione e alternativa di ricerca testuale.

### Peso
Inserimento del peso mattutino, grafico con punti grezzi e media mobile, distanza dal peso obiettivo del profilo, pendenza in kg/settimana. Nota fissa: "Conta la tendenza, non la singola pesata".

### Statistiche
Selettore Settimana/Mese con intervallo date. Tre numeri chiave (media giornaliera, giorni rispettati, peso in kg/settimana), grafico a barre calorie contro linea del target (verde = rispettato, arancio = sotto), grafico peso 4 settimane con traguardo, distribuzione calorie per pasto, cibi più frequenti. Periodo senza dati: stato vuoto, non grafici a zero.

### Profilo
Dati personali (sesso, data di nascita, altezza), parametri (fattore attività, surplus, bonus allenamento, peso obiettivo, g/kg proteine e grassi), proposta di ricalibrazione (accetta/rifiuta con spiegazione dei numeri), Acqua (obiettivo facoltativo in litri, elenco dei propri contenitori con elimina), esci. Ogni parametro ha una nota breve che spiega cosa cambia.

### Login
Email e password (ADR-028; il codice OTP di ADR-014 è rinviato allo step 12):
- Campo email (`type="email"`, `autocomplete="username"`) e campo password (`autocomplete="current-password"`), così il Portachiavi iCloud propone e salva l'accesso. Pulsante "Mostra/Nascondi" la password (≥ 44 px, con `aria-label`). Pulsante "Accedi".
- Errore unico "Email o password non corretti." (non dice quale dei due è sbagliato). Dopo un errore i campi restano compilati.
- Nessun "password dimenticata" in app: si reimposta dal pannello di Supabase.

## Stati comuni
Caricamento = scheletro con la stessa forma del contenuto. Errore = messaggio + "Riprova". Vuoto = frase + azione. Offline = banner "Serve la connessione".

## Icone e logo
Icone a tratto (stroke 2, angoli arrotondati), stile uniforme. Icona dell'app: forma semplice su fondo `--green`, senza testo; 192, 512 (anche maskable) e 180 px per iOS.
