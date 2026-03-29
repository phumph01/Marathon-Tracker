import type { MileSplitPoint } from "./runMileSplits";

export interface ActivityCsvImport {
  totalMiles: number;
  runDescription: string;
  splitPoints: MileSplitPoint[];
}

/** Keys after normalizeHeaderKey — order is most-specific first where it matters. */
const LAPS_HEADER_KEYS = ["laps", "lap"];
const DISTANCE_HEADER_KEYS = ["distancemi", "distancekm", "distancem", "distance"];
const PACE_HEADER_KEYS = [
  "avgpacemin/mi",
  "avgpace",
  "avgmovingpacemin/mi",
  "movingpacemin/mi",
  "pace",
  "movingpace"
];
const HEART_RATE_HEADER_KEYS = ["avghrbpm", "avgheartrate", "avghr", "heartrate"];

export function parseActivityCsv(csvText: string): ActivityCsvImport {
  const rows = parseCsvRows(stripUtf8Bom(csvText));
  if (rows.length < 2) {
    throw new Error("Activity CSV must include a header row and at least one lap row.");
  }

  const headers = rows[0];
  const headerKeys = headers.map(normalizeHeaderKey);
  const lapsIndex = findHeaderIndexByKeys(headerKeys, LAPS_HEADER_KEYS);
  const distanceIndex = findHeaderIndexByKeys(headerKeys, DISTANCE_HEADER_KEYS);
  const paceIndex = findHeaderIndexByKeys(headerKeys, PACE_HEADER_KEYS);
  const heartRateIndex = findHeaderIndexByKeys(headerKeys, HEART_RATE_HEADER_KEYS);

  if (lapsIndex < 0 || distanceIndex < 0) {
    throw new Error("Activity CSV is missing required Laps/Distance columns.");
  }

  const lapRows = rows
    .slice(1)
    .map((row) => ({
      lapLabel: (row[lapsIndex] ?? "").trim(),
      distanceRaw: (row[distanceIndex] ?? "").trim(),
      paceRaw: paceIndex >= 0 ? (row[paceIndex] ?? "").trim() : "",
      heartRateRaw: heartRateIndex >= 0 ? (row[heartRateIndex] ?? "").trim() : ""
    }))
    .filter((row) => row.lapLabel.length > 0 && row.lapLabel.toLowerCase() !== "summary");

  if (lapRows.length === 0) {
    throw new Error("No lap rows found in activity CSV.");
  }

  const splitPoints: MileSplitPoint[] = [];
  let totalMiles = 0;
  let weightedPaceSecondsTotal = 0;
  let weightedHeartRateTotal = 0;
  let weightedHeartRateMiles = 0;

  lapRows.forEach((lap) => {
    const distance = parseDistanceMiles(lap.distanceRaw);
    if (distance <= 0) {
      return;
    }

    const paceSecondsPerMile = parsePaceSeconds(lap.paceRaw);
    const heartRateBpm = parseHeartRate(lap.heartRateRaw);

    totalMiles += distance;
    if (paceSecondsPerMile != null) {
      weightedPaceSecondsTotal += paceSecondsPerMile * distance;
    }
    if (heartRateBpm != null) {
      weightedHeartRateTotal += heartRateBpm * distance;
      weightedHeartRateMiles += distance;
    }

    if (paceSecondsPerMile != null && heartRateBpm != null) {
      splitPoints.push({
        mileIndex: splitPoints.length + 1,
        paceSecondsPerMile,
        heartRateBpm
      });
    }
  });

  const roundedMiles = roundToTenth(totalMiles);
  const averagePaceSeconds = totalMiles > 0 ? weightedPaceSecondsTotal / totalMiles : null;
  const averageHeartRate = weightedHeartRateMiles > 0 ? weightedHeartRateTotal / weightedHeartRateMiles : null;

  const runDescription = buildCompletedRunDescription(roundedMiles, averagePaceSeconds, averageHeartRate);
  return {
    totalMiles: roundedMiles,
    runDescription,
    splitPoints
  };
}

function buildCompletedRunDescription(
  miles: number,
  averagePaceSecondsPerMile: number | null,
  averageHeartRate: number | null
): string {
  const details: string[] = [`Completed run: ${formatMiles(miles)} mi`];
  if (averagePaceSecondsPerMile != null && averagePaceSecondsPerMile > 0) {
    details.push(`Pace ${formatPace(averagePaceSecondsPerMile)}/mi`);
  }
  if (averageHeartRate != null && averageHeartRate > 0) {
    details.push(`Avg HR ${Math.round(averageHeartRate)} bpm`);
  }
  return details.join(" | ");
}

function parseDistanceMiles(raw: string): number {
  const parsed = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function parsePaceSeconds(raw: string): number | null {
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseHeartRate(raw: string): number | null {
  const parsed = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function formatMiles(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPace(secondsPerMile: number): string {
  const total = Math.max(0, Math.round(secondsPerMile));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Garmin and exports often split header text across lines inside quotes (e.g. "Distance\\nmi").
 * Collapse all whitespace and compare a spaceless, lowercase key so old one-line headers
 * ("Distancemi", "Avg Pacemin/mi") and new multi-line headers match the same keys.
 */
function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
}

function findHeaderIndexByKeys(headerKeys: string[], candidateKeys: string[]): number {
  for (const candidate of candidateKeys) {
    const idx = headerKeys.findIndex((key) => key === candidate);
    if (idx >= 0) {
      return idx;
    }
  }
  return -1;
}

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
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
