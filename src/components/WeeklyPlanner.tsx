import { MONDAY_FIRST_DAY_LABELS, formatWeekRange } from "../lib/dateUtils";
import { RunSplitMiniChart } from "./RunSplitMiniChart";
import type { RunSplitsByDate } from "../lib/runMileSplits";

interface WeeklyPlannerProps {
  weekStartIso: string;
  dayDates: string[];
  originalPlannedWeek: number[];
  adjustedWeek: number[];
  actualsByDate: Record<string, number>;
  descriptionByDate: Record<string, string>;
  runSplitsByDate: RunSplitsByDate;
  showTargetPaceOverlay: boolean;
  targetPaceSecondsPerMile: number;
  todayIso: string;
  targetWeeklyTotal: number;
  exceededByMiles: number;
  canEditActualForDate: (isoDate: string) => boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onTargetChange: (newTarget: number) => void;
  onActualChange: (isoDate: string, miles: number | null) => void;
}

export function WeeklyPlanner({
  weekStartIso,
  dayDates,
  originalPlannedWeek,
  adjustedWeek,
  actualsByDate,
  descriptionByDate,
  runSplitsByDate,
  showTargetPaceOverlay,
  targetPaceSecondsPerMile,
  todayIso,
  targetWeeklyTotal,
  exceededByMiles,
  canEditActualForDate,
  onPreviousWeek,
  onNextWeek,
  onTargetChange,
  onActualChange
}: WeeklyPlannerProps): JSX.Element {
  const adjustedTotal = adjustedWeek.reduce((sum, miles) => sum + miles, 0);

  return (
    <section className="panel">
      <div className="panelHeader weeklyHeader">
        <div className="weeklyHeaderLeft">
          <h2>Weekly View ({formatWeekRange(weekStartIso)})</h2>
          <div className="calendarControls weeklyNavControls">
            <button type="button" className="navButton bubbleInteractive" onClick={onPreviousWeek}>
              Prev Week
            </button>
            <button type="button" className="navButton bubbleInteractive" onClick={onNextWeek}>
              Next Week
            </button>
          </div>
        </div>
        <div className="targetInput">
          <label htmlFor="targetTotal">Weekly target (mi)</label>
          <input
            id="targetTotal"
            className="glassInput bubbleInteractive"
            type="number"
            min={0}
            step={0.5}
            value={targetWeeklyTotal}
            onChange={(event) => onTargetChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="totalsRow">
        <span className="totalChip">Original plan: {formatMiles(originalPlannedWeek.reduce((sum, miles) => sum + miles, 0))} mi</span>
        <span className="totalChip">Current adjusted total: {formatMiles(adjustedTotal)} mi</span>
        {exceededByMiles > 0 ? <span className="totalChip warning">Exceeded target by {formatMiles(exceededByMiles)} mi</span> : null}
      </div>

      <div className="weekGrid">
        {dayDates.map((isoDate, index) => {
          const actualValue = actualsByDate[isoDate];
          const editable = canEditActualForDate(isoDate);
          const description = descriptionByDate[isoDate];
          const runSplits = runSplitsByDate[isoDate] ?? [];
          const isToday = isoDate === todayIso;
          const isPastOrToday = isIsoOnOrBefore(isoDate, todayIso);
          return (
            <article key={isoDate} className={`weekDayCard bubbleInteractive ${isPastOrToday ? "pastOrTodayDayCard" : ""} ${isToday ? "todayDayCard" : ""}`}>
              <h3>{MONDAY_FIRST_DAY_LABELS[index]}</h3>
              <p className="dateText">{isoDate}</p>
              <p>
                Planned: <span className="metricValue">{formatMiles(originalPlannedWeek[index])} mi</span>
              </p>
              <p>
                Adjusted: <span className="metricValue">{formatMiles(adjustedWeek[index])} mi</span>
              </p>
              <label className="actualLabel" htmlFor={`actual-${isoDate}`}>
                Actual (past/current)
              </label>
              <input
                id={`actual-${isoDate}`}
                className="glassInput bubbleInteractive"
                type="number"
                min={0}
                step={0.1}
                value={Number.isFinite(actualValue) ? actualValue : ""}
                disabled={!editable}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (raw === "") {
                    onActualChange(isoDate, null);
                    return;
                  }
                  onActualChange(isoDate, Number(raw));
                }}
              />
              {description || runSplits.length > 0 ? (
                <div className="hoverDescription weeklyHoverDescription">
                  {description ? <span>{description}</span> : null}
                  {runSplits.length > 0 ? (
                    <RunSplitMiniChart
                      splits={runSplits}
                      showTargetPaceOverlay={showTargetPaceOverlay}
                      targetPaceSecondsPerMile={targetPaceSecondsPerMile}
                    />
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

