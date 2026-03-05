import { useRef, useState, type MouseEvent } from "react";
import { MONDAY_FIRST_DAY_LABELS, fromIsoDate, getWeekDates } from "../lib/dateUtils";
import { RunSplitMiniChart } from "./RunSplitMiniChart";
import type { MileSplitPoint } from "../lib/runMileSplits";

interface WeeklyActualDataRow {
  weekStartIso: string;
  dayActuals: Array<number | null>;
  totalActualMiles: number;
  avgPaceSecondsPerMile: number | null;
  mileageDelta: number | null;
  paceDeltaSeconds: number | null;
}

interface ActualDataSectionProps {
  rows: WeeklyActualDataRow[];
  runSplitsByDate: Record<string, MileSplitPoint[]>;
  showTargetPaceOverlay?: boolean;
  targetPaceSecondsPerMile?: number;
}

interface HoverState {
  x: number;
  y: number;
  title: string;
  metricLabel: string;
  metricValue: string;
  runSplits: MileSplitPoint[];
}

export function ActualDataSection({
  rows,
  runSplitsByDate,
  showTargetPaceOverlay = false,
  targetPaceSecondsPerMile = 390
}: ActualDataSectionProps): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  const showHover = (
    event: MouseEvent<HTMLElement>,
    payload: Omit<HoverState, "x" | "y">
  ): void => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const rect = wrap.getBoundingClientRect();
    setHoverState({
      ...payload,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Data</h2>
      </div>
      <div className="actualDataTableWrap" ref={wrapRef} onMouseLeave={() => setHoverState(null)}>
        <table className="actualDataTable">
          <thead>
            <tr>
              <th>Week</th>
              {MONDAY_FIRST_DAY_LABELS.map((label) => (
                <th key={label}>{label}</th>
              ))}
              <th>Total</th>
              <th>Avg Pace</th>
              <th>Mi Change</th>
              <th>Pace Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const weekLabel = formatWeekLabel(row.weekStartIso);
              const weekDates = getWeekDates(row.weekStartIso);
              const weeklyTotalLabel = formatMiles(row.totalActualMiles);
              const avgPaceLabel =
                row.avgPaceSecondsPerMile == null ? "--" : `${formatPace(row.avgPaceSecondsPerMile)}/mi`;

              return (
                <tr key={row.weekStartIso}>
                  <td>{weekLabel}</td>
                  {row.dayActuals.map((value, index) => {
                    const dayDate = fromIsoDate(weekDates[index]);
                    const dayDateLabel = dayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    const actualLabel = value == null ? "--" : formatMiles(value);
                    return (
                      <td
                        key={`${row.weekStartIso}-${index}`}
                        className="actualDataPointCell"
                        onMouseMove={(event) =>
                          showHover(event, {
                            title: `${MONDAY_FIRST_DAY_LABELS[index]} ${dayDateLabel}`,
                            metricLabel: "Actual",
                            metricValue: actualLabel,
                            runSplits: runSplitsByDate[weekDates[index]] ?? []
                          })
                        }
                      >
                        {actualLabel}
                      </td>
                    );
                  })}
                  <td
                    className="actualDataPointCell"
                    onMouseMove={(event) =>
                      showHover(event, {
                        title: "Week Total",
                        metricLabel: "Actual",
                        metricValue: weeklyTotalLabel,
                        runSplits: []
                      })
                    }
                  >
                    {weeklyTotalLabel}
                  </td>
                  <td
                    className="actualDataPointCell"
                    onMouseMove={(event) =>
                      showHover(event, {
                        title: "Week Average Pace",
                        metricLabel: "Pace",
                        metricValue: avgPaceLabel,
                        runSplits: []
                      })
                    }
                  >
                    {avgPaceLabel}
                  </td>
                  <td>
                    {row.mileageDelta == null ? (
                      "--"
                    ) : (
                      <span className={`cellDeltaValue ${row.mileageDelta >= 0 ? "deltaPositive" : "deltaNegative"}`}>
                        {row.mileageDelta >= 0 ? "▲" : "▼"} {formatMiles(Math.abs(row.mileageDelta))}
                      </span>
                    )}
                  </td>
                  <td>
                    {row.paceDeltaSeconds == null ? (
                      "--"
                    ) : (
                      <span className={`cellDeltaValue ${row.paceDeltaSeconds >= 0 ? "deltaPositive" : "deltaNegative"}`}>
                        {row.paceDeltaSeconds >= 0 ? "▲" : "▼"} {formatPace(Math.abs(row.paceDeltaSeconds))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hoverState ? (
          <div
            className="chartHoverBox"
            style={{
              left: `${hoverState.x + 12}px`,
              top: `${Math.max(8, hoverState.y - 78)}px`
            }}
          >
            <p className="chartHoverTitle">{hoverState.title}</p>
            <p>
              {hoverState.metricLabel}: {hoverState.metricValue}
            </p>
            {hoverState.runSplits.length > 0 ? (
              <RunSplitMiniChart
                splits={hoverState.runSplits}
                showTargetPaceOverlay={showTargetPaceOverlay}
                targetPaceSecondsPerMile={targetPaceSecondsPerMile}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatWeekLabel(weekStartIso: string): string {
  const dates = getWeekDates(weekStartIso);
  const start = fromIsoDate(dates[0]);
  const end = fromIsoDate(dates[6]);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function formatMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPace(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type { WeeklyActualDataRow };
