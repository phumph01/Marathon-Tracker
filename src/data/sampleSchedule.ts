import { addDays, toIsoDate } from "../lib/dateUtils";
import type { TrainingSchedule, TrainingWeek } from "../types/schedule";

const SAMPLE_WEEK_PATTERNS: number[][] = [
  [4, 3, 6, 3, 0, 10, 4],
  [5, 3, 7, 3, 0, 12, 4],
  [5, 4, 7, 4, 0, 13, 4],
  [4, 3, 6, 3, 0, 9, 4],
  [5, 3, 8, 3, 0, 13, 4],
  [5, 3, 7, 3, 0, 15, 4],
  [6, 4, 8, 4, 0, 14, 5],
  [5, 3, 7, 3, 0, 10, 4],
  [6, 4, 9, 4, 0, 15, 5],
  [6, 4, 8, 4, 0, 17, 5],
  [7, 4, 9, 4, 0, 18, 5],
  [5, 3, 7, 3, 0, 12, 4]
];

function buildWeeks(startMondayIso: string, weeklyPatterns: number[][]): TrainingWeek[] {
  const [year, month, day] = startMondayIso.split("-").map(Number);
  const startDate = new Date(year, month - 1, day);

  return weeklyPatterns.map((pattern, weekOffset) => {
    const weekStart = addDays(startDate, weekOffset * 7);
    return {
      weekStart: toIsoDate(weekStart),
      dailyMiles: pattern
    };
  });
}

function buildMilesByDate(weeks: TrainingWeek[]): Record<string, number> {
  const result: Record<string, number> = {};

  weeks.forEach((week) => {
    const [year, month, day] = week.weekStart.split("-").map(Number);
    const weekStart = new Date(year, month - 1, day);

    week.dailyMiles.forEach((miles, dayOffset) => {
      result[toIsoDate(addDays(weekStart, dayOffset))] = miles;
    });
  });

  return result;
}

function buildDescriptionByDate(weeks: TrainingWeek[]): Record<string, string> {
  const descriptions: Record<string, string> = {};

  weeks.forEach((week) => {
    const [year, month, day] = week.weekStart.split("-").map(Number);
    const weekStart = new Date(year, month - 1, day);

    week.dailyMiles.forEach((miles, dayOffset) => {
      const isoDate = toIsoDate(addDays(weekStart, dayOffset));
      descriptions[isoDate] = getDefaultDescription(dayOffset, miles);
    });
  });

  return descriptions;
}

function getDefaultDescription(dayOffset: number, miles: number): string {
  if (miles === 0) {
    return "Rest day";
  }
  if (dayOffset === 5) {
    return "Long run";
  }
  if (dayOffset === 2) {
    return "Steady aerobic run";
  }
  if (dayOffset === 1) {
    return "Workout day";
  }
  return "Easy run";
}

const weeks = buildWeeks("2026-01-05", SAMPLE_WEEK_PATTERNS);

export const sampleSchedule: TrainingSchedule = {
  name: "12-Week Marathon Sample",
  weeks,
  plannedMilesByDate: buildMilesByDate(weeks),
  descriptionByDate: buildDescriptionByDate(weeks)
};

