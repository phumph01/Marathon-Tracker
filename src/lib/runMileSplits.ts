export interface MileSplitPoint {
  mileIndex: number;
  paceSecondsPerMile: number;
  heartRateBpm: number;
}

export type RunSplitsByDate = Record<string, MileSplitPoint[]>;

const REQUIRED_HEADERS = [
  "split_start_time",
  "split_distance_miles",
  "avg_heart_rate_bpm",
  "pace_mm_ss_per_mile"
] as const;

export function parseRunMileSplits(csvText: string): RunSplitsByDate {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {};
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const headerIndex: Record<string, number> = {};
  headers.forEach((header, index) => {
    headerIndex[header] = index;
  });

  const hasRequired = REQUIRED_HEADERS.every((header) => Number.isInteger(headerIndex[header]));
  if (!hasRequired) {
    throw new Error("run_mile_splits.csv is missing required columns.");
  }

  const byDate: Record<string, Array<{ time: string; pace: number; hr: number }>> = {};

  rows.slice(1).forEach((columns) => {
    const startRaw = (columns[headerIndex.split_start_time] ?? "").trim();
    const distanceRaw = (columns[headerIndex.split_distance_miles] ?? "").trim();
    const hrRaw = (columns[headerIndex.avg_heart_rate_bpm] ?? "").trim();
    const paceRaw = (columns[headerIndex.pace_mm_ss_per_mile] ?? "").trim();
    if (!startRaw || !paceRaw || !hrRaw) {
      return;
    }

    const isoDate = parseDateToIso(startRaw);
    if (!isoDate) {
      return;
    }

    const distance = Number(distanceRaw);
    if (!Number.isFinite(distance) || distance <= 0) {
      return;
    }

    const paceSeconds = parsePaceSeconds(paceRaw);
    const hr = Number(hrRaw);
    if (!Number.isFinite(paceSeconds) || paceSeconds <= 0 || !Number.isFinite(hr) || hr <= 0) {
      return;
    }

    if (!byDate[isoDate]) {
      byDate[isoDate] = [];
    }
    byDate[isoDate].push({
      time: startRaw,
      pace: paceSeconds,
      hr
    });
  });

  const result: RunSplitsByDate = {};
  Object.keys(byDate).forEach((isoDate) => {
    const sorted = byDate[isoDate].sort((a, b) => a.time.localeCompare(b.time));
    result[isoDate] = sorted.map((entry, index) => ({
      mileIndex: index + 1,
      paceSecondsPerMile: entry.pace,
      heartRateBpm: Math.round(entry.hr)
    }));
  });

  return result;
}

function parseDateToIso(startTimeRaw: string): string | null {
  const match = startTimeRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parsePaceSeconds(paceRaw: string): number {
  const match = paceRaw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return NaN;
  }
  return Number(match[1]) * 60 + Number(match[2]);
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
