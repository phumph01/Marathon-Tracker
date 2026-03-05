import { describe, expect, it } from "vitest";
import { redistributeWeekMiles } from "./redistribute";

describe("redistributeWeekMiles", () => {
  it("redistributes remaining days when behind schedule", () => {
    const result = redistributeWeekMiles({
      plannedWeek: [5, 3, 7, 3, 0, 15, 4],
      completedActuals: [3, 0, 5, null, null, null, null],
      targetWeeklyTotal: 37
    });

    const total = result.adjustedWeek.reduce((sum, miles) => sum + miles, 0);
    expect(total).toBe(37);
    expect(result.adjustedWeek[5]).toBeGreaterThan(result.adjustedWeek[6]);
    expect(result.adjustedWeek[6]).toBeGreaterThan(result.adjustedWeek[3]);
    expect(result.adjustedWeek[4]).toBe(0);
  });

  it("reduces remaining days when ahead of schedule", () => {
    const result = redistributeWeekMiles({
      plannedWeek: [5, 3, 7, 3, 0, 15, 4],
      completedActuals: [7, 4, 10, null, null, null, null],
      targetWeeklyTotal: 37
    });

    expect(result.adjustedWeek.reduce((sum, miles) => sum + miles, 0)).toBe(37);
    expect(result.adjustedWeek[5]).toBeGreaterThan(result.adjustedWeek[3]);
  });

  it("uses even distribution when remaining planned ratios are zero", () => {
    const result = redistributeWeekMiles({
      plannedWeek: [4, 4, 4, 0, 0, 0, 0],
      completedActuals: [4, 4, 4, null, null, null, null],
      targetWeeklyTotal: 20
    });

    expect(result.adjustedWeek.slice(3)).toEqual([2, 2, 2, 2]);
  });

  it("reconciles rounding residual to exactly match target", () => {
    const result = redistributeWeekMiles({
      plannedWeek: [1, 1, 1, 1, 1, 1, 1],
      completedActuals: [0.9, null, null, null, null, null, null],
      targetWeeklyTotal: 7
    });

    const total = result.adjustedWeek.reduce((sum, miles) => sum + miles, 0);
    expect(total).toBe(7);
  });
});

