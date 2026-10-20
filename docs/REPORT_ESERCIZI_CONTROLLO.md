# Controllo incrociato del catalogo esercizi (Fase 3)

Controllo su **40 esercizi a campione** (estrazione casuale con seme fisso 19102026) tra quelli importati che hanno un nome identico in `wger`. wger è stato usato **solo per verificare**: i suoi dati stanno fuori dal repo e dal database (licenza CC-BY-SA 3.0, ADR-089); qui resta solo "concorda / non concorda" per esercizio. Niente scraping di ExRx.

Limiti: wger non ha i gruppi avambracci, adduttori, abduttori, collo e schiena alta (questi casi risultano "non confrontabile"), e per alcuni esercizi non indica muscoli o attrezzi ("wger senza dato"). I restanti ~680 esercizi non sono stati controllati uno per uno: la qualità del resto del catalogo è quella della fonte.

Catalogo importato: 718 | wger (en): 872 | abbinati per nome univoco: 71 | ambigui (esclusi): 11
Muscoli: wger senza dato 4, non confrontabile 3, concorda 28, non concorda 5
Attrezzo: wger senza dato 12, concorda 19, non confrontabile 7, non concorda 2

| Esercizio (fonte) | Muscoli | Attrezzo |
| --- | --- | --- |
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

## Da decidere (Riccardo)

Dove le due fonti non concordano serve una terza fonte e una tua scelta. Finché non decidi, **gli esercizi restano nel catalogo come nella fonte** (e li puoi correggere dall'app con "Modifica"). Mia proposta, da verificare su una fonte autorevole che indicherai tu (per esempio la scheda dell'esercizio di un testo di anatomia o dell'NSCA):

| Esercizio | Fonte (free-exercise-db) | wger | Proposta |
| --- | --- | --- | --- |
| Power Clean | femorali | petto | glutei, femorali, quadricipiti, trapezi (wger qui sembra sbagliata) |
| Clean | femorali | glutei, quadricipiti | glutei, quadricipiti, femorali |
| Sumo Deadlift | femorali | quadricipiti | quadricipiti, glutei, adduttori, femorali |
| Dumbbell Scaption | spalle | trapezi | spalle (la fonte sembra giusta) |
| Flutter Kicks | glutei | addominali | addominali (la fonte sembra debole) |
| Preacher Curl (attrezzo) | bilanciere | bilanciere EZ | dipende da come si fa: lasciare bilanciere |
| Russian Twist (attrezzo) | corpo libero | manubri/palla | corpo libero (si fa anche senza) |

Una sola colonna "principale" per esercizio è una semplificazione: molti esercizi composti usano più gruppi allo stesso modo. Per le Fasi 6 e 7 (carico e recupero per gruppo) conterà molto, quindi questa scelta va fatta prima.
