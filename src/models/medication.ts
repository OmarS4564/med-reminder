export type Medication = {
  id: string;
  name: string;
  dosageText: string;
  instructions?: string;
  times: string[];
  startDate: string;
  active: boolean;

  pillsRemaining: number;
  pillsPerDose: number;
  refillThreshold: number;

  updatedAt: number;
};
