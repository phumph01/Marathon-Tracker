import { describe, expect, it } from "vitest";
import { parseCsvPlan } from "./csvPlan";

describe("parseCsvPlan", () => {
  it("parses standard header and ISO dates", () => {
    const csv = [
      "date,miles,description",
      "2026-03-01,5,Easy run",
      "2026-03-02,0,Rest day"
    ].join("\n");

    const schedule = parseCsvPlan(csv, "My Plan");
    expect(schedule.name).toBe("My Plan");
    expect(schedule.plannedMilesByDate["2026-03-01"]).toBe(5);
    expect(schedule.descriptionByDate["2026-03-02"]).toBe("Rest day");
  });

  it("parses ISO dates that include weekday suffix", () => {
    const csv = [
      "Date,Miles,Description",
      "2026-03-01 (Sun),4.0,Easy Base",
      "2026-03-02 (Mon),0.0,Rest Day"
    ].join("\n");

    const schedule = parseCsvPlan(csv, "Chicago");
    expect(schedule.plannedMilesByDate["2026-03-01"]).toBe(4);
    expect(schedule.descriptionByDate["2026-03-02"]).toBe("Rest Day");
  });

  it("parses execution strategy header and month/day dates", () => {
    const csv = [
      "Date,Miles,Execution Strategy",
      "Mar 01 (Sun),4,Recovery run",
      "Mar 02 (Mon),0,Rest day"
    ].join("\n");

    const schedule = parseCsvPlan(csv, "Imported");
    const year = new Date().getFullYear();
    expect(schedule.plannedMilesByDate[`${year}-03-01`]).toBe(4);
    expect(schedule.descriptionByDate[`${year}-03-02`]).toBe("Rest day");
  });

  it("throws when required headers are missing", () => {
    const csv = [
      "Date,Execution Strategy",
      "2026-03-01,Easy run"
    ].join("\n");

    expect(() => parseCsvPlan(csv)).toThrow("CSV headers must include date, miles, and description columns.");
  });

  it("throws on invalid miles values", () => {
    const csv = [
      "date,miles,description",
      "2026-03-01,abc,Easy run"
    ].join("\n");

    expect(() => parseCsvPlan(csv)).toThrow('invalid miles "abc"');
  });
});

