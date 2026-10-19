/** "Più tardi" nella scelta degli sport (correzione #18) vale fino alla prossima apertura dell'app. */
let deferredThisLaunch = false

export function sportsChoiceDeferred(): boolean {
  return deferredThisLaunch
}

export function deferSportsChoice(): void {
  deferredThisLaunch = true
}
