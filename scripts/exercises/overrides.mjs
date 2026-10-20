// Correzioni decise da Riccardo il 20/10/2026 dopo il controllo incrociato (docs/REPORT_ESERCIZI_CONTROLLO.md).
// Non cambiano la migrazione 014 (già applicata): le genera build.mjs come migrazione 015.
// Convenzione: il primo muscolo è il principale, gli altri sono secondari. Per i movimenti composti è una convenzione, non un fatto misurato.
//   primary:        il nuovo muscolo principale
//   secondaryFirst: muscoli secondari da mettere in testa all'elenco
//   equipment:      attrezzo corretto
// Il muscolo principale precedente (e i secondari che c'erano) restano tra i secondari, se non sono il nuovo principale.
export const OVERRIDES = {
  Power_Clean: { primary: 'glutes', secondaryFirst: ['hamstrings', 'quadriceps', 'traps'], why: 'catena posteriore; wger (petto) sbagliata, la fonte incompleta' },
  Clean: { primary: 'glutes', secondaryFirst: ['hamstrings', 'quadriceps', 'traps'], why: 'stesso insieme del Power Clean' },
  Sumo_Deadlift: { primary: 'quadriceps', secondaryFirst: ['glutes', 'adductors', 'hamstrings'], why: 'EMG: nel sumo più quadricipiti e adduttori che nello stacco convenzionale' },
  Flutter_Kicks: { primary: 'abdominals', secondaryFirst: [], why: 'le schede danno retto dell’addome e flessori dell’anca (non nel vocabolario)' },
  Preacher_Curl: { equipment: 'ez_bar', why: 'di norma si fa con la barra EZ' },
}
// Dumbbell Scaption (spalle) e Russian Twist (corpo libero) sono stati confermati come nella fonte: nessuna correzione.
