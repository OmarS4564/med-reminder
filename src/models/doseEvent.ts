export type DoseStatus = "PENDING" | "TAKEN" | "SKIPPED";

export type DoseEvent = {
  id: string;
  medicationId: string;
  scheduledAt: string;
  status: DoseStatus;
  actedAt?: string;
};
