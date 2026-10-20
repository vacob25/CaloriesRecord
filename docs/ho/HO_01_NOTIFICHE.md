# HO 01 · Promemoria push (modalità A)

> Copia nel repo con le correzioni decise dopo la Fase 0 (19/10/2026), segnate **[Aggiornato 19/10]**.

Risposta alle tue 6 domande del blocco 1, con una modifica all'ordine e una generalizzazione per gli allenamenti.

## Decisione

Scelgo **A (Web Push)**. B (Capacitor) è scartata: Apple Developer costa 99 € l'anno (la ragione di ADR-001) e ai tester non basterebbe più un link. C (solo in-app) è il ripiego se la prova sull'iPhone fallisce.

## Fase 1 · Prova di fattibilità (PRIMA di tabelle, cron e Edge Function)

Costruisci solo il minimo:

- un pulsante "Attiva notifiche" nelle impostazioni (il permesso si chiede solo dopo un tocco, come richiede iOS);
- salvataggio della subscription (tabella con RLS, `user_id`, cancellazione a cascata);
- un push di prova. **[Aggiornato 19/10]** Parte da una Edge Function minima, già in questa fase, con l'ADR che modifica ADR-065: la funzione verifica il JWT di chi la chiama, legge con la RLS **solo** la subscription di quell'utente e manda la notifica a lui. Nessuna `service_role` in Fase 1 (si valuta solo in Fase 2, per il cron). Le chiavi VAPID le genera Riccardo dal suo PC; la privata e il subject (`mailto:`) vanno solo nei segreti di Supabase, la pubblica anche nella variabile d'ambiente dell'app su Vercel.

Io lo provo con l'app installata, dall'Italia. **Se non arriva, ripieghiamo su C e non si costruisce altro.** Fermati e dimmi cosa provare.

## Fase 2 · Promemoria completi (solo dopo il mio ok)

1. **Edge Function sì**, con ADR che modifica ADR-065 (da "nessun codice server" a "una sola funzione, minima"). Vincoli:
   - legge solo le impostazioni dei promemoria, le subscription, il registro degli invii e `reminder_status`; **mai** pasti, pesi, profilo o allenamenti;
   - chiave VAPID privata e subject (`mailto:`) solo nei segreti di Supabase, mai nel repo;
   - nessuna `service_role` nel repo o nel client; verifica nella documentazione ufficiale come la funzione ottiene la chiave con il sistema di chiavi attuale.
2. **Scheduler:** `pg_cron` ogni 5 minuti. Prima esegue una query SQL e chiama la funzione (`pg_net`) **solo se** c'è almeno un promemoria da inviare. Orari scelti a passi di 5 minuti. Verifica in Database → Extensions che `pg_cron` sia disponibile sul piano gratuito e se la sua attività conta contro la pausa dei 7 giorni.
3. **Testo generico** per i pasti (es. "Hai registrato il pranzo?"): niente peso, calorie o nomi di cibi. Il testo passa dai server di Apple e Google.
4. **Slot:** `reminder_status` e il registro invii usano uno slot generico: tipo `meal:<chiave>` (oggi `lunch` e `dinner`) oppure `workout` (arriva alla Fase 8). Vincolo di unicità per utente, slot e giorno locale, così non partono due promemoria. "Fatto" per un pasto = l'app scrive lo stato quando registro; per l'allenamento = lo scrive quando inizio una sessione.
5. **Pasti `lunch` e `dinner`:** va bene legarli alle loro chiavi. Se l'utente elimina il pasto, l'interruttore corrispondente nelle impostazioni è disattivato con una spiegazione, non resta attivo senza effetto.
6. **Orario diverso nel weekend:** sì, se resta un solo campo in più per slot.
7. **"Ignorato"** = promemoria inviato e slot ancora vuoto a fine giornata. Chiamalo "non registrato" nel codice e nei documenti. **[Aggiornato 19/10] Nessuna sospensione automatica: prevale la regola originale.** Dopo 5 giorni consecutivi con promemoria inviato e slot non registrato, l'app mostra solo una proposta ("Vuoi sospendere il promemoria del pranzo?"). Il contatore conta solo gli invii **accettati dal push service** (risposta 2xx) e si azzera quando registro quel pasto. Non cancellare né disattivare niente in silenzio.
8. **Subscription:** **[Aggiornato 19/10]** al logout cancella solo la subscription **di quel dispositivo** (identificata dall'endpoint); alla disattivazione quella del dispositivo; quando il push service risponde 404/410 quella scaduta; con l'eliminazione dell'account tutte (a cascata). Aggiorna pagina privacy, esportazione ed eliminazione (il test che confronta l'elenco tabelle deve coprire le nuove).
9. **Service worker:** **[Aggiornato 19/10]** niente `injectManifest`: si resta su `generateSW` e il gestore delle notifiche entra con `importScripts` (opzione prevista da Workbox proprio per un listener `push`). Va verificato che "Nuova versione disponibile" arrivi ancora, anche quando cambia solo il file importato e dopo giorni di inattività. Descrivimi come l'hai provato. Un service worker rotto lascia l'iPhone fermo su una versione vecchia.
10. **Fusi e ora legale:** orari salvati come ora locale + `Europe/Rome`; l'istante lo calcola Postgres con `AT TIME ZONE`. Test in SQL e Vitest per 2026-10-25 e 2027-03-28.
11. Verifica sulla documentazione ufficiale i limiti correnti (invocazioni Edge Function, durata, CPU) e riportali con link.

## Promemoria degli allenamenti (Fase 8)

**[Aggiornato 19/10]** Il "fatto" dello slot `workout` lo scrive l'app quando inizio una sessione; vale la stessa regola della proposta (punto 7), niente sospensione automatica.


Lo slot `workout` usa la stessa infrastruttura. Ogni giorno di una scheda può avere giorno della settimana e orario (con orario weekend se serve). Il testo può contenere il nome che ho dato al giorno ("Oggi: Petto e tricipiti"): è una scelta mia, ma nelle impostazioni deve esserci l'opzione "testo generico" ("Oggi è giorno di allenamento"), e la pagina privacy deve dire che il testo viaggia sui server di Apple e Google. Non inviare il promemoria se per quel giorno esiste già una sessione iniziata.
