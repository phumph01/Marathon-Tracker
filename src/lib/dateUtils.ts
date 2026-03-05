import type { IsoDateString } from "../types/schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

export const MONDAY_FIRST_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function toIsoDate(date: Date): IsoDateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(iso: IsoDateString): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(startOfDay(date).getTime() + days * DAY_MS);
}

export function getWeekStartMonday(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export function getWeekStartIso(date: Date): IsoDateString {
  return toIsoDate(getWeekStartMonday(date));
}

export function normalizeWeekStartIso(weekStartIso: IsoDateString): IsoDateString {
  return getWeekStartIso(fromIsoDate(weekStartIso));
}

export function getWeekDates(weekStartIso: IsoDateString): IsoDateString[] {
  const start = fromIsoDate(normalizeWeekStartIso(weekStartIso));
  return Array.from({ length: 7 }, (_, index) => toIsoDate(addDays(start, index)));
}

export function getMonthGridAnchor(monthDate: Date): Date {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  return getWeekStartMonday(firstOfMonth);
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatWeekRange(weekStartIso: IsoDateString): string {
  const start = fromIsoDate(normalizeWeekStartIso(weekStartIso));
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

