export type DoseStatus = "PENDING" | "TAKEN" | "SKIPPED"

export type DoseEvent = {
  id: string
  medicationId: string
  scheduledAt: string
  localDate: string
  localTime: string
  status: DoseStatus
  actedAt?: string
}