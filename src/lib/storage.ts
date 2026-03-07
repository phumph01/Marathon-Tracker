import { toIsoDate } from "./dateUtils";
import type { ProgressGranularity, WeeklyTimeframe } from "./weeklyProgress";
import type { ChartMode } from "../components/WeeklyProgressChart";
import type { MileSplitPoint } from "./runMileSplits";
import type { TrainingSchedule } from "../types/schedule";

const STORAGE_KEY = "marathon-planner-state";
const STORAGE_VERSION = 1;
const SAVE_DELAY_MS = 220;

export interface PersistedAppState {
  activeSchedule: TrainingSchedule;
  actualsByDate: Record<string, number>;
  completedRunDescriptionByDate: Record<string, string>;
  weeklyTargetOverrides: Record<string, number>;
  raceDateIso: string;
  workoutByDate: Record<string, boolean>;
  otherByDate: Record<string, boolean>;
  chartMode: ChartMode;
  showActual: boolean;
  timeframe: WeeklyTimeframe;
  chartGranularity: ProgressGranularity;
  showTargetPaceOverlay: boolean;
  targetPaceSecondsPerMile: number;
  uploadedRunSplitsByDate: Record<string, MileSplitPoint[]>;
  monthDateIso: string;
  selectedWeekStartIso: string;
}

interface PersistEnvelope {
  version: number;
  state: PersistedAppState;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let queuedEnvelope: PersistEnvelope | null = null;

export function loadAppState(): PersistedAppState | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistEnvelope>;
    if (parsed.version !== STORAGE_VERSION || !parsed.state) {
      return null;
    }
    return sanitizePersistedState(parsed.state);
  } catch {
    return null;
  }
}

export function saveAppState(state: PersistedAppState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const sanitized = sanitizePersistedState(state);
  if (!sanitized) {
    return;
  }

  queuedEnvelope = {
    version: STORAGE_VERSION,
    state: sanitized
  };

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    flushQueuedEnvelope(storage);
  }, SAVE_DELAY_MS);
}

export function flushAppState(state?: PersistedAppState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (state) {
    const sanitized = sanitizePersistedState(state);
    if (!sanitized) {
      return;
    }
    queuedEnvelope = {
      version: STORAGE_VERSION,
      state: sanitized
    };
  }

  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  flushQueuedEnvelope(storage);
}

function sanitizePersistedState(state: Partial<PersistedAppState>): PersistedAppState | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const activeSchedule = sanitizeSchedule(state.activeSchedule);
  const monthDateIso = sanitizeIsoDate(state.monthDateIso);
  const selectedWeekStartIso = sanitizeIsoDate(state.selectedWeekStartIso);
  const raceDateIso = sanitizeIsoDate(state.raceDateIso);
  const actualsByDate = sanitizeNumberRecord(state.actualsByDate);
  const completedRunDescriptionByDate = sanitizeStringRecord(state.completedRunDescriptionByDate);
  const weeklyTargetOverrides = sanitizeNumberRecord(state.weeklyTargetOverrides);
  const workoutByDate = sanitizeBooleanRecord(state.workoutByDate);
  const otherByDate = sanitizeBooleanRecord(state.otherByDate);
  const chartMode = state.chartMode === "bar" ? "bar" : "line";
  const showActual = Boolean(state.showActual);
  const timeframe = sanitizeTimeframe(state.timeframe);
  const chartGranularity = state.chartGranularity === "daily" ? "daily" : "weekly";
  const showTargetPaceOverlay = Boolean(state.showTargetPaceOverlay);
  const targetPaceSecondsPerMile = sanitizePositiveNumber(state.targetPaceSecondsPerMile, 390);
  const uploadedRunSplitsByDate = sanitizeRunSplitsRecord(state.uploadedRunSplitsByDate);

  if (!activeSchedule || !monthDateIso || !selectedWeekStartIso || !raceDateIso) {
    return null;
  }

  return {
    activeSchedule,
    actualsByDate,
    completedRunDescriptionByDate,
    weeklyTargetOverrides,
    raceDateIso,
    workoutByDate,
    otherByDate,
    chartMode,
    showActual,
    timeframe,
    chartGranularity,
    showTargetPaceOverlay,
    targetPaceSecondsPerMile,
    uploadedRunSplitsByDate,
    monthDateIso,
    selectedWeekStartIso
  };
}

function sanitizeSchedule(schedule: unknown): TrainingSchedule | null {
  if (!schedule || typeof schedule !== "object") {
    return null;
  }

  const value = schedule as Partial<TrainingSchedule>;
  const name = typeof value.name === "string" ? value.name : "Saved Plan";
  const plannedMilesByDate = sanitizeNumberRecord(value.plannedMilesByDate);
  const descriptionByDate = sanitizeStringRecord(value.descriptionByDate);
  if (Object.keys(plannedMilesByDate).length === 0) {
    return null;
  }
  const weekStarts = Object.keys(plannedMilesByDate)
    .map((isoDate) => getWeekStartFromIso(isoDate))
    .sort();
  const uniqueWeekStarts = Array.from(new Set(weekStarts));

  const weeks = uniqueWeekStarts.map((weekStart) => ({
    weekStart,
    dailyMiles: Array.from({ length: 7 }, (_, dayOffset) => {
      const isoDate = toIsoDate(addDaysFromIso(weekStart, dayOffset));
      return plannedMilesByDate[isoDate] ?? 0;
    })
  }));

  return {
    name,
    weeks,
    plannedMilesByDate,
    descriptionByDate
  };
}

function sanitizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function sanitizeTimeframe(value: unknown): WeeklyTimeframe {
  if (value === "4w" || value === "8w" || value === "12w") {
    return value;
  }
  return "all";
}

function sanitizePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function sanitizeNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      result[key] = raw;
    }
  });
  return result;
}

function sanitizeBooleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result: Record<string, boolean> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof raw === "boolean") {
      result[key] = raw;
    }
  });
  return result;
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof raw === "string") {
      result[key] = raw;
    }
  });
  return result;
}

function sanitizeRunSplitsRecord(value: unknown): Record<string, MileSplitPoint[]> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, MileSplitPoint[]> = {};
  Object.entries(value as Record<string, unknown>).forEach(([isoDate, rawSplits]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Array.isArray(rawSplits)) {
      return;
    }
    const sanitizedSplits = rawSplits
      .map((rawPoint, index) => {
        if (!rawPoint || typeof rawPoint !== "object") {
          return null;
        }
        const point = rawPoint as Partial<MileSplitPoint>;
        if (
          typeof point.paceSecondsPerMile !== "number" ||
          !Number.isFinite(point.paceSecondsPerMile) ||
          point.paceSecondsPerMile <= 0
        ) {
          return null;
        }
        if (typeof point.heartRateBpm !== "number" || !Number.isFinite(point.heartRateBpm) || point.heartRateBpm <= 0) {
          return null;
        }
        return {
          mileIndex: index + 1,
          paceSecondsPerMile: point.paceSecondsPerMile,
          heartRateBpm: point.heartRateBpm
        };
      })
      .filter((point): point is MileSplitPoint => point != null);

    if (sanitizedSplits.length > 0) {
      result[isoDate] = sanitizedSplits;
    }
  });

  return result;
}

function getWeekStartFromIso(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
}

function addDaysFromIso(isoDate: string, days: number): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return date;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function flushQueuedEnvelope(storage: Storage): void {
  const latest = queuedEnvelope;
  queuedEnvelope = null;
  if (!latest) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(latest));
  } catch {
    // Ignore quota or storage access failures.
  }
}
