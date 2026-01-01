import { Medication } from "../models/medication";
import { DoseEvent } from "../models/doseEvent";

const uuid = () => `${Date.now()}-${Math.random()}`;

export function generateTodayEvents(meds: Medication[], existing: DoseEvent[]) {
  const today = new Date().toISOString().split("T")[0];

  const created: DoseEvent[] = [];

  for (const m of meds) {
    if (!m.active) continue;
    if (m.startDate > today) continue;

    for (const time of m.times) {
      const when = new Date(`${today}T${time}:00`).toISOString();

      if (!existing.find(e => e.medicationId === m.id && e.scheduledAt === when)) {
        created.push({
          id: uuid(),
          medicationId: m.id,
          scheduledAt: when,
          status: "PENDING",
        });
      }
    }
  }

  return created;
}
