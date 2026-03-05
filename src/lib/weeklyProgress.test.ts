import { describe, expect, it } from "vitest";
import type { TrainingSchedule } from "../types/schedule";
import { buildDailyProgress, buildWeeklyProgress, filterProgressByTimeframe } from "./weeklyProgress";

const schedule: TrainingSchedule = {
  name: "Test",
  weeks: [
    { weekStart: "2026-03-02", dailyMiles: [4, 5, 6, 4, 3, 10, 4] },
    { weekStart: "2026-03-09", dailyMiles: [4, 6, 7, 4, 3, 12, 4] }
  ],
  plannedMilesByDate: {
    "2026-03-02": 4,
    "2026-03-03": 5,
    "2026-03-04": 6,
    "2026-03-05": 4,
    "2026-03-06": 3,
    "2026-03-07": 10,
    "2026-03-08": 4,
    "2026-03-09": 4,
    "2026-03-10": 6,
    "2026-03-11": 7,
    "2026-03-12": 4,
    "2026-03-13": 3,
    "2026-03-14": 12,
    "2026-03-15": 4
  },
  descriptionByDate: {}
};

describe("buildWeeklyProgress", () => {
  it("calculates planned totals per week", () => {
    const result = buildWeeklyProgress(schedule, {});
    expect(result[0].plannedTotal).toBe(36);
    expect(result[1].plannedTotal).toBe(40);
  });

  it("calculates actual totals from partial day actuals", () => {
    const result = buildWeeklyProgress(schedule, {
      "2026-03-02": 3.5,
      "2026-03-03": 0,
      "2026-03-04": 5.5,
      "2026-03-10": 6
    });

    expect(result[0].actualTotal).toBe(9);
    expect(result[1].actualTotal).toBe(6);
  });

  it("returns zero actual totals when no actuals exist", () => {
    const result = buildWeeklyProgress(schedule, {});
    expect(result.every((point) => point.actualTotal === 0)).toBe(true);
  });
});

describe("buildDailyProgress", () => {
  it("creates a data point for each scheduled date", () => {
    const result = buildDailyProgress(schedule, {
      "2026-03-03": 5.5
    });
    expect(result).toHaveLength(14);
    expect(result[1].plannedTotal).toBe(5);
    expect(result[1].actualTotal).toBe(5.5);
    expect(result[2].actualTotal).toBe(0);
  });
});

describe("filterProgressByTimeframe", () => {
  const points = Array.from({ length: 14 }, (_, index) => ({
    weekStart: `2026-03-${String(index + 1).padStart(2, "0")}`,
    plannedTotal: index + 10,
    actualTotal: index + 5
  }));

  it("returns all points for all timeframe", () => {
    const result = filterProgressByTimeframe(points, "all", "weekly");
    expect(result).toHaveLength(14);
  });

  it("centers 4w window around reference with 25/75 split", () => {
    const result = filterProgressByTimeframe(points, "4w", "weekly", "2026-03-10");
    expect(result).toHaveLength(4);
    expect(result[0].weekStart).toBe("2026-03-10");
    expect(result[3].weekStart).toBe("2026-03-13");
  });

  it("centers 8w window around reference with 25/75 split", () => {
    const result = filterProgressByTimeframe(points, "8w", "weekly", "2026-03-10");
    expect(result).toHaveLength(8);
    expect(result[0].weekStart).toBe("2026-03-08");
    expect(result[7].weekStart).toBe("2026-03-15");
  });

  it("caps to available points for 12w timeframe", () => {
    const shortPoints = points.slice(0, 6);
    const result = filterProgressByTimeframe(shortPoints, "12w", "weekly", "2026-03-05");
    expect(result).toHaveLength(6);
  });

  it("uses 7x window length for daily granularity", () => {
    const dailyPoints = Array.from({ length: 40 }, (_, index) => ({
      weekStart: `2026-04-${String(index + 1).padStart(2, "0")}`,
      plannedTotal: index,
      actualTotal: index
    }));

    const result = filterProgressByTimeframe(dailyPoints, "4w", "daily", "2026-04-21");
    expect(result).toHaveLength(28);
    expect(result[0].weekStart).toBe("2026-04-14");
  });
});

