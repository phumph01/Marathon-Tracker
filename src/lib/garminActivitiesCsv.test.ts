import { describe, expect, it } from "vitest";
import { parseGarminActivitiesCsv } from "./garminActivitiesCsv";

describe("parseGarminActivitiesCsv", () => {
  it("aggregates run miles by date and rounds totals to tenths", () => {
    const csv = [
      "Date,Activity Type,Distance,Avg Pace,Avg HR",
      "2026-03-01,Running,5.0,8:00,150",
      "2026-03-01,Treadmill Running,2.45,8:30,156",
      "2026-03-02,Trail Running,3.26,9:10,162"
    ].join("\n");

    const parsed = parseGarminActivitiesCsv(csv);

    expect(parsed.runMilesByDate["2026-03-01"]).toBe(7.5);
    expect(parsed.runMilesByDate["2026-03-02"]).toBe(3.3);
    expect(parsed.runDescriptionByDate["2026-03-01"]).toContain("Completed run: 7.5 mi");
    expect(parsed.runDescriptionByDate["2026-03-01"]).toContain("Pace 8:10/mi");
    expect(parsed.runDescriptionByDate["2026-03-01"]).toContain("Avg HR 152 bpm");
  });

  it("marks workout and other activity days and supports both on same day", () => {
    const csv = [
      "Date,Activity Type,Distance",
      "2026-03-05,Strength Training,0",
      "2026-03-05,Cycling,12.5",
      "2026-03-06,Yoga,0"
    ].join("\n");

    const parsed = parseGarminActivitiesCsv(csv);

    expect(parsed.workoutByDate["2026-03-05"]).toBe(true);
    expect(parsed.otherByDate["2026-03-05"]).toBe(true);
    expect(parsed.workoutByDate["2026-03-06"]).toBe(true);
    expect(parsed.runDescriptionByDate["2026-03-05"]).toBeUndefined();
  });

  it("converts kilometer distance columns to miles for runs", () => {
    const csv = [
      "Date,Activity Type,Distance (km)",
      "03/07/2026,Running,10.0",
      "03/08/2026,Running,5.0"
    ].join("\n");

    const parsed = parseGarminActivitiesCsv(csv);

    expect(parsed.runMilesByDate["2026-03-07"]).toBe(6.2);
    expect(parsed.runMilesByDate["2026-03-08"]).toBe(3.1);
    expect(parsed.runDescriptionByDate["2026-03-07"]).toContain("Completed run: 6.2 mi");
  });

  it("throws when required headers are missing", () => {
    const csv = [
      "Date,Distance",
      "2026-03-01,4.0"
    ].join("\n");

    expect(() => parseGarminActivitiesCsv(csv)).toThrow("Garmin CSV headers must include Date and Activity Type columns.");
  });
});
