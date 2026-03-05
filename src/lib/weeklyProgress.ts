import { fromIsoDate, getWeekStartIso } from "./dateUtils";
import type { IsoDateString, TrainingSchedule } from "../types/schedule";

export interface WeeklyProgressPoint {
  weekStart: IsoDateString;
  plannedTotal: number;
  actualTotal: number;
}

export type WeeklyTimeframe = "all" | "4w" | "8w" | "12w";
export type ProgressGranularity = "weekly" | "daily";

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildWeeklyProgress(
  schedule: TrainingSchedule,
  actualsByDate: Record<IsoDateString, number>
): WeeklyProgressPoint[] {
  const sortedDates = Object.keys(schedule.plannedMilesByDate).sort();
  const weeklyTotals: Record<IsoDateString, { plannedTotal: number; actualTotal: number }> = {};

  sortedDates.forEach((isoDate) => {
    const weekStart = getWeekStartIso(fromIsoDate(isoDate));
    if (!weeklyTotals[weekStart]) {
      weeklyTotals[weekStart] = { plannedTotal: 0, actualTotal: 0 };
    }

    weeklyTotals[weekStart].plannedTotal += schedule.plannedMilesByDate[isoDate] ?? 0;
    const actualValue = actualsByDate[isoDate];
    weeklyTotals[weekStart].actualTotal += Number.isFinite(actualValue) ? actualValue : 0;
  });

  return Object.keys(weeklyTotals)
    .sort()
    .map((weekStart) => ({
      weekStart,
      plannedTotal: roundToTenth(weeklyTotals[weekStart].plannedTotal),
      actualTotal: roundToTenth(weeklyTotals[weekStart].actualTotal)
    }));
}

export function buildDailyProgress(
  schedule: TrainingSchedule,
  actualsByDate: Record<IsoDateString, number>
): WeeklyProgressPoint[] {
  const sortedDates = Object.keys(schedule.plannedMilesByDate).sort();
  return sortedDates.map((isoDate) => {
    const plannedValue = schedule.plannedMilesByDate[isoDate] ?? 0;
    const actualValue = actualsByDate[isoDate];
    return {
      weekStart: isoDate,
      plannedTotal: roundToTenth(plannedValue),
      actualTotal: roundToTenth(Number.isFinite(actualValue) ? actualValue : 0)
    };
  });
}

export function filterProgressByTimeframe(
  points: WeeklyProgressPoint[],
  timeframe: WeeklyTimeframe,
  granularity: ProgressGranularity,
  referenceDateIso?: IsoDateString
): WeeklyProgressPoint[] {
  if (timeframe === "all") {
    return points;
  }

  if (points.length === 0) {
    return points;
  }

  const baseLength = timeframe === "4w" ? 4 : timeframe === "8w" ? 8 : 12;
  const length = granularity === "daily" ? baseLength * 7 : baseLength;
  const clampedLength = Math.min(length, points.length);
  const referenceIso = referenceDateIso ?? new Date().toISOString().slice(0, 10);
  const currentIndex = getReferenceIndex(points, referenceIso);
  const beforeCount = Math.floor(clampedLength * 0.25);

  let start = currentIndex - beforeCount;
  if (start < 0) {
    start = 0;
  }

  if (start + clampedLength > points.length) {
    start = Math.max(0, points.length - clampedLength);
  }

  return points.slice(start, start + clampedLength);
}

function getReferenceIndex(points: WeeklyProgressPoint[], referenceIso: IsoDateString): number {
  const firstAfterIndex = points.findIndex((point) => point.weekStart > referenceIso);
  if (firstAfterIndex === -1) {
    return points.length - 1;
  }
  if (firstAfterIndex === 0) {
    return 0;
  }
  return firstAfterIndex - 1;
}

