import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ActivityUpload, type ActivityUploadPayload } from "./components/ActivityUpload";
import { ActualDataSection, type WeeklyActualDataRow } from "./components/ActualDataSection";
import { AuthPanel } from "./components/AuthPanel";
import { FitnessInsightsTab } from "./components/FitnessInsightsTab";
import { GarminUpload } from "./components/GarminUpload";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { PlanUpload } from "./components/PlanUpload";
import { WeeklyProgressChart, type ChartMode } from "./components/WeeklyProgressChart";
import { WeeklyPlanner } from "./components/WeeklyPlanner";
import { defaultSchedule } from "./data/defaultSchedule";
import { runSplitsByDate as defaultRunSplitsByDate } from "./data/runSplitsData";
import { addDays, fromIsoDate, getWeekDates, getWeekStartIso, toIsoDate } from "./lib/dateUtils";
import { redistributeWeekMiles } from "./lib/redistribute";
import { flushAppState, loadAppState, saveAppState, type PersistedAppState } from "./lib/storage";
import {
  getCurrentSession,
  importLocalStateToCloud,
  isOwnerSession,
  loadCloudState,
  saveCloudState,
  signInWithEmailPassword,
  signOutSession,
  subscribeAuthStateChanged
} from "./lib/cloudState";
import { getOwnerUid, isSupabaseConfigured } from "./lib/supabaseClient";
import {
  buildDailyProgress,
  buildWeeklyProgress,
  filterProgressByTimeframe,
  type ProgressGranularity,
  type WeeklyTimeframe
} from "./lib/weeklyProgress";
import type { TrainingSchedule } from "./types/schedule";
import type { MileSplitPoint } from "./lib/runMileSplits";

type MainTab = "graph" | "calendar" | "weekly" | "data" | "fitness";

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "graph", label: "Graph" },
  { key: "calendar", label: "Calendar" },
  { key: "weekly", label: "Weekly" },
  { key: "data", label: "Data" },
  { key: "fitness", label: "Fitness" }
];

function getOriginalWeekMiles(weekDates: string[], schedule: TrainingSchedule): number[] {
  return weekDates.map((isoDate) => schedule.plannedMilesByDate[isoDate] ?? 0);
}

function getDefaultTargetForWeek(weekDates: string[], schedule: TrainingSchedule): number {
  return getOriginalWeekMiles(weekDates, schedule).reduce((sum, miles) => sum + miles, 0);
}

function clampPositive(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function getDefaultRaceDate(schedule: TrainingSchedule): string {
  const scheduleDates = Object.keys(schedule.plannedMilesByDate).sort();
  if (scheduleDates.length === 0) {
    return new Date().toISOString().slice(0, 10);
  }
  return scheduleDates[scheduleDates.length - 1];
}

function formatPace(secondsPerMile: number): string {
  const safeSeconds = Math.max(0, Math.round(secondsPerMile));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parsePaceToSeconds(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
    return null;
  }
  return minutes * 60 + seconds;
}

function formatMilesValue(miles: number): string {
  const rounded = Math.round(Math.max(0, miles) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function mergeRunSplitsForDoubleRun(existingSplits: MileSplitPoint[], uploadedSplits: MileSplitPoint[]): MileSplitPoint[] {
  if (existingSplits.length === 0) {
    return uploadedSplits;
  }
  const normalizedExisting = existingSplits.map((split, index) => ({
    ...split,
    mileIndex: index + 1
  }));
  const normalizedUploaded = uploadedSplits.map((split, index) => ({
    ...split,
    mileIndex: normalizedExisting.length + index + 1
  }));
  return [...normalizedExisting, ...normalizedUploaded];
}

export default function App(): JSX.Element {
  const today = new Date();
  const todayIso = toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentWeekStartIso = getWeekStartIso(today);
  const hydratedState = useMemo(() => loadAppState(), []);
  const initialMonthDate = currentMonthStart;
  const initialSelectedWeekStartIso = currentWeekStartIso;
  const initialSchedule = hydratedState?.activeSchedule ?? defaultSchedule;
  const initialRaceDateIso = hydratedState?.raceDateIso ?? getDefaultRaceDate(initialSchedule);

  const [monthDate, setMonthDate] = useState(initialMonthDate);
  const [selectedWeekStartIso, setSelectedWeekStartIso] = useState(initialSelectedWeekStartIso);
  const [activeSchedule, setActiveSchedule] = useState<TrainingSchedule>(initialSchedule);
  const [chartMode, setChartMode] = useState<ChartMode>(hydratedState?.chartMode ?? "line");
  const [showActual, setShowActual] = useState(hydratedState?.showActual ?? true);
  const [timeframe, setTimeframe] = useState<WeeklyTimeframe>(hydratedState?.timeframe ?? "12w");
  const [chartGranularity, setChartGranularity] = useState<ProgressGranularity>(hydratedState?.chartGranularity ?? "weekly");
  const [raceDateIso, setRaceDateIso] = useState<string>(initialRaceDateIso);
  const [weeklyTargetOverrides, setWeeklyTargetOverrides] = useState<Record<string, number>>(hydratedState?.weeklyTargetOverrides ?? {});
  const [actualsByDate, setActualsByDate] = useState<Record<string, number>>(hydratedState?.actualsByDate ?? {});
  const [completedRunDescriptionByDate, setCompletedRunDescriptionByDate] = useState<Record<string, string>>(
    hydratedState?.completedRunDescriptionByDate ?? {}
  );
  const [workoutByDate, setWorkoutByDate] = useState<Record<string, boolean>>(hydratedState?.workoutByDate ?? {});
  const [otherByDate, setOtherByDate] = useState<Record<string, boolean>>(hydratedState?.otherByDate ?? {});
  const [showTargetPaceOverlay, setShowTargetPaceOverlay] = useState<boolean>(hydratedState?.showTargetPaceOverlay ?? false);
  const [targetPaceSecondsPerMile, setTargetPaceSecondsPerMile] = useState<number>(hydratedState?.targetPaceSecondsPerMile ?? 390);
  const [targetPaceInput, setTargetPaceInput] = useState<string>(formatPace(hydratedState?.targetPaceSecondsPerMile ?? 390));
  const [uploadedRunSplitsByDate, setUploadedRunSplitsByDate] = useState<Record<string, MileSplitPoint[]>>(
    hydratedState?.uploadedRunSplitsByDate ?? {}
  );
  const [pendingManualUploadMessage, setPendingManualUploadMessage] = useState<string | null>(null);
  const [manualUploadPersistedMessage, setManualUploadPersistedMessage] = useState<string>("");
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("weekly");
  const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(false);
  const [weeklyPreviewTargetOverrides, setWeeklyPreviewTargetOverrides] = useState<Record<string, number>>({});
  const [weeklyPreviewActualOverrides, setWeeklyPreviewActualOverrides] = useState<Record<string, number | null>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const [authStatus, setAuthStatus] = useState<string>("");
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const isOwner = isOwnerSession(session);
  const ownerUid = getOwnerUid();
  const cloudConfigured = isSupabaseConfigured();
  const isReadOnly = !isOwner;

  const weekDates = useMemo(() => getWeekDates(selectedWeekStartIso), [selectedWeekStartIso]);
  const originalPlannedWeek = useMemo(() => getOriginalWeekMiles(weekDates, activeSchedule), [activeSchedule, weekDates]);
  const persistedWeeklyTargetTotal =
    weeklyTargetOverrides[selectedWeekStartIso] ?? getDefaultTargetForWeek(weekDates, activeSchedule);
  const targetWeeklyTotal = weeklyPreviewTargetOverrides[selectedWeekStartIso] ?? persistedWeeklyTargetTotal;
  const resolvedWeeklyActualByDate = useMemo(() => {
    const next: Record<string, number> = {};
    weekDates.forEach((isoDate) => {
      const override = weeklyPreviewActualOverrides[isoDate];
      if (override === null) {
        return;
      }
      if (typeof override === "number" && Number.isFinite(override)) {
        next[isoDate] = override;
        return;
      }
      const persisted = actualsByDate[isoDate];
      if (Number.isFinite(persisted)) {
        next[isoDate] = persisted;
      }
    });
    return next;
  }, [actualsByDate, weekDates, weeklyPreviewActualOverrides]);
  const completedActuals = weekDates.map((isoDate) => {
    const value = resolvedWeeklyActualByDate[isoDate];
    return Number.isFinite(value) ? value : null;
  });

  const redistributed = useMemo(
    () =>
      redistributeWeekMiles({
        plannedWeek: originalPlannedWeek,
        completedActuals,
        targetWeeklyTotal
      }),
    [completedActuals, originalPlannedWeek, targetWeeklyTotal]
  );

  const displayDescriptionByDate = useMemo(
    () => ({
      ...activeSchedule.descriptionByDate,
      ...completedRunDescriptionByDate
    }),
    [activeSchedule.descriptionByDate, completedRunDescriptionByDate]
  );
  const mergedRunSplitsByDate = useMemo(
    () => ({
      ...defaultRunSplitsByDate,
      ...uploadedRunSplitsByDate
    }),
    [uploadedRunSplitsByDate]
  );
  const effectiveActualsByDate = useMemo(() => {
    const next: Record<string, number> = { ...actualsByDate };
    Object.entries(mergedRunSplitsByDate).forEach(([isoDate, splits]) => {
      if (Number.isFinite(next[isoDate])) {
        return;
      }
      const splitMiles = splits.length;
      if (splitMiles > 0) {
        next[isoDate] = splitMiles;
      }
    });
    return next;
  }, [actualsByDate, mergedRunSplitsByDate]);
  const weeklyProgress = useMemo(
    () => buildWeeklyProgress(activeSchedule, effectiveActualsByDate),
    [activeSchedule, effectiveActualsByDate]
  );
  const dailyProgress = useMemo(
    () => buildDailyProgress(activeSchedule, effectiveActualsByDate),
    [activeSchedule, effectiveActualsByDate]
  );
  const chartSourceData = chartGranularity === "daily" ? dailyProgress : weeklyProgress;
  const progressVisible = useMemo(
    () => filterProgressByTimeframe(chartSourceData, timeframe, chartGranularity, todayIso),
    [chartGranularity, chartSourceData, timeframe, todayIso]
  );
  const weeklyActualDataRows = useMemo(
    () => buildWeeklyActualDataRows(weeklyProgress, mergedRunSplitsByDate, effectiveActualsByDate, todayIso),
    [weeklyProgress, mergedRunSplitsByDate, effectiveActualsByDate, todayIso]
  );
  const persistedState = useMemo(
    () => ({
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
      monthDateIso: toIsoDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)),
      selectedWeekStartIso
    }),
    [
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
      monthDate,
      selectedWeekStartIso
    ]
  );

  const applyPersistedState = (state: PersistedAppState): void => {
    setActiveSchedule(state.activeSchedule);
    setActualsByDate(state.actualsByDate);
    setCompletedRunDescriptionByDate(state.completedRunDescriptionByDate);
    setWeeklyTargetOverrides(state.weeklyTargetOverrides);
    setRaceDateIso(state.raceDateIso);
    setWorkoutByDate(state.workoutByDate);
    setOtherByDate(state.otherByDate);
    setChartMode(state.chartMode);
    setShowActual(state.showActual);
    setTimeframe("12w");
    setChartGranularity(state.chartGranularity);
    setShowTargetPaceOverlay(state.showTargetPaceOverlay);
    setTargetPaceSecondsPerMile(state.targetPaceSecondsPerMile);
    setTargetPaceInput(formatPace(state.targetPaceSecondsPerMile));
    setUploadedRunSplitsByDate(state.uploadedRunSplitsByDate);
    // Always start users at the current month/week on app open.
    setMonthDate(currentMonthStart);
    setSelectedWeekStartIso(currentWeekStartIso);
  };

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeAuthStateChanged((_event, nextSession) => {
      if (!cancelled) {
        setSession(nextSession);
      }
    });
    void (async () => {
      try {
        const currentSession = await getCurrentSession();
        if (!cancelled) {
          setSession(currentSession);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Failed to initialize auth session.");
        }
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cloudState = await loadCloudState();
        if (!cancelled && cloudState) {
          applyPersistedState(cloudState);
          setAuthStatus("Loaded cloud data.");
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Failed to load cloud data.");
        }
      } finally {
        if (!cancelled) {
          setCloudHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveAppState(persistedState);
  }, [persistedState]);

  useEffect(() => {
    const flushLatestState = (): void => {
      flushAppState(persistedState);
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        flushLatestState();
      }
    };
    window.addEventListener("beforeunload", flushLatestState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushLatestState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [persistedState]);

  useEffect(() => {
    if (!pendingManualUploadMessage) {
      return;
    }
    flushAppState(persistedState);
    setManualUploadPersistedMessage(`${pendingManualUploadMessage} ${isOwner ? "Saved to cloud." : "Saved on this device."}`);
    setPendingManualUploadMessage(null);
  }, [isOwner, pendingManualUploadMessage, persistedState]);

  useEffect(() => {
    if (hydratedState != null) {
      return;
    }
    flushAppState(persistedState);
  }, [hydratedState, persistedState]);

  useEffect(() => {
    if (!cloudConfigured || !cloudHydrated || !isOwner || !ownerUid) {
      return;
    }
    const saveTimeout = window.setTimeout(() => {
      void saveCloudState(persistedState, ownerUid).catch((error) => {
        setAuthError(error instanceof Error ? error.message : "Failed to save cloud state.");
      });
    }, 350);
    return () => window.clearTimeout(saveTimeout);
  }, [cloudConfigured, cloudHydrated, isOwner, ownerUid, persistedState]);

  const handleSignIn = async (email: string, password: string): Promise<void> => {
    setAuthError("");
    setAuthStatus("");
    try {
      await signInWithEmailPassword(email, password);
      setAuthStatus("Signed in.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign in failed.");
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setAuthError("");
    setAuthStatus("");
    try {
      await signOutSession();
      setAuthStatus("Signed out.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed.");
    }
  };

  const handleImportLocal = async (): Promise<void> => {
    if (!ownerUid) {
      setAuthError("Missing owner UID configuration.");
      return;
    }
    setAuthError("");
    setAuthStatus("");
    try {
      const result = await importLocalStateToCloud(persistedState, ownerUid);
      if (result === "imported") {
        setAuthStatus("Imported local data to cloud.");
      } else if (result === "merged") {
        setAuthStatus("Merged local upload data into cloud.");
      } else {
        setAuthStatus("No new local upload data to sync.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Failed to import local data.");
    }
  };

  return (
    <main className="appShell">
      <section className="panel topNavPanel">
        <div className="topNavRow">
          <div className="mainTabs" role="tablist" aria-label="Main views">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`mainTabButton bubbleInteractive ${activeMainTab === tab.key ? "active" : ""}`}
                role="tab"
                aria-selected={activeMainTab === tab.key}
                onClick={() => setActiveMainTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`utilitiesToggleButton bubbleInteractive ${isUtilitiesOpen ? "active" : ""}`}
            aria-expanded={isUtilitiesOpen}
            onClick={() => setIsUtilitiesOpen((current) => !current)}
          >
            Utilities
          </button>
        </div>
      </section>

      {isUtilitiesOpen ? (
        <section className="panel utilitiesPanel">
          <div className="panelHeader">
            <h2>Utilities</h2>
          </div>
          {isReadOnly ? <p className="readOnlyNotice">Read-only mode. Sign in as owner to upload or edit shared data.</p> : null}
          <div className="utilitiesGrid">
            <AuthPanel
              configured={cloudConfigured}
              isOwner={isOwner}
              userEmail={session?.user?.email ?? null}
              authError={authError}
              authStatus={authStatus}
              showImportLocal={cloudConfigured}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              onImportLocal={handleImportLocal}
            />
            <div className="utilityItem">
              <PlanUpload
                compact
                disabled={isReadOnly}
                onScheduleParsed={(uploadedSchedule) => {
                  if (isReadOnly) {
                    return;
                  }
                  const validDates = new Set(Object.keys(uploadedSchedule.plannedMilesByDate));
                  setActiveSchedule(uploadedSchedule);
                  setWeeklyTargetOverrides({});
                  setActualsByDate((current) => {
                    const next: Record<string, number> = {};
                    Object.keys(current).forEach((isoDate) => {
                      if (validDates.has(isoDate)) {
                        next[isoDate] = current[isoDate];
                      }
                    });
                    return next;
                  });
                  setCompletedRunDescriptionByDate((current) => {
                    const next: Record<string, string> = {};
                    Object.keys(current).forEach((isoDate) => {
                      if (validDates.has(isoDate)) {
                        next[isoDate] = current[isoDate];
                      }
                    });
                    return next;
                  });
                  setUploadedRunSplitsByDate((current) => {
                    const next: Record<string, MileSplitPoint[]> = {};
                    Object.keys(current).forEach((isoDate) => {
                      if (validDates.has(isoDate)) {
                        next[isoDate] = current[isoDate];
                      }
                    });
                    return next;
                  });

                  const scheduleDates = Object.keys(uploadedSchedule.plannedMilesByDate).sort();
                  if (scheduleDates.length > 0) {
                    setRaceDateIso(scheduleDates[scheduleDates.length - 1]);
                    const now = new Date();
                    setSelectedWeekStartIso(getWeekStartIso(now));
                    setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  }
                }}
              />
            </div>
            <div className="utilityItem">
              <GarminUpload
                compact
                disabled={isReadOnly}
                onActivitiesParsed={(garminData) => {
                  if (isReadOnly) {
                    return;
                  }
                  setActualsByDate((current) => {
                    const next = { ...current };
                    Object.entries(garminData.runMilesByDate).forEach(([isoDate, miles]) => {
                      next[isoDate] = clampPositive(miles);
                    });
                    return next;
                  });
                  setCompletedRunDescriptionByDate((current) => ({
                    ...current,
                    ...garminData.runDescriptionByDate
                  }));
                  setWorkoutByDate(garminData.workoutByDate);
                  setOtherByDate(garminData.otherByDate);
                }}
              />
            </div>
            <div className="utilityItem">
              <ActivityUpload
                compact
                disabled={isReadOnly}
                persistedStatusMessage={manualUploadPersistedMessage}
                onActivityParsed={({ selectedDateIso, doubleRun, parsed }: ActivityUploadPayload) => {
                  if (isReadOnly) {
                    return;
                  }
                  setManualUploadPersistedMessage("");
                  setActualsByDate((current) => {
                    const currentMiles = clampPositive(current[selectedDateIso] ?? 0);
                    const nextMiles = doubleRun ? currentMiles + parsed.totalMiles : parsed.totalMiles;
                    return {
                      ...current,
                      [selectedDateIso]: clampPositive(nextMiles)
                    };
                  });
                  setCompletedRunDescriptionByDate((current) => ({
                    ...current,
                    [selectedDateIso]: parsed.runDescription
                  }));
                  setUploadedRunSplitsByDate((current) => {
                    const existingSplits = current[selectedDateIso] ?? defaultRunSplitsByDate[selectedDateIso] ?? [];
                    return {
                      ...current,
                      [selectedDateIso]: doubleRun
                        ? mergeRunSplitsForDoubleRun(existingSplits, parsed.splitPoints)
                        : parsed.splitPoints
                    };
                  });
                  setPendingManualUploadMessage(
                    `Imported ${formatMilesValue(parsed.totalMiles)} miles for ${selectedDateIso} (${doubleRun ? "double run" : "replace"} mode).`
                  );
                }}
              />
            </div>
            <div className="utilityItem raceDatePanel utilityRaceSettings">
              <div className="utilityItemHeader">
                <h2>Race Settings</h2>
              </div>
              <div className="raceDateRow">
                <label htmlFor="raceDate">Race Date</label>
                <input
                  id="raceDate"
                  className="glassInput"
                  type="date"
                  disabled={isReadOnly}
                  value={raceDateIso}
                  onChange={(event) => {
                    if (isReadOnly) {
                      return;
                    }
                    setRaceDateIso(event.target.value);
                  }}
                />
              </div>
            </div>
            <div className="utilityItem">
              <div className="utilityItemHeader">
                <h2>Pace Overlay</h2>
              </div>
              <div className="paceOverlayControls">
                <label className="paceOverlayToggle">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={showTargetPaceOverlay}
                    onChange={(event) => {
                      if (isReadOnly) {
                        return;
                      }
                      setShowTargetPaceOverlay(event.target.checked);
                    }}
                  />
                  Show target pace line on split charts
                </label>
                <label className="paceInputLabel" htmlFor="targetPaceInput">
                  Target pace (mm:ss / mile)
                </label>
                <input
                  id="targetPaceInput"
                  className="glassInput"
                  type="text"
                  inputMode="numeric"
                  disabled={isReadOnly}
                  value={targetPaceInput}
                  onChange={(event) => {
                    if (isReadOnly) {
                      return;
                    }
                    setTargetPaceInput(event.target.value);
                  }}
                  onBlur={() => {
                    if (isReadOnly) {
                      return;
                    }
                    const parsed = parsePaceToSeconds(targetPaceInput);
                    if (parsed == null) {
                      setTargetPaceInput(formatPace(targetPaceSecondsPerMile));
                      return;
                    }
                    setTargetPaceSecondsPerMile(parsed);
                    setTargetPaceInput(formatPace(parsed));
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeMainTab === "graph" ? (
        <section className="panel">
          <div className="panelHeader">
            <h2>Mileage Progression</h2>
            <div className="chartControls">
              <div className="chartModeToggle" role="radiogroup" aria-label="Chart type toggle">
                <button
                  type="button"
                  className={`chartModeButton ${chartMode === "line" ? "active" : ""}`}
                  onClick={() => setChartMode("line")}
                  aria-pressed={chartMode === "line"}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`chartModeButton ${chartMode === "bar" ? "active" : ""}`}
                  onClick={() => setChartMode("bar")}
                  aria-pressed={chartMode === "bar"}
                >
                  Bar
                </button>
              </div>
              <div className="chartModeToggle" role="radiogroup" aria-label="Graph timeframe">
                <button
                  type="button"
                  className={`chartModeButton ${timeframe === "all" ? "active" : ""}`}
                  onClick={() => setTimeframe("all")}
                  aria-pressed={timeframe === "all"}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`chartModeButton ${timeframe === "4w" ? "active" : ""}`}
                  onClick={() => setTimeframe("4w")}
                  aria-pressed={timeframe === "4w"}
                >
                  4w
                </button>
                <button
                  type="button"
                  className={`chartModeButton ${timeframe === "8w" ? "active" : ""}`}
                  onClick={() => setTimeframe("8w")}
                  aria-pressed={timeframe === "8w"}
                >
                  8w
                </button>
                <button
                  type="button"
                  className={`chartModeButton ${timeframe === "12w" ? "active" : ""}`}
                  onClick={() => setTimeframe("12w")}
                  aria-pressed={timeframe === "12w"}
                >
                  12w
                </button>
              </div>
              <div className="chartModeToggle" role="radiogroup" aria-label="Point granularity">
                <button
                  type="button"
                  className={`chartModeButton ${chartGranularity === "weekly" ? "active" : ""}`}
                  onClick={() => setChartGranularity("weekly")}
                  aria-pressed={chartGranularity === "weekly"}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`chartModeButton ${chartGranularity === "daily" ? "active" : ""}`}
                  onClick={() => setChartGranularity("daily")}
                  aria-pressed={chartGranularity === "daily"}
                >
                  Daily
                </button>
              </div>
              <button
                type="button"
                className={`chartModeButton ${showActual ? "active" : ""}`}
                onClick={() => setShowActual((current) => !current)}
                aria-pressed={showActual}
              >
                Actual
              </button>
            </div>
          </div>
          <div className="chartLegend">
            <span className="legendChip planned">Planned</span>
            {showActual ? <span className="legendChip actual">Actual</span> : null}
          </div>
          <WeeklyProgressChart
            data={progressVisible}
            mode={chartMode}
            showActual={showActual}
            granularity={chartGranularity}
            referenceDateIso={todayIso}
            raceDateIso={raceDateIso}
            extendTrailingSpace={timeframe === "all"}
          />
        </section>
      ) : null}

      {activeMainTab === "calendar" ? (
        <MonthlyCalendar
          monthDate={monthDate}
          plannedMilesByDate={activeSchedule.plannedMilesByDate}
          actualsByDate={effectiveActualsByDate}
          descriptionByDate={displayDescriptionByDate}
          runSplitsByDate={mergedRunSplitsByDate}
          showTargetPaceOverlay={showTargetPaceOverlay}
          targetPaceSecondsPerMile={targetPaceSecondsPerMile}
          workoutByDate={workoutByDate}
          otherByDate={otherByDate}
          todayIso={todayIso}
          selectedWeekStart={selectedWeekStartIso}
          onMonthChange={(delta) =>
            setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
          }
          onSelectWeekStart={(weekStartIso) => setSelectedWeekStartIso(weekStartIso)}
        />
      ) : null}

      {activeMainTab === "weekly" ? (
        <WeeklyPlanner
          weekStartIso={selectedWeekStartIso}
          dayDates={weekDates}
          originalPlannedWeek={originalPlannedWeek}
          adjustedWeek={redistributed.adjustedWeek}
          actualsByDate={resolvedWeeklyActualByDate}
          descriptionByDate={displayDescriptionByDate}
          runSplitsByDate={mergedRunSplitsByDate}
          showTargetPaceOverlay={showTargetPaceOverlay}
          targetPaceSecondsPerMile={targetPaceSecondsPerMile}
          todayIso={todayIso}
          targetWeeklyTotal={targetWeeklyTotal}
          exceededByMiles={redistributed.exceededByMiles}
          canEditActualForDate={() => true}
          onPreviousWeek={() => {
            setSelectedWeekStartIso((current) => toIsoDate(addDays(fromIsoDate(current), -7)));
          }}
          onNextWeek={() => {
            setSelectedWeekStartIso((current) => toIsoDate(addDays(fromIsoDate(current), 7)));
          }}
          canEditWeeklyTarget
          isWhatIfMode
          onResetWhatIf={() => {
            setWeeklyPreviewTargetOverrides((current) => {
              if (!(selectedWeekStartIso in current)) {
                return current;
              }
              const next = { ...current };
              delete next[selectedWeekStartIso];
              return next;
            });
            setWeeklyPreviewActualOverrides((current) => {
              const next = { ...current };
              weekDates.forEach((isoDate) => {
                delete next[isoDate];
              });
              return next;
            });
          }}
          onTargetChange={(newTarget) => {
            setWeeklyPreviewTargetOverrides((current) => ({
              ...current,
              [selectedWeekStartIso]: clampPositive(newTarget)
            }));
          }}
          onActualChange={(isoDate, miles) => {
            setWeeklyPreviewActualOverrides((current) => {
              const next = { ...current };
              if (miles == null || !Number.isFinite(miles)) {
                next[isoDate] = null;
              } else {
                next[isoDate] = clampPositive(miles);
              }
              return next;
            });
          }}
        />
      ) : null}

      {activeMainTab === "data" ? (
        <ActualDataSection
          rows={weeklyActualDataRows}
          runSplitsByDate={mergedRunSplitsByDate}
          showTargetPaceOverlay={showTargetPaceOverlay}
          targetPaceSecondsPerMile={targetPaceSecondsPerMile}
        />
      ) : null}
      {activeMainTab === "fitness" ? (
        <FitnessInsightsTab
          weeklyProgress={weeklyProgress}
          runSplitsByDate={mergedRunSplitsByDate}
          actualsByDate={effectiveActualsByDate}
          raceDateIso={raceDateIso}
        />
      ) : null}
    </main>
  );
}

function buildWeeklyActualDataRows(
  weeklyPoints: Array<{ weekStart: string; actualTotal: number }>,
  splitsByDate: Record<string, MileSplitPoint[]>,
  actualsByDate: Record<string, number>,
  todayIso: string
): WeeklyActualDataRow[] {
  const todayWeekStartIso = getWeekStartIso(fromIsoDate(todayIso));
  const paceByWeek: Record<string, { totalSeconds: number; points: number }> = {};
  Object.entries(splitsByDate).forEach(([isoDate, splits]) => {
    const weekStartIso = getWeekStartIso(fromIsoDate(isoDate));
    if (!paceByWeek[weekStartIso]) {
      paceByWeek[weekStartIso] = { totalSeconds: 0, points: 0 };
    }
    splits.forEach((split) => {
      if (!Number.isFinite(split.paceSecondsPerMile) || split.paceSecondsPerMile <= 0) {
        return;
      }
      paceByWeek[weekStartIso].totalSeconds += split.paceSecondsPerMile;
      paceByWeek[weekStartIso].points += 1;
    });
  });
  const scheduleWeekStarts = weeklyPoints
    .map((point) => point.weekStart)
    .filter((weekStart) => weekStart <= todayWeekStartIso);
  const actualWeekStarts = Object.keys(actualsByDate)
    .map((isoDate) => getWeekStartIso(fromIsoDate(isoDate)))
    .filter((weekStart) => weekStart <= todayWeekStartIso);
  const splitWeekStarts = Object.keys(splitsByDate)
    .map((isoDate) => getWeekStartIso(fromIsoDate(isoDate)))
    .filter((weekStart) => weekStart <= todayWeekStartIso);
  const allWeekStarts = Array.from(new Set([...scheduleWeekStarts, ...actualWeekStarts, ...splitWeekStarts])).sort();

  const rowsChronological = allWeekStarts.map((weekStartIso) => {
    const dayActuals: Array<number | null> = getWeekDates(weekStartIso).map((isoDate) => {
      const value = actualsByDate[isoDate];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      const splitMiles = splitsByDate[isoDate]?.length ?? 0;
      return splitMiles > 0 ? splitMiles : null;
    });
    const totalActualMiles = dayActuals.reduce((sum: number, miles) => sum + (miles ?? 0), 0);
    const currentPaceStats = paceByWeek[weekStartIso];
    const averagePaceSecondsPerMile =
      currentPaceStats && currentPaceStats.points > 0 ? currentPaceStats.totalSeconds / currentPaceStats.points : null;
    return {
      weekStartIso,
      dayActuals,
      totalActualMiles,
      avgPaceSecondsPerMile: averagePaceSecondsPerMile
    };
  });

  return rowsChronological
    .map((row, index) => {
      const previousRow = index > 0 ? rowsChronological[index - 1] : null;
      return {
        weekStartIso: row.weekStartIso,
        dayActuals: row.dayActuals,
        totalActualMiles: row.totalActualMiles,
        mileageDelta: previousRow ? row.totalActualMiles - previousRow.totalActualMiles : null,
        avgPaceSecondsPerMile: row.avgPaceSecondsPerMile,
        // Positive means faster this week (lower pace is better).
        paceDeltaSeconds:
          previousRow?.avgPaceSecondsPerMile != null && row.avgPaceSecondsPerMile != null
            ? previousRow.avgPaceSecondsPerMile - row.avgPaceSecondsPerMile
            : null
      };
    })
    .reverse();
}

