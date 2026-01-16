import { DoseEvent } from "../models/doseEvent"
import { Medication } from "../models/medication"

const uuid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

export function generateTodayEvents(meds: Medication[], existing: DoseEvent[]) {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const d = String(today.getDate()).padStart(2, "0")
  const localDate = `${y}-${m}-${d}`

  const created: DoseEvent[] = []

  for (const med of meds) {
    if (!med.active) continue
    if (med.startDate > localDate) continue

    for (const time of med.times) {
      const localTime = time
      const scheduledAt = new Date(`${localDate}T${localTime}:00`).toISOString()

      const exists = existing.some(
        e => e.medicationId === med.id && e.localDate === localDate && e.localTime === localTime
      )
      if (exists) continue

      created.push({
        id: uuid(),
        medicationId: med.id,
        scheduledAt,
        localDate,
        localTime,
        status: "PENDING",
      })
    }
  }

  return created
}
