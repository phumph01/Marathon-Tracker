import { useMemo, useState } from "react";
import { MONDAY_FIRST_DAY_LABELS, formatMonthYear, getMonthGridAnchor, sameMonth, toIsoDate } from "../lib/dateUtils";
import { RunSplitDetailModal } from "./RunSplitDetailModal";
import { RunSplitMiniChart } from "./RunSplitMiniChart";
import type { RunSplitsByDate } from "../lib/runMileSplits";

interface MonthlyCalendarProps {
  monthDate: Date;
  plannedMilesByDate: Record<string, number>;
  actualsByDate: Record<string, number>;
  descriptionByDate: Record<string, string>;
  runSplitsByDate: RunSplitsByDate;
  showTargetPaceOverlay: boolean;
  targetPaceSecondsPerMile: number;
  workoutByDate: Record<string, boolean>;
  otherByDate: Record<string, boolean>;
  todayIso: string;
  selectedWeekStart: string;
  onMonthChange: (delta: number) => void;
  onSelectWeekStart: (weekStartIso: string) => void;
}

export function MonthlyCalendar({
  monthDate,
  plannedMilesByDate,
  actualsByDate,
  descriptionByDate,
  runSplitsByDate,
  showTargetPaceOverlay,
  targetPaceSecondsPerMile,
  workoutByDate,
  otherByDate,
  todayIso,
  selectedWeekStart,
  onMonthChange,
  onSelectWeekStart
}: MonthlyCalendarProps): JSX.Element {
  const [selectedRunDateIso, setSelectedRunDateIso] = useState<string | null>(null);
  const gridStart = getMonthGridAnchor(monthDate);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    return cellDate;
  });
  const weekRows = Array.from({ length: 6 }, (_, weekIndex) => {
    const weekCells = cells.slice(weekIndex * 7, weekIndex * 7 + 7);
    const weekStartIso = toIsoDate(weekCells[0]);
    const weekEndIso = toIsoDate(weekCells[6]);
    const plannedTotal = weekCells.reduce((sum, cellDate) => {
      const isoDate = toIsoDate(cellDate);
      return sum + (plannedMilesByDate[isoDate] ?? 0);
    }, 0);
    const completedTotal = weekCells.reduce((sum, cellDate) => {
      const isoDate = toIsoDate(cellDate);
      const actualMiles = actualsByDate[isoDate];
      if (!isIsoOnOrBefore(isoDate, todayIso)) {
        return sum;
      }
      return sum + (typeof actualMiles === "number" && Number.isFinite(actualMiles) ? actualMiles : 0);
    }, 0);
    const isCurrentOrPastWeek = isIsoOnOrBefore(weekStartIso, todayIso);
    return {
      weekStartIso,
      weekEndIso,
      plannedTotal,
      completedTotal,
      isCurrentOrPastWeek
    };
  });
  const activeRunSplits = useMemo(
    () => (selectedRunDateIso ? runSplitsByDate[selectedRunDateIso] ?? [] : []),
    [runSplitsByDate, selectedRunDateIso]
  );

  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Monthly View</h2>
        <div className="calendarControls">
          <button type="button" className="navButton bubbleInteractive" onClick={() => onMonthChange(-1)}>
            Prev
          </button>
          <strong className="monthTitle">{formatMonthYear(monthDate)}</strong>
          <button type="button" className="navButton bubbleInteractive" onClick={() => onMonthChange(1)}>
            Next
          </button>
        </div>
      </div>
      <div className="monthSectionWithTotals">
        <div className="monthMain">
          <div className="monthLabels">
            {MONDAY_FIRST_DAY_LABELS.map((dayLabel) => (
              <div key={dayLabel} className="dayLabel">
                {dayLabel}
              </div>
            ))}
          </div>
          <div className="monthGrid">
            {cells.map((cellDate) => {
              const isoDate = toIsoDate(cellDate);
              const plannedMiles = plannedMilesByDate[isoDate];
              const actualMiles = actualsByDate[isoDate];
              const hasActualMiles = typeof actualMiles === "number" && Number.isFinite(actualMiles);
              const displayMiles = hasActualMiles ? actualMiles : plannedMiles;
              const displayMilesLabel = displayMiles == null ? "-" : formatMiles(displayMiles);
              const hasPlannedMiles = typeof plannedMiles === "number" && Number.isFinite(plannedMiles);
              const deltaMiles = hasActualMiles && hasPlannedMiles ? actualMiles - plannedMiles : null;
              const description = descriptionByDate[isoDate];
              const runSplits = runSplitsByDate[isoDate] ?? [];
              const hasWorkout = workoutByDate[isoDate] === true;
              const hasOther = otherByDate[isoDate] === true;
              const inMonth = sameMonth(cellDate, monthDate);
              const isCurrentWeek = isoDate >= selectedWeekStart && isoDate <= shiftIsoByDays(selectedWeekStart, 6);
              const isToday = isoDate === todayIso;
              const isPastOrToday = isIsoOnOrBefore(isoDate, todayIso);

              return (
                <button
                  key={isoDate}
                  type="button"
                  className={`calendarCell bubbleInteractive ${inMonth ? "" : "faded"} ${isCurrentWeek ? "selectedWeek" : ""} ${isPastOrToday ? "pastOrTodayCell" : ""} ${isToday ? "todayCell" : ""}`}
                  onClick={() => {
                    if (runSplits.length > 0) {
                      setSelectedRunDateIso(isoDate);
                    }
                  }}
                >
                  <span className="cellTopRow">
                    <span className="cellDate">{cellDate.getDate()}</span>
                    {hasWorkout || hasOther ? (
                      <span className="cellActivityIcons">
                        {hasWorkout ? (
                          <span className="activityIcon workoutActivityIcon" title="Workout">
                            W
                          </span>
                        ) : null}
                        {hasOther ? (
                          <span className="activityIcon otherActivityIcon" title="Other activity">
                            O
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  {deltaMiles != null && Math.abs(deltaMiles) >= 0.05 ? (
                    <span className="cellPlannedDeltaRow">
                      <span className="cellPlannedValue">P {formatMiles(plannedMiles ?? 0)}</span>
                      <span className={`cellDeltaValue ${deltaMiles > 0 ? "deltaPositive" : "deltaNegative"}`}>
                        {deltaMiles > 0 ? "▲" : "▼"} {formatMiles(Math.abs(deltaMiles))}
                      </span>
                    </span>
                  ) : null}
                  <span
                    className={`cellMiles ${hasActualMiles ? "actualMilesCell" : ""}`}
                    style={displayMiles == null ? undefined : { fontSize: getCellMilesFontSize(displayMiles, displayMilesLabel) }}
                  >
                    {displayMilesLabel}
                  </span>
                  {description || runSplits.length > 0 ? (
                    <span className="hoverDescription">
                      {description ? <span>{description}</span> : null}
                      {runSplits.length > 0 ? (
                        <RunSplitMiniChart
                          splits={runSplits}
                          showTargetPaceOverlay={showTargetPaceOverlay}
                          targetPaceSecondsPerMile={targetPaceSecondsPerMile}
                        />
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="weekTotalsColumn">
          <div className="weekTotalsHeader">Week Total</div>
          <div className="weekTotalsList">
            {weekRows.map((week) => (
              <button
                key={week.weekStartIso}
                type="button"
                className={`weekTotalBox bubbleInteractive ${selectedWeekStart === week.weekStartIso ? "active" : ""} ${isIsoOnOrBefore(week.weekEndIso, todayIso) ? "completedWeekTotalBox" : ""}`}
                onClick={() => onSelectWeekStart(week.weekStartIso)}
              >
                {week.isCurrentOrPastWeek
                  ? `${formatMiles(week.completedTotal)}/${formatMiles(week.plannedTotal)}`
                  : formatMiles(week.plannedTotal)}
              </button>
            ))}
          </div>
        </aside>
      </div>
      {selectedRunDateIso && activeRunSplits.length > 0 ? (
        <RunSplitDetailModal
          isoDate={selectedRunDateIso}
          splits={activeRunSplits}
          showTargetPaceOverlay={showTargetPaceOverlay}
          targetPaceSecondsPerMile={targetPaceSecondsPerMile}
          onClose={() => setSelectedRunDateIso(null)}
        />
      ) : null}
    </section>
  );
}

function shiftIsoByDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function isIsoOnOrBefore(leftIsoDate: string, rightIsoDate: string): boolean {
  const left = fromIso(leftIsoDate);
  const right = fromIso(rightIsoDate);
  return left.getTime() <= right.getTime();
}

function fromIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getCellMilesFontSize(miles: number, label: string): string {
  const safeMiles = Math.max(0, miles);
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const isNarrow = viewportWidth <= 760;
  const minSizeRem = isNarrow ? 0.95 : 1.15;
  const maxSizeRem = isNarrow ? 2.25 : 3.1;
  const normalized = Math.min(1, safeMiles / 20);
  const amplified = Math.pow(normalized, 0.75);
  let size = minSizeRem + amplified * (maxSizeRem - minSizeRem);

  if (label.length >= 5) {
    size -= isNarrow ? 0.48 : 0.42;
  } else if (label.length >= 4) {
    size -= isNarrow ? 0.34 : 0.26;
  } else if (label.length >= 3) {
    size -= isNarrow ? 0.2 : 0.12;
  }

  // Estimate available cell width and cap text size so labels fit on mobile.
  const appHorizontalPadding = viewportWidth <= 560 ? 18 : viewportWidth <= 760 ? 24 : 40;
  const estimatedGridWidth = Math.max(260, viewportWidth - appHorizontalPadding * 2);
  const estimatedCellWidth = estimatedGridWidth / 7;
  const estimatedGlyphWidthFactor = 0.62;
  const maxBySpacePx = (estimatedCellWidth * 0.86) / Math.max(1, label.length * estimatedGlyphWidthFactor);
  const maxBySpaceRem = maxBySpacePx / 16;
  if (Number.isFinite(maxBySpaceRem) && maxBySpaceRem > 0) {
    size = Math.min(size, maxBySpaceRem);
  }

  size = Math.max(minSizeRem, size);
  return `${size.toFixed(2)}rem`;
}

