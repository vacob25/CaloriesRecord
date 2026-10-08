# Regole di dominio

Tutte le formule vivono in `src/lib/`. Costanti con nome in un solo file (`lib/constants.ts`), mai numeri magici sparsi. I valori sono stime: l'app deve dirlo (tooltip o nota) e correggerli con i dati reali.

## 1. BMR (Mifflin-St Jeor)
```
BMR = 10 · peso_kg + 6,25 · altezza_cm − 5 · età + 5      (uomo)
BMR = 10 · peso_kg + 6,25 · altezza_cm − 5 · età − 161    (donna)
```
Peso usato: la media mobile attuale (sezione 4), non l'ultima pesata. L'età si calcola dalla data di nascita al giorno considerato.

## 2. Mantenimento e target del giorno
```
mantenimento = BMR · activity_factor            (default 1,60)
target_base  = mantenimento · (1 + surplus_pct) (default +10%)
target_giorno = target_base + (training_type ≠ rest ? training_bonus_kcal : 0)
```
- Arrotondare il target al multiplo di 10 kcal più vicino.
- `activity_factor` 1,60 = circa 6 sedute di allenamento a settimana, ad esempio 3 di palestra + 3 di sport di squadra (valore di partenza, poi corretto dalla ricalibrazione).
- `training_type`: `rest`, `gym`, `football`, `both`. Il bonus è uno solo (non si somma) per non gonfiare il target nei giorni doppi.
- Tetto di sicurezza di interfaccia: avviso (non blocco) se `surplus_pct` > 20% o se il ritmo stimato supera +0,5 kg/settimana.

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
`0,95 · target ≤ kcal_mangiate ≤ 1,10 · target` (soglie modificabili). Un giorno senza nessuna voce non è "sotto target": è "non registrato" e va escluso dalle medie e dai conteggi.

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
- Se la pendenza in kg/settimana è tra **+0,20 e +0,40**: nessuna proposta (si è nel ritmo voluto).
- Altrimenti: `mantenimento_proposto = clamp(mantenimento_stimato, attuale · 0,95, attuale · 1,05)`, arrotondato a 10 kcal. Il target nuovo si ricava come sempre: `mantenimento_proposto · (1 + surplus_pct)` (+ bonus allenamento nei giorni di allenamento). Al massimo una proposta a settimana.
- Se il peso scende o resta fermo con target e registrazione costanti, la proposta alza il mantenimento (entro il +5%). Se la pendenza supera +0,50 kg/settimana, lo abbassa e avvisa che l'eccesso è soprattutto grasso.
- **Accettare** una proposta imposta `activity_factor = mantenimento_proposto / BMR_attuale` (3 decimali), così il BMR continua a seguire il peso che sale. **Rifiutare** non cambia nulla. Le righe di `daily_targets` già create non si toccano; vale dal giorno successivo.

Limiti da dichiarare all'utente: 7700 kcal/kg è una semplificazione (l'aumento di massa magra costa meno del grasso, quindi la stima del mantenimento può risultare leggermente bassa); l'acqua, il sale e i carboidrati spostano il peso di 1-2 kg in pochi giorni; se registri male le calorie, la stima è sbagliata. La ricalibrazione vale quanto i dati che inserisci.

**Esempio 1:** I = 3200, pendenza +0,25 kg/sett. (0,0357 kg/giorno) → surplus reale 275 → mantenimento stimato 2925 → pendenza in banda → nessuna proposta.

**Esempio 2:** I = 3200, pendenza +0,10 kg/sett. (0,01429 kg/giorno) → surplus reale 110 → mantenimento stimato 3090. Mantenimento attuale 2848 (profilo di esempio): il tetto +5% è 2990,4, quindi `mantenimento_proposto` = **2990** (non 3090). Target nuovo (riposo) = 2990 · 1,10 = 3289 → **3290 kcal**.

## 8. Statistiche (definizioni)
- **Media giornaliera**: media kcal dei soli giorni registrati nel periodo.
- **Giorni rispettati**: n giorni "rispettati" / n giorni registrati.
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
