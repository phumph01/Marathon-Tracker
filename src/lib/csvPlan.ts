import { addDays, getWeekStartIso, toIsoDate } from "./dateUtils";
import type { IsoDateString, TrainingSchedule, TrainingWeek } from "../types/schedule";

interface ParsedRow {
  date: string;
  miles: number;
  description: string;
}

interface HeaderMap {
  date: number;
  miles: number;
  description: number;
}

const DATE_HEADER_ALIASES = ["date", "day"];
const MILES_HEADER_ALIASES = ["miles", "mile", "distance"];
const DESCRIPTION_HEADER_ALIASES = ["description", "execution strategy", "notes", "run description"];

export function parseCsvPlan(csvText: string, planName = "Uploaded Plan"): TrainingSchedule {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = rows[0].map(normalizeHeader);
  const headerMap = buildHeaderMap(headers);
  const parsedRows = rows.slice(1).map((columns, index) => parseRow(columns, headerMap, index + 2));

  return buildScheduleFromRows(parsedRows, planName);
}

function parseRow(columns: string[], headerMap: HeaderMap, lineNumber: number): ParsedRow {
  const dateRaw = (columns[headerMap.date] ?? "").trim();
  const milesRaw = (columns[headerMap.miles] ?? "").trim();
  const descriptionRaw = (columns[headerMap.description] ?? "").trim();

  if (!dateRaw) {
    throw new Error(`Line ${lineNumber}: missing date value.`);
  }
  if (!milesRaw) {
    throw new Error(`Line ${lineNumber}: missing miles value.`);
  }

  const miles = Number(milesRaw);
  if (!Number.isFinite(miles) || miles < 0) {
    throw new Error(`Line ${lineNumber}: invalid miles "${milesRaw}".`);
  }

  return {
    date: dateRaw,
    miles,
    description: descriptionRaw
  };
}

function buildScheduleFromRows(rows: ParsedRow[], name: string): TrainingSchedule {
  const plannedMilesByDate: Record<IsoDateString, number> = {};
  const descriptionByDate: Record<IsoDateString, string> = {};

  const firstYear = new Date().getFullYear();
  let currentYear = firstYear;
  let lastMonth = -1;

  rows.forEach((row) => {
    const parsedDate = parseDate(row.date, currentYear);
    if (lastMonth !== -1 && parsedDate.getMonth() < lastMonth) {
      currentYear += 1;
      const rolled = parseDate(row.date, currentYear);
      plannedMilesByDate[toIsoDate(rolled)] = row.miles;
      descriptionByDate[toIsoDate(rolled)] = row.description;
      lastMonth = rolled.getMonth();
      return;
    }

    plannedMilesByDate[toIsoDate(parsedDate)] = row.miles;
    descriptionByDate[toIsoDate(parsedDate)] = row.description;
    lastMonth = parsedDate.getMonth();
  });

  const weeks = buildWeeksFromDateMap(plannedMilesByDate);

  return {
    name,
    weeks,
    plannedMilesByDate,
    descriptionByDate
  };
}

function buildWeeksFromDateMap(plannedMilesByDate: Record<IsoDateString, number>): TrainingWeek[] {
  const sortedDates = Object.keys(plannedMilesByDate).sort();
  if (sortedDates.length === 0) {
    return [];
  }

  const startDate = parseIso(sortedDates[0]);
  const endDate = parseIso(sortedDates[sortedDates.length - 1]);
  let cursor = parseIso(getWeekStartIso(startDate));

  const weeks: TrainingWeek[] = [];

  while (cursor <= endDate) {
    const weekStartIso = toIsoDate(cursor);
    const dailyMiles = Array.from({ length: 7 }, (_, dayOffset) => {
      const isoDate = toIsoDate(addDays(cursor, dayOffset));
      return plannedMilesByDate[isoDate] ?? 0;
    });
    weeks.push({ weekStart: weekStartIso, dailyMiles });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseDate(raw: string, fallbackYear: number): Date {
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+\([A-Za-z]{3}\))?$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const monthDayMatch = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+\([A-Za-z]{3}\))?$/);
  if (monthDayMatch) {
    const [, monthText, dayText] = monthDayMatch;
    const month = monthNameToIndex(monthText);
    if (month === -1) {
      throw new Error(`Invalid month in date "${raw}".`);
    }
    return new Date(fallbackYear, month, Number(dayText));
  }

  throw new Error(`Unsupported date format "${raw}". Use YYYY-MM-DD, YYYY-MM-DD (Day), or Mon DD.`);
}

function monthNameToIndex(monthText: string): number {
  const month = monthText.slice(0, 3).toLowerCase();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return months.indexOf(month);
}

function buildHeaderMap(headers: string[]): HeaderMap {
  const date = findHeaderIndex(headers, DATE_HEADER_ALIASES);
  const miles = findHeaderIndex(headers, MILES_HEADER_ALIASES);
  const description = findHeaderIndex(headers, DESCRIPTION_HEADER_ALIASES);

  if (date < 0 || miles < 0 || description < 0) {
    throw new Error("CSV headers must include date, miles, and description columns.");
  }

  return { date, miles, description };
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
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

