# Prompt per un'altra chat: catalogo di ingredienti mediterranei (step 16)

Copia tutto il testo dentro il riquadro in una chat di Claude **con la ricerca web attiva**. Quando hai tutte le parti, incolla il JSON completo nella chat di sviluppo: l'app lo controlla (zod + regole §9) prima di importarlo.

```text
Ti chiedo un catalogo di ALIMENTI SEMPLICI tipici della dieta mediterranea, da importare in un'app personale che conta calorie e macro. Precisione prima di tutto: ogni valore deve venire da una fonte che puoi citare.

COSA INCLUDERE
- Solo ingredienti singoli, NON piatti composti (no "pasta al sugo", no "lasagne", no "insalata mista").
- Elenco lungo: almeno 180 voci, divise in queste categorie:
  cereali e derivati (pasta di semola, pasta integrale, riso, riso integrale, farro, orzo, avena in fiocchi, couscous, bulgur, pane comune, pane integrale, fette biscottate, farina 00 e integrale, gallette di riso…),
  legumi (secchi e lessati/in scatola sgocciolati: ceci, fagioli borlotti e cannellini, lenticchie, piselli, fave, soia, edamame…),
  verdure e ortaggi (pomodoro, zucchina, melanzana, peperone, spinaci, broccoli, carciofo, cavolfiore, carota, cipolla, aglio, lattuga, rucola, finocchio, patata, patata dolce, funghi…),
  frutta (mela, pera, arancia, mandarino, banana, kiwi, fragole, uva, pesca, albicocca, fichi, anguria, melone, limone, frutti di bosco…),
  frutta secca e semi (mandorle, noci, nocciole, pistacchi, anacardi, pinoli, semi di zucca, semi di girasole, semi di chia, semi di lino, burro di arachidi 100%…),
  pesce e frutti di mare (merluzzo, nasello, orata, branzino, salmone, tonno fresco, tonno al naturale sgocciolato, sgombro, alici, sardine, gamberi, calamari, polpo, cozze, vongole…),
  carne (petto di pollo, coscia di pollo senza pelle, tacchino, manzo magro, macinato di manzo con % di grassi indicata, vitello, maiale lonza, coniglio, prosciutto crudo sgrassato, prosciutto cotto, bresaola…),
  uova (uovo intero, albume, tuorlo),
  latte, latticini e formaggi (latte intero, parzialmente scremato, scremato, yogurt bianco intero, yogurt greco 0% e 2%, ricotta vaccina, mozzarella, fiocchi di latte, parmigiano reggiano, grana padano, pecorino, feta…),
  grassi e condimenti (olio extravergine di oliva, olio di semi, burro, aceto, olive verdi e nere…),
  bevande semplici (acqua, caffè espresso senza zucchero, tè senza zucchero, latte vegetale di soia e di avena senza zuccheri aggiunti…),
  dolcificanti di base (zucchero, miele, cioccolato fondente 70% e 85%).
- Per gli alimenti che si mangiano sia crudi che cotti e cambiano molto peso (pasta, riso, legumi secchi, carne, pesce, patate) fai DUE voci: "crudo/secco" e "cotto/lessato", indicando nella nota come è stato cotto (es. "lessato senza sale, sgocciolato").

VALORI (per 100 g di parte edibile; per 100 ml solo per le bevande liquide)
- kcal, proteine (g), carboidrati DISPONIBILI (g, esclusa la fibra, come nelle tabelle italiane ed europee), grassi (g).
- Fonte principale: Tabelle di composizione degli alimenti del CREA (alimentinutrizione.it). Se un alimento non c'è, usa la Banca Dati di Composizione degli Alimenti per Studi Epidemiologici in Italia (BDA, IEO) oppure USDA FoodData Central (SR Legacy / Foundation): in quel caso scrivilo nella fonte.
- NON inventare e NON arrotondare a caso: riporta i valori della fonte (al massimo 1 decimale per i macro, interi per le kcal). Se un valore non lo trovi, NON mettere la voce.
- Controlli che devi fare tu su ogni voce prima di scriverla:
  1) proteine + carboidrati + grassi ≤ 100 (per 100 g);
  2) kcal ≤ 900;
  3) kcal vicine a 4·P + 4·C + 9·G (differenze sopra il 20% vanno spiegate nella nota, es. fibra o alcol).

PORZIONI CASALINGHE (facoltative ma molto utili)
- Per ogni voce, se ha senso, aggiungi 1-3 porzioni con nome e quantità in g (o ml per i liquidi): es. "1 uovo medio" = 50 (parte edibile), "1 cucchiaio" di olio = 10, "1 cucchiaino" = 4, "1 fetta" di pane = 30, "1 mela media" = 150 (parte edibile), "1 bicchiere" di latte = 200 ml, "1 tazzina" di caffè = 30 ml, "1 vasetto" di yogurt = 125.
- Quando esistono, usa le porzioni standard dei LARN (SINU) o del CREA e scrivilo nella fonte delle porzioni; altrimenti usa pesi tipici e scrivi "indicativo".

FORMATO DI USCITA (obbligatorio)
Rispondi SOLO con JSON valido in un blocco di codice, con questa struttura esatta. Se è troppo lungo, dividilo in più messaggi "PARTE 1/N", "PARTE 2/N"…: ogni parte deve essere un oggetto JSON completo con lo stesso formato (solo "items" diversi).

{
  "version": 1,
  "items": [
    {
      "id": "olio-extravergine-di-oliva",
      "name": "Olio extravergine di oliva",
      "category": "Grassi e condimenti",
      "unit": "g",
      "kcal": 899,
      "protein": 0,
      "carbs": 0,
      "fat": 99.9,
      "portions": [
        { "name": "1 cucchiaio", "amount": 10 },
        { "name": "1 cucchiaino", "amount": 4 }
      ],
      "source": "CREA, Tabelle di composizione degli alimenti, Olio di oliva extravergine",
      "portionsSource": "indicativo",
      "notes": ""
    }
  ]
}

Regole del formato:
- "id": minuscolo, parole separate da trattino, unico.
- "category": esattamente una di queste: "Cereali e derivati", "Legumi", "Verdure e ortaggi", "Frutta", "Frutta secca e semi", "Pesce e frutti di mare", "Carne", "Uova", "Latte, latticini e formaggi", "Grassi e condimenti", "Bevande", "Dolcificanti e altro".
- "unit": "g" per tutto, "ml" solo per i liquidi da bere (acqua, latte, bevande vegetali, caffè, tè). Con "ml" i valori sono per 100 ml.
- Numeri come numeri (punto decimale), mai stringhe. Niente commenti nel JSON.
- I nomi in italiano, specificando lo stato quando conta: "Riso, crudo", "Riso, lessato", "Ceci, lessati, sgocciolati".

Alla fine (fuori dal JSON, nell'ultimo messaggio) scrivi una breve nota su quali fonti hai usato e su eventuali voci incerte.
```
