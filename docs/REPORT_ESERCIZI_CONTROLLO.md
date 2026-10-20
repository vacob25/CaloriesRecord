# Controllo incrociato del catalogo esercizi (Fase 3)

Controllo su 40 esercizi a campione (estrazione casuale con seme fisso 19102026) tra quelli importati che hanno un nome identico in wger. wger è stato usato solo per verificare: i suoi dati stanno fuori dal repo e dal database (licenza CC-BY-SA 3.0, ADR-089); qui resta solo "concorda / non concorda" per esercizio. Niente scraping di ExRx.

Limiti: wger non ha i gruppi avambracci, adduttori, abduttori, collo e schiena alta (questi casi risultano "non confrontabile"), e per alcuni esercizi non indica muscoli o attrezzi ("wger senza dato"). I restanti ~680 esercizi non sono stati controllati uno per uno: la qualità del resto del catalogo è quella della fonte.

Catalogo importato: 718 | wger (en): 872 | abbinati per nome univoco: 71 | ambigui (esclusi): 11
Muscoli: wger senza dato 4, non confrontabile 3, concorda 28, non concorda 5
Attrezzo: wger senza dato 12, concorda 19, non confrontabile 7, non concorda 2

| Esercizio (fonte) | Muscoli | Attrezzo |
|---|---|---|
| Band Pull Apart | wger senza dato | wger senza dato |
| Barbell Ab Rollout | concorda | concorda |
| Barbell Hip Thrust | concorda | concorda |
| Butterfly | concorda | non confrontabile |
| Cable Wrist Curl | non confrontabile | wger senza dato |
| Clean | non concorda | concorda |
| Concentration Curls | concorda | concorda |
| Crunches | concorda | concorda |
| Decline Dumbbell Bench Press | concorda | concorda |
| Deficit Deadlift | wger senza dato | concorda |
| Dumbbell Bench Press | concorda | concorda |
| Dumbbell Bicep Curl | concorda | concorda |
| Dumbbell Incline Row | non confrontabile | concorda |
| Dumbbell Scaption | non concorda | concorda |
| Dumbbell Side Bend | concorda | concorda |
| External Rotation with Cable | concorda | wger senza dato |
| Flutter Kicks | non concorda | concorda |
| Front Cable Raise | concorda | wger senza dato |
| Incline Cable Chest Press | concorda | wger senza dato |
| Inverted Row | non confrontabile | non confrontabile |
| Isometric Wipers | concorda | concorda |
| Overhead Squat | wger senza dato | wger senza dato |
| Pallof Press | concorda | wger senza dato |
| Power Clean | non concorda | concorda |
| Preacher Curl | concorda | non concorda |
| Reverse Crunch | concorda | concorda |
| Reverse Hyperextension | concorda | non confrontabile |
| Russian Twist | concorda | non concorda |
| Seated Dumbbell Curl | concorda | concorda |
| Shotgun Row | concorda | wger senza dato |
| Single Leg Glute Bridge | concorda | concorda |
| Single-Leg Leg Extension | concorda | non confrontabile |
| Smith Machine Close-Grip Bench Press | concorda | non confrontabile |
| Spider Curl | concorda | non confrontabile |
| Standing Calf Raises | concorda | non confrontabile |
| Sumo Deadlift | non concorda | wger senza dato |
| Triceps Pushdown | concorda | wger senza dato |
| V-Bar Pulldown | wger senza dato | wger senza dato |
| Wide-Grip Lat Pulldown | concorda | wger senza dato |
| Zottman Curl | concorda | concorda |

Disaccordi sui muscoli (dato presente in entrambe le fonti):

- Dumbbell Scaption: A: ['shoulders'] | wger: ['Trapezius']
- Power Clean: A: ['hamstrings'] | wger: ['Chest']
- Clean: A: ['hamstrings'] | wger: ['Glutes', 'Quads']
- Sumo Deadlift: A: ['hamstrings'] | wger: ['Quads']
- Flutter Kicks: A: ['glutes'] | wger: ['Abs', 'Obliquus externus abdominis']

Disaccordi sull'attrezzo:

- Preacher Curl: A: barbell | wger: ['SZ-Bar']
- Russian Twist: A: body only | wger: ['Dumbbell', 'Gym mat', 'Swiss Ball']

---

## Decisioni (20/10/2026)

Terza fonte usata: **letteratura scientifica peer-reviewed (studi EMG e di biomeccanica su PubMed/PMC e riviste di scienze motorie)** per i muscoli. Per l'attrezzo non esiste una "verità" scientifica: conta come l'esercizio si esegue di norma, quindi ho usato le schede di organizzazioni certificatrici (NASM) e librerie di esercizi di uso comune. Dove gli studi non misurano un muscolo, ho usato il consenso di fonti di allenatori certificati (NSCA/ACE) e l'ho segnato come tale.

Convenzione: nei muscoli il primo è il principale, gli altri sono secondari. Per i movimenti composti questa distinzione è una convenzione, non un fatto misurato.

| Esercizio | Campo | Fonte (free-exercise-db) | wger | Decisione | Fiducia |
|---|---|---|---|---|---|
| Power Clean | Muscoli | femorali | petto | glutei, femorali, quadricipiti, trapezi | Alta sull'insieme, media sull'ordine |
| Clean | Muscoli | femorali | glutei, quadricipiti | glutei, femorali, quadricipiti, trapezi | Alta sull'insieme, media sull'ordine |
| Sumo Deadlift | Muscoli | femorali | quadricipiti | quadricipiti, glutei, adduttori, femorali | Alta sull'insieme, bassa sull'ordine |
| Dumbbell Scaption | Muscoli | spalle | trapezi | spalle | Alta |
| Flutter Kicks | Muscoli | glutei | addominali | addominali (secondario: flessori dell'anca) | Medio-alta |
| Preacher Curl | Attrezzo | bilanciere | bilanciere EZ | bilanciere EZ (se esiste nello schema, altrimenti bilanciere) | Media |
| Russian Twist | Attrezzo | corpo libero | manubri/palla | corpo libero | Alta |

### Motivazioni

**Power Clean.** wger ("petto") è sbagliata: nessuna fonte lo supporta. La fonte (solo femorali) è incompleta, non sbagliata. Lo studio EMG di Dryburgh e Psycharakis (2016) conferma attivazione di vasto laterale, erettori spinali, gastrocnemio e trapezio, ma non misura glutei e femorali: per quelli conta il consenso delle fonti tecniche, che li mettono tutte in testa (catena posteriore).

**Clean.** Stesso insieme del Power Clean: la differenza tra i due è solo la profondità della ricezione, non i muscoli coinvolti. La proposta precedente ometteva i trapezi nel Clean ma li metteva nel Power Clean: era un'incoerenza, corretta.

**Sumo Deadlift.** Qui la fonte e wger hanno entrambe ragione a metà: il sumo usa tutti e quattro i gruppi. Escamilla et al. (Med Sci Sports Exerc, 2000) trovano nel sumo un'attività maggiore di vasto mediale e laterale rispetto allo stacco convenzionale, con adduttori e gluteo massimo molto attivi. Uno studio del 2025 (Hanen et al., Frontiers) trova il bicipite femorale più attivo nel convenzionale. Quindi "solo femorali" è la scelta peggiore per il sumo. Attenzione però: i confronti sono sumo contro convenzionale, non misure assolute, e le fonti divergono su chi domini tra quadricipiti e glutei. L'ordine nella tabella è una scelta ragionevole, non dimostrata.

**Dumbbell Scaption.** Il movimento è un'abduzione nel piano scapolare: lavorano deltoide (soprattutto il medio) e sovraspinato; il trapezio interviene come stabilizzatore (studi EMG: PMC6878867, Hoshikawa et al. 2021). Le schede di allenatori lo danno come secondario. "Spalle" è corretto, wger no.

**Flutter Kicks.** Nessuna fonte consultata mette i glutei come muscolo principale. Le schede indicano retto dell'addome e flessori dell'anca. Un'osservazione più utile della semplice correzione: l'idea che questi esercizi lavorino "gli addominali bassi" è debole. Lo studio EMG del 1993 (J Athl Train) non trova differenze tra i quadranti del retto dell'addome nel leg raise, e una ricerca del 2023 (Gomirato e Grenier, IJES) mostra una maggiore attivazione del retto nel crunch che nel leg raise. Il leg raise sposta molto lavoro sui flessori dell'anca. Per questo: addominali come principale ma flessori dell'anca come secondario, se il catalogo li prevede.

**Preacher Curl (attrezzo).** Sono in disaccordo con la proposta precedente di lasciare "bilanciere". Le librerie consultate (Muscle & Strength, Liftosaur, Gymkee) lo descrivono con la barra EZ come attrezzo standard; una barra dritta si può usare ma è la variante. Il tuo dubbio "dipende da come si fa" ha una risposta: di norma si fa con la EZ. Se nello schema non esiste la voce EZ, lascia bilanciere.

**Russian Twist (attrezzo).** Confermo corpo libero. Le fonti (NASM, WebMD, Major Fitness) lo presentano come esercizio senza attrezzi, con manubrio, disco o palla medica come progressione. L'elenco di wger descrive le varianti, non l'attrezzo base.

### Limiti di questa verifica

- Non ho avuto accesso ai testi NSCA o ai manuali di anatomia: dove cito "fonti di allenatori certificati" sono articoli online, non il testo ufficiale. Dato che non è una fonte primaria, l'ordine dei muscoli nei movimenti composti va preso con cautela.
- L'EMG misura quanto un muscolo si attiva, non quanto contribuisce al lavoro meccanico: non decide da solo chi è il "principale".
- Nessun testo è stato copiato da queste fonti: qui restano solo le decisioni e i riferimenti.

### Fonti

- Escamilla et al., An electromyographic analysis of sumo and conventional style deadlifts, Med Sci Sports Exerc (2000): https://scholars.duke.edu/publication/670149
- Hanen et al., Biomechanical analysis of conventional and sumo deadlift, Frontiers in Bioengineering and Biotechnology (2025): https://www.frontiersin.org/journals/bioengineering-and-biotechnology/articles/10.3389/fbioe.2025.1597209/full
- Dryburgh e Psycharakis, Muscle activation under different loading conditions during the power clean, Int J Perform Anal Sport (2016): https://ideas.repec.org/a/taf/rpanxx/v16y2016i2p464-474.html
- Studio EMG sulla scaption (scapulari e deltoide): https://pmc.ncbi.nlm.nih.gov/articles/PMC6878867
- Hoshikawa et al., Coordination of the Sub-Regions of the Supraspinatus and Deltoid Muscles During Shoulder Scaption, Muscles Ligaments Tendons J: https://www.ejcrim.com/index.php/mltj/article/view/6946
- Electromyographic analysis of four popular abdominal exercises, J Athl Train (1993): https://pubmed.ncbi.nlm.nih.gov/16558218/
- Gomirato e Grenier, Diagnostic ultrasound shows preferential activation of rectus abdominis segments, Int J Exerc Sci (2023): https://digitalcommons.wku.edu/ijes/vol16/iss1/10
- Consenso tecnico (secondarie, non peer-reviewed): https://www.setforset.com/blogs/news/power-clean, https://train.fitness/personal-trainer-blogs/the-clean, https://fitnessvolt.com/sumo-deadlift-guide/, https://fitbod.me/exercises/flutter-kicks, https://www.muscleandstrength.com/node/3852, https://www.nasm.org/resource-center/exercise-library/russian-twist

### Applicato (migrazione 015)

Le decisioni sono nel catalogo con la migrazione `015_exercise_catalog_corrections.sql`, generata da `scripts/exercises/overrides.mjs`: Power Clean e Clean (principale: glutei; secondari: femorali, quadricipiti, trapezi), Sumo Deadlift (principale: quadricipiti; secondari: glutei, adduttori, femorali), Flutter Kicks (principale: addominali), Preacher Curl (attrezzo: bilanciere EZ). Dumbbell Scaption e Russian Twist restano come nella fonte. Il muscolo principale precedente e i secondari che la fonte già indicava restano tra i secondari. **I flessori dell'anca non esistono nel vocabolario dei muscoli** (17 voci): per ora non ci sono; se serviranno nelle Fasi 6-7 si aggiungono con una migrazione. Chi aveva già modificato questi esercizi nell'app tiene le sue modifiche (la copia personale vince).

Per le Fasi 6 e 7 (carico e recupero per gruppo) il limite della colonna "principale" resta: conviene valutare di salvare l'elenco ordinato dei muscoli, non uno solo.
