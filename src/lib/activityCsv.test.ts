import { describe, expect, it } from "vitest";
import { parseActivityCsv } from "./activityCsv";

const SAMPLE_ACTIVITY_CSV = `"Laps","Time","Cumulative Time","Distancemi","Avg Pacemin/mi","Avg HRbpm"
"1","7:25.8","7:25.8","1.00","7:26","132"
"2","7:42.5","15:08","1.00","7:42","141"
"3","7:50.3","22:59","1.00","7:50","139"
"4","7:38.0","30:37","1.00","7:38","139"
"5","7:39.5","38:16","1.00","7:39","139"
"6","7:27.9","45:44","1.00","7:28","134"
"7","3:50.2","49:34","0.51","7:34","139"
"Summary","49:34","49:34","6.51","7:37","138"`;

describe("parseActivityCsv", () => {
  it("parses lap rows and ignores summary row", () => {
    const result = parseActivityCsv(SAMPLE_ACTIVITY_CSV);

    expect(result.totalMiles).toBe(6.5);
    expect(result.splitPoints).toHaveLength(7);
    expect(result.splitPoints[0]).toEqual({
      mileIndex: 1,
      paceSecondsPerMile: 446,
      heartRateBpm: 132
    });
    expect(result.splitPoints[6]).toEqual({
      mileIndex: 7,
      paceSecondsPerMile: 454,
      heartRateBpm: 139
    });
    expect(result.runDescription).toContain("Completed run: 6.5 mi");
    expect(result.runDescription).toContain("Pace");
    expect(result.runDescription).toContain("Avg HR");
  });

  it("throws on malformed headers", () => {
    const malformed = `"Foo","Bar"
"1","2"`;

    expect(() => parseActivityCsv(malformed)).toThrow(
      "Activity CSV is missing required Laps/Distance columns."
    );
  });

  it("throws when there are no lap rows", () => {
    const noLaps = `"Laps","Distancemi","Avg Pacemin/mi","Avg HRbpm"
"Summary","6.2","8:01","142"`;

    expect(() => parseActivityCsv(noLaps)).toThrow("No lap rows found in activity CSV.");
  });
});
