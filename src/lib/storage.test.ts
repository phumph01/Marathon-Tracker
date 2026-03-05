import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAppState, saveAppState, type PersistedAppState } from "./storage";

const sampleState: PersistedAppState = {
  activeSchedule: {
    name: "Saved Schedule",
    weeks: [
      { weekStart: "2026-03-02", dailyMiles: [4, 5, 6, 4, 3, 10, 4] }
    ],
    plannedMilesByDate: {
      "2026-03-02": 4,
      "2026-03-03": 5,
      "2026-03-04": 6,
      "2026-03-05": 4,
      "2026-03-06": 3,
      "2026-03-07": 10,
      "2026-03-08": 4
    },
    descriptionByDate: {
      "2026-03-02": "Easy run"
    }
  },
  actualsByDate: { "2026-03-02": 3.5 },
  completedRunDescriptionByDate: { "2026-03-02": "Completed run: 3.5 mi | Pace 8:25/mi | Avg HR 151 bpm" },
  weeklyTargetOverrides: { "2026-03-02": 36 },
  raceDateIso: "2026-10-11",
  workoutByDate: { "2026-03-02": true },
  otherByDate: { "2026-03-03": true },
  chartMode: "line",
  showActual: true,
  timeframe: "all",
  chartGranularity: "weekly",
  showTargetPaceOverlay: false,
  targetPaceSecondsPerMile: 390,
  uploadedRunSplitsByDate: {
    "2026-03-02": [
      { mileIndex: 1, paceSecondsPerMile: 500, heartRateBpm: 151 },
      { mileIndex: 2, paceSecondsPerMile: 490, heartRateBpm: 153 }
    ]
  },
  monthDateIso: "2026-03-01",
  selectedWeekStartIso: "2026-03-02"
};

function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn(() => null),
    get length() {
      return Object.keys(store).length;
    }
  } satisfies Storage;
}

describe("storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns null when there is no saved state", () => {
    vi.stubGlobal("window", { localStorage: createStorageMock() });
    expect(loadAppState()).toBeNull();
  });

  it("loads a saved state when version is valid", () => {
    const storage = createStorageMock();
    storage.setItem(
      "marathon-planner-state",
      JSON.stringify({
        version: 1,
        state: sampleState
      })
    );
    vi.stubGlobal("window", { localStorage: storage });

    const loaded = loadAppState();
    expect(loaded?.raceDateIso).toBe("2026-10-11");
    expect(loaded?.chartGranularity).toBe("weekly");
    expect(loaded?.activeSchedule.plannedMilesByDate["2026-03-02"]).toBe(4);
  });

  it("ignores saved state when version mismatches", () => {
    const storage = createStorageMock();
    storage.setItem(
      "marathon-planner-state",
      JSON.stringify({
        version: 99,
        state: sampleState
      })
    );
    vi.stubGlobal("window", { localStorage: storage });

    expect(loadAppState()).toBeNull();
  });

  it("saves state with debounce", () => {
    vi.useFakeTimers();
    const storage = createStorageMock();
    vi.stubGlobal("window", { localStorage: storage });

    saveAppState(sampleState);
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(221);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
