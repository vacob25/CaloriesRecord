# Strategia di test

## Principio
Le funzioni di `src/lib/` sono pure e si testano con Vitest, file `*.test.ts` accanto al sorgente. Ogni funzione di dominio ha test prima di essere usata da un componente. Ci sono test unitari anche fuori da `lib/`: in `src/data/` (`env`, `authErrors`, `dbErrors`, `ids` e i dati del catalogo `catalog/ingredienti.test.ts`) e in `src/app/` (`navItems`). La UI non ha test di componenti: si prova sull'iPhone a ogni step.

Prove end-to-end: Playwright in `tests/e2e/` contro Postgres + PostgREST (vedi la sezione "Test end-to-end e CI").

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
| `dayTarget` | mantenimento 2848, surplus 0,10, calorie di allenamento 0 (giorno di riposo) | 3130 |
| `dayTarget` | stesso, +200 kcal di allenamento | 3330 |
| `dayTarget` | stesso, +731 kcal (Palestra 281 + Calcio 450: gli sport si sommano, ADR-075) | 3860 |
| `macros` | 3130 kcal, 75 kg, 2,0 g/kg P, 1,0 g/kg F | P 150, F 75, C 464 |
| `macros` | 3330 kcal, stessi parametri | P 150, F 75, C 514 |
| `macros` | 2000 kcal, 75 kg, stessi parametri | P 150, F 75, C 181 (2,4 g/kg, quindi avviso carboidrati < 3 g/kg) |

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
| `plannedRateKgWeek` | massa, mantenimento 2848, 75 kg, surplus 0,10 | ≈ 0,2589 kg/settimana |
| `plannedRateKgWeek` | massa, mantenimento 3204, surplus 0,20 | ≈ 0,5825 (oltre l'avviso del +0,5) |

### goals.ts, sports.ts, tutorial.ts (step 19)
| Funzione | Input | Atteso |
| --- | --- | --- |
| `cutDeficitKcal` | 75 kg, 0,5% | 412,5 |
| `restDayTargetKcal` | 2848, cut 0,5%, 75 kg | 2440 |
| `rateBandKgWeek` | cut, 75 kg | da −0,75 a −0,375 |
| `weeksToGoal` | 75 → 70 kg, 0,5% | ceil(ln(70/75)/ln(0,995)) = 14 |
| `planWarnings` | cut 1,2% | avviso ritmo; cut under 18 → nota medica |
| `addSport` / `cleanName` (`lib/text.ts`) | duplicati con accenti/maiuscole, > 24 caratteri, quinto sport (il massimo è 4, ADR-073) | rifiutati |
| `toggleSportInType` | rest → 0 → 2 → 1 → 0 | `sport_1`, `sport_1+sport_3`, `sport_1+sport_2+sport_3`, `sport_2+sport_3` |
| `trainingLabel` | `sport_1+sport_2+sport_4` con 4 sport | Palestra + calcio + CrossFit (le sigle restano) |
| `trainingSportIndexes` | `sport_1+sport_3`, `sport_3+sport_1`, `gym`, `sport_1+x`; il vecchio `both` (righe anteriori alla migrazione 008) | [0,2], [0,2], [], []; [0,1] |
| `coerceTrainingType` | `sport_1+sport_2` con un solo sport / `sport_2` con uno | `sport_1` / `rest` |
| `nextStep` / `previousStep` / `tourLabel` | indici 0-7 | ferma agli estremi; "1/8"…"8/8" |

### mealSlots.ts, viewDay.ts (step 20)
| Funzione | Input | Atteso |
| --- | --- | --- |
| `mealForHour` | ore 0…23, pasti di partenza | come prima (5 → breakfast, 10 → morning_snack, 12 → lunch, 18 → dinner, 15/23/0 → snack) |
| `mealForHour` | 11 senza `morning_snack` | breakfast (fascia precedente) |
| `validateMealName` | `PRANZO` con Pranzo esistente | rifiutato (doppione); `pranzo` rinominando `lunch` ammesso |
| `validateMealName` | 21 caratteri / vuoto | rifiutato; 20 ok |
| `moveSlot` | `lunch` su / giù, ai bordi | scambia di una posizione; ai bordi non cambia |
| `newSlotKey` | random 0 / 0,99 | `custom_00000000` / `custom_ffffffff` |
| `viewedDay` | oggi 2026-10-11 | 10-10 e 09-27 validi; 09-26, 10-12, `2026-02-30`, testo → oggi |
| `previousViewedDay` / `nextViewedDay` | limite 14 / oggi | null oltre il limite / a oggi |
| `dayTitle` | oggi, ieri, 2 e 5 giorni fa | Oggi, Ieri, L’altro ieri, 5 giorni fa |
| `dragTargetIndex` / `reorderByDrag` | spostamento di mezza riga / elenco a,b,c,d | arrotonda alla riga più vicina e resta nell'elenco; 0→2: b,c,a,d |
| catalogo piatti | tutte le voci con gli ingredienti | nessun errore, id e nomi unici; pasta al pomodoro ricalcolata a mano (±1 kcal) |

### numbers.ts · sanitizeNumberInput (step 23)
| Input | Atteso |
| --- | --- |
| `75,5` / `75.5` decimale | invariati |
| `7a5,5kg` / ` 1 2,3,4.5 ` / `-5` / `abc` decimale | `75,5` / `12,345` / `5` / vuoto |
| `250 ml` / `1,5` intero | `250` / `15` |

### sportEnergy.ts (step 22)
| Funzione | Input | Atteso |
| --- | --- | --- |
| `sessionKcal` | 75 kg: Tennis, Corsa, Calcio, Palestra | 525, 495, 450, 281 kcal ((MET − 1) · kg · ore) |
| `sessionKcal` | 60 kg di Calcio | 360 |
| `sportEnergyFor` | Calcio a 5, Calcetto, Running, Sala pesi | riconosciuti; Padel, Tennis tavolo, Nuoto, CrossFit no |
| `trainingBonus` | `sport_1+sport_2` (Palestra, Calcio) a 75 kg | 731 (si somma) |
| `trainingBonus` | sport fuori tabella, riserva 150 | 150, segnato non stimato |
| `withTrainingType` | 2848, +10%, `sport_1+sport_2` | 3860 (3132,8 + 281 + 450); solo Calcio 3580 |

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

### Accesso e tester (step 18)
- `parseNewPassword`: 7 caratteri → errore, 8 → ok; 72 byte ok, 73 no; "è" conta 2 byte (36 sì, 37 no).
- `validateSignup`: senza consenso → errore e nessuna richiesta; email normalizzata; consenso con `privacy_version`, data ISO e `health_data_consent: true`.
- `clearUserStorage`: toglie `sb-…`, `off.…`, `caloriesrecord.…`, lascia il resto.
- `describeAuthError`: rifiuto della hook (403 con "invito", oppure errore generico della hook) → "Registrazione solo su invito…"; `signup_disabled`, `user_already_exists`, `weak_password`; errore sconosciuto con il codice tecnico.
- `exportData`: l'elenco `EXPORT_TABLES` coincide con le tabelle create nelle migrazioni (tranne `allowed_emails`, dichiarata); conferma eliminazione solo con "ELIMINA".
- `readPrivacyContact`: assente o vuoto → null.

## Test end-to-end e CI (step 25, ADR-078)
- `tests/e2e/*.e2e.ts` (Playwright): un file per step o correzione, con l'app vera (build di produzione) contro un Supabase simulato (Postgres con tutte le migrazioni, PostgREST, autenticazione finta in `tests/e2e/support/harness.ts`). Ogni test parte da un database pulito. Istruzioni in `tests/e2e/README.md`.
- `tests/e2e/accessibilita.e2e.ts`: axe-core (WCAG 2.1 A/AA) e aree toccabili ≥ 44 px su tutte le schermate; fallisce se trova violazioni.
- `tests/e2e/step30-pannelli-accessibili.e2e.ts` (ADR-084): focus del pannello, Tab, Esc, scorrimento; pannelli su schermo basso; anello di focus verde; "Annulla" che aspetta con il focus; campi del login segnati solo quando sono sbagliati; grafici che seguono il token cambiato al volo. Tutti e sei falliscono sul codice precedente.
- Privacy e sicurezza (ADR-082): `lib/privacyData.test.ts` (la pagina descrive tutte le tabelle esportate) e `app/securityHeaders.test.ts` (`vercel.json` ha gli header anti-clickjacking). `rls_two_users.sql` controlla le funzioni dei trigger.
- `tests/e2e/step10-ricalibrazione.e2e.ts`: anche la riga "nessuna" di inizio settimana che diventa proposta (ADR-081, #11); l'attesa del +5% è "multiplo di 10 sotto il tetto".
- `tests/e2e/step27-sposta-su-giu.e2e.ts` (ADR-080): riordino dei pasti con i pulsanti "Sposta su/giù" da tastiera, focus che resta, annuncio a voce, pulsante ≥ 44 px con il focus.
- `tests/e2e/step26-salvataggi-rete.e2e.ts` (ADR-079): risposta persa + "Riprova" = una sola voce; salvataggio senza rete (banner, poi parte da solo); "Esci" con il logout che fallisce; schermata che non si carica; ricaricamento del profilo fallito in background (orologio simulato). Ogni test fallisce sul codice precedente alla PR, tranne "Esci", che resta come protezione.
- CI (`.github/workflows/ci.yml`) su ogni PR e su `main`: typecheck, lint, test unitari, build e test end-to-end. Nessun segreto e nessun accesso al progetto reale.
- Ogni nuova funzione che si vede nell'app porta il suo test end-to-end nella stessa PR; ogni nuova migrazione entra da sola nel database dei test.

## Test sulla sicurezza dei dati (a ogni nuova tabella o funzione)
Vedi `docs/SECURITY.md`, sezione "Verifica RLS con due utenti", e `supabase/checks/no_session.sh` (curl senza sessione).

## Cosa NON testare
Il layout e i colori (si guardano), le librerie di terze parti (Recharts, supabase-js), le risposte reali di Open Food Facts (si testa solo la funzione che converte una risposta d'esempio salvata come fixture).
