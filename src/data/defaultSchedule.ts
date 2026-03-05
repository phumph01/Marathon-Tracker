import { parseCsvPlan } from "../lib/csvPlan";
import type { TrainingSchedule } from "../types/schedule";
import chicagoFullProgressionCsv from "../../Chicago_Marathon_250_Full_Progression.csv?raw";
import { sampleSchedule } from "./sampleSchedule";

export const defaultSchedule: TrainingSchedule = (() => {
  try {
    return parseCsvPlan(chicagoFullProgressionCsv, "Chicago Marathon 250 Full Progression");
  } catch {
    return sampleSchedule;
  }
})();

