/**
 * Tutorial a popup (step 19): passi che portano nelle schermate vere e ne evidenziano una parte.
 * `target` è il valore di `data-tour` dell'elemento da evidenziare (null = nessuna evidenziazione).
 */
export interface TourStep {
  id: string
  path: string
  target: string | null
  title: string
  text: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'ring',
    path: '/',
    target: 'ring',
    title: 'Il tuo obiettivo di oggi',
    text: 'L’anello mostra le kcal che ti restano. Sotto, le barre di proteine, carboidrati e grassi. Tocca il giorno (Riposo, sport) per cambiare il tipo di allenamento di oggi.',
  },
  {
    id: 'weight',
    path: '/',
    target: 'weight',
    title: 'Il peso',
    text: 'Tocca il tuo peso in alto per registrarlo: meglio ogni mattina. Le pesate costruiscono la media e l’andamento, e l’app ti ricorda se te ne dimentichi.',
  },
  {
    id: 'meals',
    path: '/',
    target: 'meals',
    title: 'I pasti',
    text: 'Cinque pasti al giorno: tocca “+ Aggiungi” per registrare cosa mangi, oppure tocca una voce per cambiarne la quantità o eliminarla.',
  },
  {
    id: 'water',
    path: '/',
    target: 'water',
    title: 'L’acqua',
    text: 'Con + e − conti quante volte bevi ogni contenitore. Con “Altra quantità” scrivi i ml o salvi la tua borraccia come nuovo contenitore.',
  },
  {
    id: 'add',
    path: '/aggiungi',
    target: 'add-search',
    title: 'Aggiungere un pasto',
    text: 'Cerca un cibo, scansiona il codice a barre o scegli tra Recenti, Preferiti e Catalogo. Poi scegli la quantità, anche a porzioni: l’app calcola calorie e macro.',
  },
  {
    id: 'foods',
    path: '/cibi',
    target: 'foods-actions',
    title: 'Cibi e ricette',
    text: 'Qui crei i tuoi cibi e le ricette (ingredienti e peso a fine cottura). Con la stella metti i cibi nei Preferiti, con la matita li modifichi.',
  },
  {
    id: 'stats',
    path: '/statistiche',
    target: 'stats-period',
    title: 'Statistiche',
    text: 'Settimana o mese: calorie medie, giorni in obiettivo, pasti più frequenti e l’andamento del peso. Da qui apri anche la pagina del Peso.',
  },
  {
    id: 'profile',
    path: '/profilo',
    target: 'profile-goal',
    title: 'Il tuo profilo',
    text: 'Qui cambi obiettivo e sport, i parametri del calcolo e l’acqua. Dopo 3 settimane la ricalibrazione corregge il tuo mantenimento con i dati veri. Puoi anche esportare o eliminare i tuoi dati.',
  },
]

/** "1/8". */
export function tourLabel(index: number): string {
  return `${index + 1}/${TOUR_STEPS.length}`
}

export const isLastStep = (index: number): boolean => index >= TOUR_STEPS.length - 1

export function nextStep(index: number): number {
  return Math.min(index + 1, TOUR_STEPS.length - 1)
}

export function previousStep(index: number): number {
  return Math.max(index - 1, 0)
}
