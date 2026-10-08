# Strategia di test

## Principio
Le funzioni di `src/lib/` sono pure e si testano con Vitest, file `*.test.ts` accanto al sorgente. Ogni funzione di dominio ha test prima di essere usata da un componente. Ci sono test unitari anche fuori da `lib/`: in `src/data/` (`env`, `authErrors`, `dbErrors` e i dati del catalogo `catalog/ingredienti.test.ts`) e in `src/app/` (`navItems`). La UI non ha test di componenti: si prova sull'iPhone a ogni step.

Prove end-to-end: si fanno a mano con Playwright contro Postgres + PostgREST locali; gli script non sono nel repo.

Comandi: `npm run test` (una volta), `npm run test:watch` mentre sviluppi. Uno step non è finito se `typecheck`, `lint`, `test` e `build` non passano tutti.

## Casi con valori attesi (da copiare nei test)
Tutti i casi usano il **profilo di esempio fittizio** di `DOMAIN_RULES.md` (uomo, 75 kg, 180 cm, 20 anni). Mai dati reali dell'utente nei test.

Tolleranza per i decimali: `toBeCloseTo(valore, 2)`.

### nutrition.ts
| Funzione | Input | Atteso |
| --- | --- | --- |
| `bmr` (uomo) | 75 kg, 180 cm, 20 anni | 1780 |
| `bmr` (donna) | 60 kg, 165 cm, 30 anni | 1320,25 |
| `maintenance` | bmr 1780, fattore 1,6 | 2848 |
| `dayTarget` | mantenimento 2848, surplus 0,10, `rest`, bonus 200 | 3130 |
| `dayTarget` | stesso, `football` | 3330 |
| `dayTarget` | stesso, `both` | 3330 (il bonus non si somma) |
| `macros` | 3130 kcal, 75 kg, 2,0 g/kg P, 1,0 g/kg F | P 150, F 75, C 464 |
| `macros` | 3330 kcal, stessi parametri | P 150, F 75, C 514 |
| `macros` | 2000 kcal, 75 kg, stessi parametri | P 150, F 75, C 181 (2,4 g/kg, quindi avviso carboidrati < 3 g/kg) |
| `kcalOf(food, grams)` | 110 kcal/100 g, 200 g | 220 |

Verifica di coerenza: per ogni `macros`, `4·P + 4·C + 9·F` deve essere entro ±5 kcal dal target.

Controllo del caso donna: 10·60 + 6,25·165 − 5·30 − 161 = 600 + 1031,25 − 150 − 161 = 1320,25.

### weight.ts
| Funzione | Input | Atteso |
| --- | --- | --- |
| `movingAverage7` | [75,0; 75,2; 75,1; 75,4; 75,3; 75,5; 75,6] | 75,3 |
| `movingAverage7` | solo 3 pesate nella finestra | `null` (servono almeno 4) |
| `slopeKgPerWeek` | 28 giorni, peso = 75 + 0,25/7 · giorno | 0,25 |
| `slopeKgPerWeek` | meno di 10 pesate in 28 giorni | `null` |
| `slopeKgPerWeek` | giorni mancanti sparsi ma ≥ 10 pesate | usa le date reali, non l'indice |

### recalibration.ts
Contesto comune: 28 giorni, ≥ 80% giorni registrati, ≥ 10 pesate, mantenimento attuale 2848, surplus 0,10, intake medio 3200.

| Pendenza (kg/sett.) | Mantenimento stimato | Esito atteso |
| --- | --- | --- |
| +0,25 | 2925 | nessuna proposta (in banda 0,20-0,40) |
| +0,10 | 3090 | mantenimento proposto 2990 (tetto +5%: 2990,4), target riposo 3290 |
| +0,60 | 2540 | mantenimento proposto 2710 (tetto −5%: 2705,6), target riposo 2980 |
| qualunque | — | con < 21 giorni di dati, < 80% giorni registrati o < 10 pesate: stato `none` |

Altri casi: un giorno con kcal < 50% del target non conta come registrato; la proposta non si genera due volte nella stessa settimana; accettare imposta `activity_factor = proposto / BMR_attuale`.

### dates.ts
| Caso | Atteso |
| --- | --- |
| `localDate(new Date('2026-10-07T22:30:00Z'))` in Europe/Rome (UTC+2, ora legale) | `'2026-10-08'` |
| `localDate(new Date('2026-12-07T23:30:00Z'))` (UTC+1, ora solare) | `'2026-12-08'` |
| `weekRange('2026-10-07')` (mercoledì) | lunedì `2026-10-05`, domenica `2026-10-11` |
| Cambio ora legale (ultima domenica di ottobre 2026) | il giorno ha 25 ore ma resta un solo giorno; nessun doppione o buco |

### stats.ts
| Caso | Atteso |
| --- | --- |
| Giorno con 0 voci | escluso da media e conteggi ("non registrato") |
| 7 giorni: 5 dentro −5/+10%, 1 sotto, 1 non registrato | rispettati 5 su 6 |
| Cibo cancellato (`food_id` null) | raggruppato per `food_name` |
| Settimana in corso (5-11/10/2026, oggi 8/10), +0,1 kg al giorno | peso misurato fino a oggi: 0,70 kg/settimana |
| Periodo già concluso | il giorno di oggi non cambia il risultato |

### targets.ts
| Funzione | Input | Atteso |
| --- | --- | --- |
| `computeDayTarget` | profilo di esempio, riposo | mantenimento 2848 (intero), target 3130, macro 150/75/464 |
| `estimatedGainKgPerWeek` | 2848, fattore 1,6 → 1,6, surplus 0,10 | ≈ 0,2589 kg/settimana |
| `estimatedGainKgPerWeek` | 2848, fattore 1,6 → 1,8, surplus 0,20 | ≈ 0,5825 (2848 / 1,6 · 1,8 = 3204; oltre l'avviso) |

### portions.ts
| Caso | Atteso |
| --- | --- |
| `portionAmount`: 2 × uovo medio da 50 g; ½ × banana da 120 g | 100 g; 60 g |
| `stepCount`: 1 +½; 1 −½; ½ −½ | 1,5; 0,5; 0,5 (mai sotto ½) |
| `formatCount` 0,5 / 1 / 1,5 / 2 | ½ / 1 / 1½ / 2 |
| Porzione da 0,04 | si arrotonda a 0: rifiutata nel modulo e scartata se letta dal database |

### water.ts
| Caso | Atteso |
| --- | --- |
| Contenitori rapidi | 200, 500, 1500 ml |
| 200 + 500 + 750 ml | 1450 ml, mostrato "1,45 L" |
| Avanzamento 1450 su obiettivo 2000 / senza obiettivo | 0,725 e mancano 550 ml / nessuna barra |
| Quantità libera 0 / 5001 ml | errore |
| Obiettivo "2,5" L / vuoto / "11" | 2500 ml / nessun obiettivo / errore (massimo 10 L) |
| Obiettivo "0,0004" L | diventerebbe 0 ml: errore; "0,001" → 1 ml |

### catalog.ts
Voci fittizie, mai valori veri del catalogo.
- Macro oltre 100 g o kcal oltre 900 → voce scartata con l'errore.
- kcal incoerenti con i macro: scartata senza nota, tenuta se la nota spiega il motivo.
- Categoria fuori elenco, numeri come stringhe, campi in più, fonte vuota → scartata.
- Id o nome ripetuti tra più parti → scartati; parte malformata segnalata.
- Conversione in cibo: unità, valori per 100 e porzioni copiati.

### openFoodFacts.ts
- Porzione in ml (`serving_quantity_unit: "ml"`, 250) → cibo con unità `ml` e porzione 250.
- Unità della porzione sconosciuta (es. "pezzi") → grammi, senza porzione.

### validazione (zod)
- grammi 0 o negativi → errore; 5001 g → errore.
- Arrotondamento prima del controllo: 0,04 g → errore (diventerebbe 0); 0,05 g → 0,1; 5000,04 → 5000.
- Peso cotto di una ricetta: 6500 g ammesso (ADR-031); 0,04 → errore; 1000000 → errore (oltre `numeric(8,1)`, `COOKED_WEIGHT_MAX_G`).
- Cibo con proteine 60 + carboidrati 60 + grassi 10 per 100 g (> 100) → errore.
- kcal dichiarate 400 ma macro che ne danno 800 → avviso, non errore.
- Peso 29,9 o 250,1 → errore; salto > 2 kg dal giorno prima → richiesta di conferma.

## Test sulla sicurezza dei dati (a mano, allo step 3 e a ogni nuova tabella)
Vedi `docs/SECURITY.md`, sezione "Verifica RLS con due utenti".

## Cosa NON testare
Il layout e i colori (si guardano), le librerie di terze parti (Recharts, supabase-js), le risposte reali di Open Food Facts (si testa solo la funzione che converte una risposta d'esempio salvata come fixture).
