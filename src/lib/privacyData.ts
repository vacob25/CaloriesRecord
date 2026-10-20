import type { ExportTable } from './exportData'

/**
 * Cosa contiene ogni tabella, in parole semplici, per la pagina Privacy (revisione #21).
 * `Record<ExportTable, string>` obbliga ad aggiungere qui una riga ogni volta che un'altra tabella entra nell'esportazione,
 * e l'esportazione è legata alle tabelle delle migrazioni da un test: una tabella nuova non può restare fuori dalla pagina.
 */
export const PRIVACY_DATA: Record<ExportTable, string> = {
  profiles:
    'Profilo: sesso, data di nascita, altezza, peso obiettivo, obiettivo scelto (massa, mantenimento o definizione) e ritmo del cut, sport, livello di attività, obiettivo d’acqua e parametri del calcolo.',
  foods: 'I tuoi cibi e le tue ricette, con valori nutrizionali, porzioni e quali sono preferiti.',
  recipe_items: 'Gli ingredienti delle tue ricette.',
  meal_slots: 'I nomi e l’ordine dei tuoi pasti, anche quelli che crei tu.',
  meal_entries: 'Il diario: cosa mangi, in che quantità, in quale pasto e in quale giorno.',
  weight_logs: 'Le tue pesate.',
  daily_targets: 'Il target di ogni giorno (calorie e macro) e il tipo di giorno: riposo o gli sport che hai fatto.',
  tdee_estimates: 'Le stime settimanali della ricalibrazione e le tue scelte (accettata o rifiutata).',
  water_entries: 'L’acqua che bevi, giorno per giorno.',
  drink_containers: 'I tuoi contenitori (per esempio la borraccia) con la loro capacità.',
  reminder_settings: 'I promemoria dei pasti: quali sono attivi e a che ora (nei giorni feriali e nel weekend).',
}
