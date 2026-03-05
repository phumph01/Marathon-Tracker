import runMileSplitsCsv from "../../run_mile_splits.csv?raw";
import { parseRunMileSplits, type RunSplitsByDate } from "../lib/runMileSplits";

export const runSplitsByDate: RunSplitsByDate = (() => {
  try {
    return parseRunMileSplits(runMileSplitsCsv);
  } catch {
    return {};
  }
})();
