import { toIsoDate } from "./dateUtils";
import type { IsoDateString } from "../types/schedule";

type ActivityBucket = "run" | "workout" | "other";

export interface GarminActivitiesImport {
  runMilesByDate: Record<IsoDateString, number>;
  runDescriptionByDate: Record<IsoDateString, string>;
  workoutByDate: Record<IsoDateString, boolean>;
  otherByDate: Record<IsoDateString, boolean>;
}

const DATE_HEADER_ALIASES = ["date", "activity date", "start time", "begin timestamp"];
const TYPE_HEADER_ALIASES = ["activity type", "type", "activity"];
const DISTANCE_HEADER_ALIASES = ["distance"];
const PACE_HEADER_ALIASES = ["average pace", "avg pace", "pace", "avg moving pace"];
const HEART_RATE_HEADER_ALIASES = [
  "average heart rate",
  "avg heart rate",
  "average hr",
  "avg hr",
  "heart rate"
];

interface RunSummaryAccumulator {
  miles: number;
  weightedPaceMinutesTotal: number;
  paceMilesTotal: number;
  weightedHeartRateTotal: number;
  heartRateMilesTotal: number;
}

export function parseGarminActivitiesCsv(csvText: string): GarminActivitiesImport {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one activity row.");
  }

  const headers = rows[0].map(normalizeHeader);
  const dateIndex = findHeaderIndex(headers, DATE_HEADER_ALIASES);
  const typeIndex = findHeaderIndex(headers, TYPE_HEADER_ALIASES);
  const distanceIndex = findDistanceHeaderIndex(headers);
  const paceIndex = findHeaderIndex(headers, PACE_HEADER_ALIASES);
  const heartRateIndex = findHeaderIndex(headers, HEART_RATE_HEADER_ALIASES);

  if (dateIndex < 0 || typeIndex < 0) {
    throw new Error("Garmin CSV headers must include Date and Activity Type columns.");
  }

  const runMilesAccum: Record<IsoDateString, number> = {};
  const runSummariesByDate: Record<IsoDateString, RunSummaryAccumulator> = {};
  const workoutByDate: Record<IsoDateString, boolean> = {};
  const otherByDate: Record<IsoDateString, boolean> = {};

  rows.slice(1).forEach((columns, index) => {
    const lineNumber = index + 2;
    const dateRaw = (columns[dateIndex] ?? "").trim();
    const typeRaw = (columns[typeIndex] ?? "").trim();

    if (!dateRaw || !typeRaw) {
      return;
    }

    const isoDate = parseGarminDate(dateRaw, lineNumber);
    const bucket = classifyActivity(typeRaw);

    if (bucket === "run") {
      const distanceRaw = distanceIndex >= 0 ? (columns[distanceIndex] ?? "").trim() : "";
      const distanceMiles = parseDistanceMiles(distanceRaw, headers[distanceIndex] ?? "");
      runMilesAccum[isoDate] = (runMilesAccum[isoDate] ?? 0) + distanceMiles;
      const paceRaw = paceIndex >= 0 ? (columns[paceIndex] ?? "").trim() : "";
      const heartRateRaw = heartRateIndex >= 0 ? (columns[heartRateIndex] ?? "").trim() : "";
      const paceMinutesPerMile = parsePaceMinutesPerMile(paceRaw);
      const averageHeartRate = parseHeartRateBpm(heartRateRaw);
      if (!runSummariesByDate[isoDate]) {
        runSummariesByDate[isoDate] = {
          miles: 0,
          weightedPaceMinutesTotal: 0,
          paceMilesTotal: 0,
          weightedHeartRateTotal: 0,
          heartRateMilesTotal: 0
        };
      }

      const summary = runSummariesByDate[isoDate];
      summary.miles += distanceMiles;
      if (paceMinutesPerMile != null && distanceMiles > 0) {
        summary.weightedPaceMinutesTotal += paceMinutesPerMile * distanceMiles;
        summary.paceMilesTotal += distanceMiles;
      }
      if (averageHeartRate != null && distanceMiles > 0) {
        summary.weightedHeartRateTotal += averageHeartRate * distanceMiles;
        summary.heartRateMilesTotal += distanceMiles;
      }
      return;
    }

    if (bucket === "workout") {
      workoutByDate[isoDate] = true;
      return;
    }

    otherByDate[isoDate] = true;
  });

  const runMilesByDate = Object.fromEntries(
    Object.entries(runMilesAccum).map(([isoDate, miles]) => [isoDate, roundToTenth(miles)])
  );
  const runDescriptionByDate = Object.fromEntries(
    Object.entries(runSummariesByDate).map(([isoDate, summary]) => [
      isoDate,
      buildCompletedRunDescription(
        roundToTenth(summary.miles),
        summary.paceMilesTotal > 0 ? summary.weightedPaceMinutesTotal / summary.paceMilesTotal : null,
        summary.heartRateMilesTotal > 0 ? summary.weightedHeartRateTotal / summary.heartRateMilesTotal : null
      )
    ])
  );

  return {
    runMilesByDate,
    runDescriptionByDate,
    workoutByDate,
    otherByDate
  };
}

function classifyActivity(raw: string): ActivityBucket {
  const value = raw.trim().toLowerCase();

  if (/(^|[^a-z])(run|running|jog|treadmill running|trail running|virtual run|track run)([^a-z]|$)/.test(value)) {
    return "run";
  }

  if (/(strength|weight|lifting|resistance|hiit|crossfit|pilates|yoga|workout)/.test(value)) {
    return "workout";
  }

  return "other";
}

function parseGarminDate(raw: string, lineNumber: number): IsoDateString {
  const value = raw.trim();

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const monthNameMatch = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);
  if (monthNameMatch) {
    const [, monthText, dayText, yearText] = monthNameMatch;
    const monthIndex = monthNameToNumber(monthText);
    if (monthIndex > 0) {
      return `${yearText}-${String(monthIndex).padStart(2, "0")}-${dayText.padStart(2, "0")}`;
    }
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) {
    throw new Error(`Line ${lineNumber}: unsupported date format "${raw}".`);
  }
  return toIsoDate(fallback);
}

function parseDistanceMiles(distanceRaw: string, distanceHeader: string): number {
  if (!distanceRaw) {
    return 0;
  }

  const normalizedHeader = normalizeHeader(distanceHeader);
  const numericText = distanceRaw.replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0] ?? "";
  const distance = Number(numericText);

  if (!Number.isFinite(distance) || distance < 0) {
    return 0;
  }

  if (normalizedHeader.includes("(km)") || normalizedHeader.endsWith(" km") || /\bkm\b/.test(distanceRaw.toLowerCase())) {
    return distance * 0.621371;
  }

  if (normalizedHeader.includes("(m)") || /\bm\b/.test(distanceRaw.toLowerCase())) {
    return distance * 0.000621371;
  }

  return distance;
}

function parsePaceMinutesPerMile(paceRaw: string): number | null {
  const value = paceRaw.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) {
    return null;
  }

  const minutes = Number(timeMatch[1]) + Number(timeMatch[2]) / 60;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  if (/\bkm\b/.test(value)) {
    return minutes * 1.60934;
  }

  return minutes;
}

function parseHeartRateBpm(heartRateRaw: string): number | null {
  const numericText = heartRateRaw.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0] ?? "";
  const bpm = Number(numericText);
  if (!Number.isFinite(bpm) || bpm <= 0) {
    return null;
  }
  return bpm;
}

function buildCompletedRunDescription(miles: number, paceMinutesPerMile: number | null, averageHeartRate: number | null): string {
  const details: string[] = [`Completed run: ${formatMiles(miles)} mi`];
  if (paceMinutesPerMile != null) {
    details.push(`Pace ${formatPacePerMile(paceMinutesPerMile)}/mi`);
  }
  if (averageHeartRate != null) {
    details.push(`Avg HR ${Math.round(averageHeartRate)} bpm`);
  }
  return details.join(" | ");
}

function formatMiles(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPacePerMile(minutesPerMile: number): string {
  const totalSeconds = Math.max(0, Math.round(minutesPerMile * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function monthNameToNumber(monthText: string): number {
  const month = monthText.slice(0, 3).toLowerCase();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return months.indexOf(month) + 1;
}

function findDistanceHeaderIndex(headers: string[]): number {
  const exact = findHeaderIndex(headers, DISTANCE_HEADER_ALIASES);
  if (exact >= 0) {
    return exact;
  }
  return headers.findIndex((header) => header.startsWith("distance "));
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      if (row.some((part) => part.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((part) => part.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}
