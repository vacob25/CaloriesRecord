# Regole di dominio

Tutte le formule vivono in `src/lib/`. Costanti con nome in un solo file (`lib/constants.ts`), mai numeri magici sparsi. I valori sono stime: l'app deve dirlo (tooltip o nota) e correggerli con i dati reali.

## 1. BMR (Mifflin-St Jeor)
```
BMR = 10 · peso_kg + 6,25 · altezza_cm − 5 · età + 5      (uomo)
BMR = 10 · peso_kg + 6,25 · altezza_cm − 5 · età − 161    (donna)
```
Peso usato: la media mobile attuale (sezione 4) se disponibile (≥ 4 pesate in 7 giorni), altrimenti l'ultima pesata (ADR-037). L'età si calcola dalla data di nascita al giorno considerato.

## 2. Mantenimento e target del giorno
```
mantenimento = round(BMR · activity_factor)     (default 1,60; intero, ADR-052)
target_base  = mantenimento · (1 + surplus_pct) (default +10%)
target_giorno = target_base + Σ calorie degli allenamenti del giorno      (step 22, §2b)
```
- Arrotondare il mantenimento all'intero (kcal) prima di calcolare il target: `daily_targets.maintenance_kcal` è intero e il target deve potersi ricalcolare dal mantenimento salvato (ADR-052).
- Arrotondare il target al multiplo di 10 kcal più vicino.
- `activity_factor` 1,60 è il valore del **profilo di esempio** (usato in tutti i test) e il default del database: circa 6 sedute di allenamento a settimana. Chi si registra sceglie un livello: Poco attivo 1,2 · Leggero 1,375 · Medio 1,55 · Alto 1,725 (ADR-067); la ricalibrazione lo corregge. Le calorie degli sport si sommano al target (§2b) e il livello di attività può già includere gli allenamenti abituali: possibile doppio conteggio, **punto aperto** in DECISIONS (ADR-075).
- `training_type`: `rest` oppure gli sport del giorno, `sport_1`, `sport_1+sport_3`… (step 21, ADR-073; i nomi vengono dagli sport del profilo, fino a 4).
- **Calorie degli allenamenti (step 22, ADR-075), §2b:** ogni sport del giorno vale `(MET − 1) · peso_kg · ore` (il "− 1" toglie il metabolismo a riposo, già nel mantenimento); **più sport si sommano**. Tabella (`lib/sportEnergy.ts`): Tennis 8,0 MET · 60 min; Corsa 9,8 · 45 min; Calcio 7,0 · 60 min; Palestra 6,0 · 45 min. A 75 kg: Tennis 525, Corsa 495, Calcio 450, Palestra 281 kcal. Gli sport fuori tabella valgono il "Bonus per gli altri sport" del profilo (`training_bonus_kcal`, default 200). Il peso è quello del giorno. Esempio (profilo di esempio, +10%): Palestra + Calcio → 3132,8 + 281 + 450 = 3863,8 → **3860 kcal**; solo Calcio → **3580**.
- **Attenzione, doppio conteggio:** il livello di attività (1,2-1,725) descrive la settimana *compresi* gli allenamenti; sommare anche le calorie di ogni seduta conta due volte una parte. La ricalibrazione corregge (max ±5% a settimana), ma un livello di attività più basso (che descriva solo la giornata senza allenamento) dà un target di riposo più realistico.
- **Obiettivo (step 19, ADR-066):** `target_base = mantenimento + scostamento`. Massa: `mantenimento · surplus_pct`. Mantenimento: 0. Cut: `−(peso_kg · ritmo · 7700 / 7)`, ritmo = `cut_rate_pct` (0,5% / 0,7% / 1,0% del peso a settimana), peso = quello del giorno. Esempio cut (75 kg, 0,5%): deficit 412,5 → riposo 2848 − 412,5 = 2435,5 → **2440 kcal**; con bonus 200 → 2635,5 → **2640**.
- Avvisi (non blocchi): massa oltre +0,5 kg/sett.; cut oltre 1%/sett.; target di riposo sotto il BMR; cut sotto i 18 anni (nota medica). Il cut richiede un peso obiettivo sotto il peso attuale.
- Tetto di sicurezza di interfaccia: avviso (non blocco) se `surplus_pct` > 20% o se il ritmo stimato supera +0,5 kg/settimana (`GAIN_RATE_WARNING_KG_WEEK`).
- Ritmo stimato (kg/settimana, ADR-053) = `mantenimento_oggi / activity_factor_attuale · activity_factor_nuovo · surplus_pct · 7 / ENERGY_PER_KG`: surplus dei giorni di riposo, bonus escluso. Si controlla al salvataggio dei parametri. Profilo di esempio: 2848 · 0,10 · 7 / 7700 ≈ 0,26.

**Profilo di esempio, FITTIZIO, usato in tutti i test e gli esempi (uomo, 75 kg, 180 cm, 20 anni):** BMR = 750 + 1125 − 100 + 5 = 1780 → mantenimento = 2848 → target base = 3132,8 → **3130 kcal** (riposo); con bonus 200 → **3330 kcal**. I dati reali dell'utente non stanno mai nel repo: si inseriscono nell'app.

## 3. Macro del giorno
```
proteine_g = protein_g_per_kg · peso_kg            (default 2,0)
grassi_g   = fat_g_per_kg · peso_kg                (default 1,0)
carboidrati_g = (target_kcal − 4·proteine_g − 9·grassi_g) / 4
```
Ordine di calcolo: arrotonda prima proteine e grassi all'intero (`Math.round`), poi calcola i carboidrati da quei valori già arrotondati e arrotondali. Così le kcal dei macro tornano al target. Fattori 4/4/9 kcal per g. Se i carboidrati risultano < 3 g/kg, mostrare un avviso (target troppo basso per un bulk).

**Esempio a 3130 kcal, 75 kg:** proteine 150 g (600 kcal), grassi 75 g (675 kcal), carboidrati (3130 − 600 − 675)/4 = 463,75 → **464 g**. A 3330 kcal: (3330 − 1275)/4 = 513,75 → **514 g**.

Le calorie di un cibo vengono dall'etichetta (`kcal_100g`) e restano la fonte di verità. Non ricalcolarle dai macro: possono differire di qualche percento.

## 4. Peso: media mobile
- Si registra una pesata ogni mattina (`weight_logs`).
- **Media mobile 7 giorni** = media delle pesate disponibili nei 7 giorni fino alla data inclusa. Serve almeno 4 pesate nella finestra, altrimenti non c'è media (mostrare solo i punti grezzi).
- Mostrare sempre il dato grezzo (punti) e la media (linea). Il dato singolo non guida nessuna decisione.
- **Pendenza (kg/settimana):** regressione lineare dei minimi quadrati sulle pesate degli ultimi 28 giorni, moltiplicata per 7. Servono almeno 10 pesate in 28 giorni.

## 5. Giorno "rispettato"
`0,95 · target ≤ kcal_mangiate ≤ 1,10 · target` (soglie fisse nel codice: `RESPECTED_MIN_RATIO` e `RESPECTED_MAX_RATIO` in `constants.ts`; si cambiano lì). Un giorno senza nessuna voce non è "sotto target": è "non registrato" e va escluso dalle medie e dai conteggi.

## 6. Nessun recupero
Le calorie non assunte un giorno non si recuperano né si riportano. L'obiettivo è solo giornaliero. Le statistiche settimanali e mensili sono solo descrittive. Motivo: in un bulk recuperare in blocco porta a mangiate forzate e non migliora il risultato.

## 7. Ricalibrazione adattiva
Scopo: correggere la stima del mantenimento con i dati reali. Solo **proposta da confermare**, mai automatica.

Condizioni per calcolarla (altrimenti stato `none` e messaggio "servono più dati"):
1. Finestra di 28 giorni conclusi, con almeno 21 giorni dall'inizio dell'uso.
2. Almeno 80% dei giorni "registrati" (un giorno conta come registrato se ha ≥ 50% del suo target in kcal: sotto è quasi certamente un giorno dimenticato).
3. Almeno 10 pesate nella finestra.

Calcolo:
```
I      = media kcal dei giorni registrati nella finestra
slope  = pendenza peso in kg/giorno (sezione 4, già divisa per 7)
surplus_reale = slope · ENERGY_PER_KG          (ENERGY_PER_KG = 7700)
mantenimento_stimato = I − surplus_reale
```
Decisione:
- Se la pendenza in kg/settimana è dentro la **banda dell'obiettivo**: nessuna proposta. Massa **+0,20/+0,40**; mantenimento **±0,10**; cut da **−1,0% a −0,5% del peso** (peso di oggi, 3 decimali). Sotto −1% in cut si avvisa che si rischia di perdere muscolo.
- Altrimenti: `mantenimento_proposto = clamp(mantenimento_stimato, attuale · 0,95, attuale · 1,05)`, arrotondato a 10 kcal. Il target nuovo si ricava come sempre dall'obiettivo (massa: `· (1 + surplus_pct)`; cut: meno il deficit) (+ bonus allenamento nei giorni di allenamento). Al massimo una proposta a settimana.
- Se il peso scende o resta fermo con target e registrazione costanti, la proposta alza il mantenimento (entro il +5%). Se la pendenza supera +0,50 kg/settimana, lo abbassa e avvisa che l'eccesso è soprattutto grasso.
- **Accettare** una proposta imposta `activity_factor = mantenimento_proposto / BMR_attuale` (3 decimali), così il BMR continua a seguire il peso che sale. **Rifiutare** non cambia nulla. Le righe di `daily_targets` già create non si toccano; vale dal giorno successivo.

Limiti da dichiarare all'utente: 7700 kcal/kg è una semplificazione (l'aumento di massa magra costa meno del grasso, quindi la stima del mantenimento può risultare leggermente bassa); l'acqua, il sale e i carboidrati spostano il peso di 1-2 kg in pochi giorni; se registri male le calorie, la stima è sbagliata. La ricalibrazione vale quanto i dati che inserisci.

**Esempio 1:** I = 3200, pendenza +0,25 kg/sett. (0,0357 kg/giorno) → surplus reale 275 → mantenimento stimato 2925 → pendenza in banda → nessuna proposta.

**Esempio 2:** I = 3200, pendenza +0,10 kg/sett. (0,01429 kg/giorno) → surplus reale 110 → mantenimento stimato 3090. Mantenimento attuale 2848 (profilo di esempio): il tetto +5% è 2990,4, quindi `mantenimento_proposto` = **2990** (non 3090). Target nuovo (riposo) = 2990 · 1,10 = 3289 → **3290 kcal**.

## 8. Statistiche (definizioni)
- **Media giornaliera**: media kcal dei soli giorni registrati nel periodo.
- **Giorni rispettati**: n giorni "rispettati" / n giorni registrati **che hanno un target** (un giorno registrato senza target non si può valutare).
- **Peso**: variazione della media mobile tra inizio e fine periodo, in kg/settimana.
- **Cibi più frequenti**: numero di voci per `food_id` (o `food_name` se il cibo è stato cancellato), non per grammi.
- **Distribuzione pasti**: somma kcal per `meal_type` / totale kcal del periodo.
- **Macro medie**: media dei grammi nei giorni registrati.
- Settimana: lunedì-domenica, fuso Europe/Rome. Mese: mese solare.

## 9. Input e validazione
- Grammi: > 0 e ≤ 5000. Kcal/100 g: 0-900 (olio puro ~ 884). Macro/100 g: 0-100 e la somma proteine + carboidrati + grassi ≤ 100 g (tolleranza 1%).
- Se kcal dichiarate e kcal ricalcolate dai macro differiscono di oltre il 20%, avviso "valori incoerenti, controlla l'etichetta" (non blocco).
- Peso: 30-250 kg. Un salto di oltre 2 kg dal giorno prima chiede conferma.

## 10. Dati personali (decisi con l'utente l'8/10/2026, ADR-038)
- Altezza: 100-250 cm.
- Età (calcolata dalla data di nascita al giorno considerato): 14-100 anni. Sotto i 14 anni Mifflin-St Jeor non è validata.
- Peso attuale e peso obiettivo: 30-250 kg, come §9. Il peso obiettivo è facoltativo.
- Parametri del profilo: nessun limite di dominio stabilito oltre a valori > 0 (fattore di attività) e ≥ 0 (surplus, bonus, g/kg); resta l'avviso di §2 se il surplus supera il 20%.

## 11. Porzioni, liquidi e acqua (step 14-15, ADR-048, ADR-049)
- Ogni cibo ha un'unità: `g` o `ml`. Per i liquidi (`ml`) i valori sono per 100 ml, come sulle etichette: nessuna densità. Nelle ricette un ingrediente in ml conta come grammi per il peso totale.
- Porzioni casalinghe: nome + quantità nell'unità del cibo (es. "1 uovo medio", 50 g). Si scelgono a passi di ½ (`PORTION_COUNT_STEP`), mai sotto ½; quantità = porzione × numero.
- Acqua: da 1 a `WATER_ML_MAX` (5000) ml per singola aggiunta e per contenitore; obiettivo facoltativo, scritto in litri, al massimo `WATER_GOAL_MAX_L` (10 L, solo contro gli errori di battitura). L'acqua non ha calorie e sta in una tabella sua (`water_entries`), fuori dal diario dei pasti.
