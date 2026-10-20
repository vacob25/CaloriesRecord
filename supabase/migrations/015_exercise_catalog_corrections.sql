-- Migrazione 015 (Fase 3, ADR-089): correzioni al catalogo decise da Riccardo il 20/10/2026 dopo il controllo incrociato
-- (docs/REPORT_ESERCIZI_CONTROLLO.md). GENERATA da scripts/exercises/build.mjs a partire da scripts/exercises/overrides.mjs.
-- Convenzione: il primo muscolo è il principale, gli altri secondari. Ogni UPDATE deve toccare esattamente una riga.
do $$
declare n int;
begin
  -- Power_Clean: catena posteriore; wger (petto) sbagliata, la fonte incompleta
  update public.exercise_catalog set primary_muscles = array['glutes']::text[], secondary_muscles = array['hamstrings', 'quadriceps', 'traps', 'calves', 'forearms', 'lower_back', 'upper_back', 'shoulders', 'triceps']::text[], equipment = 'barbell'
    where source = 'free-exercise-db' and source_id = 'Power_Clean';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'correzione fallita per Power_Clean: % righe', n; end if;
  -- Clean: stesso insieme del Power Clean
  update public.exercise_catalog set primary_muscles = array['glutes']::text[], secondary_muscles = array['hamstrings', 'quadriceps', 'traps', 'calves', 'forearms', 'lower_back', 'shoulders']::text[], equipment = 'barbell'
    where source = 'free-exercise-db' and source_id = 'Clean';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'correzione fallita per Clean: % righe', n; end if;
  -- Sumo_Deadlift: EMG: nel sumo più quadricipiti e adduttori che nello stacco convenzionale
  update public.exercise_catalog set primary_muscles = array['quadriceps']::text[], secondary_muscles = array['glutes', 'adductors', 'hamstrings', 'forearms', 'lower_back', 'upper_back', 'traps']::text[], equipment = 'barbell'
    where source = 'free-exercise-db' and source_id = 'Sumo_Deadlift';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'correzione fallita per Sumo_Deadlift: % righe', n; end if;
  -- Flutter_Kicks: le schede danno retto dell’addome e flessori dell’anca (non nel vocabolario)
  update public.exercise_catalog set primary_muscles = array['abdominals']::text[], secondary_muscles = array['glutes', 'hamstrings']::text[], equipment = 'bodyweight'
    where source = 'free-exercise-db' and source_id = 'Flutter_Kicks';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'correzione fallita per Flutter_Kicks: % righe', n; end if;
  -- Preacher_Curl: di norma si fa con la barra EZ
  update public.exercise_catalog set primary_muscles = array['biceps']::text[], secondary_muscles = array[]::text[], equipment = 'ez_bar'
    where source = 'free-exercise-db' and source_id = 'Preacher_Curl';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'correzione fallita per Preacher_Curl: % righe', n; end if;
end $$;
