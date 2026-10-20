import { addDays } from '../lib/dates'
import { SUSPEND_PROPOSAL_DAYS, toHourMinute, type ReminderSetting } from '../lib/reminders'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

// Promemoria dei pasti (Fase 2, ADR-087): impostazioni, "pasto fatto" e registro dei promemoria partiti.
// Il database manda i promemoria (cron + Edge Function send-reminders) e segna da solo i pasti registrati (trigger
// sulle voci, migrazione 012); qui l'app legge e scrive solo le proprie impostazioni.

interface SettingRow {
  slot: string
  enabled: boolean
  time_weekday: string
  time_weekend: string | null
  proposal_dismissed_day: string | null
}

export async function listReminderSettings(): Promise<ReminderSetting[]> {
  const { data, error } = await getSupabase()
    .from('reminder_settings')
    .select('slot, enabled, time_weekday, time_weekend, proposal_dismissed_day')
  throwIfError(error)
  return ((data ?? []) as SettingRow[]).map((row) => ({
    slot: row.slot,
    enabled: row.enabled,
    timeWeekday: toHourMinute(row.time_weekday),
    timeWeekend: row.time_weekend === null ? null : toHourMinute(row.time_weekend),
    proposalDismissedDay: row.proposal_dismissed_day,
  }))
}

export async function saveReminderSetting(setting: ReminderSetting): Promise<void> {
  const { error } = await getSupabase()
    .from('reminder_settings')
    .upsert(
      {
        slot: setting.slot,
        enabled: setting.enabled,
        time_weekday: setting.timeWeekday,
        time_weekend: setting.timeWeekend,
        proposal_dismissed_day: setting.proposalDismissedDay,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,slot' },
    )
  throwIfError(error)
}

export interface ReminderHistory {
  /** slot → giorni in cui il promemoria è partito ed è stato accettato da almeno un dispositivo. */
  sentDays: Record<string, string[]>
  /** slot → giorni in cui il pasto è stato registrato. */
  doneDays: Record<string, string[]>
}

/** Ultimi giorni (poco più della finestra della proposta) di promemoria partiti e di pasti registrati. */
export async function readReminderHistory(today: string): Promise<ReminderHistory> {
  const since = addDays(today, -(SUSPEND_PROPOSAL_DAYS + 2))
  const [log, status] = await Promise.all([
    getSupabase().from('reminder_log').select('slot, day').gt('accepted', 0).gte('day', since),
    getSupabase().from('reminder_status').select('slot, day').gte('day', since),
  ])
  throwIfError(log.error)
  throwIfError(status.error)
  const group = (rows: ReadonlyArray<{ slot: string; day: string }>) => {
    const result: Record<string, string[]> = {}
    for (const row of rows) (result[row.slot] ??= []).push(row.day)
    return result
  }
  return { sentDays: group(log.data ?? []), doneDays: group(status.data ?? []) }
}
