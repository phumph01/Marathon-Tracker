interface WeeklyTrackerRow {
  weekStartIso: string;
  mileage: number;
  mileageDelta: number | null;
  averagePaceSecondsPerMile: number | null;
  paceDeltaSeconds: number | null;
}

interface WeeklyProgressTrackerProps {
  rows: WeeklyTrackerRow[];
}

export function WeeklyProgressTracker({ rows }: WeeklyProgressTrackerProps): JSX.Element {
  if (rows.length === 0) {
    return <p className="chartEmptyState">No weekly progression data to display yet.</p>;
  }

  return (
    <section className="weeklyProgressTracker">
      <h3>Week-by-Week Progression</h3>
      <div className="weeklyProgressRows">
        {rows.map((row) => (
          <article key={row.weekStartIso} className="weeklyProgressRow">
            <p className="weeklyProgressWeek">{formatWeekLabel(row.weekStartIso)}</p>
            <p className="weeklyProgressMetric">
              <span className="weeklyProgressLabel">Mileage</span>
              <span className="weeklyProgressValue">{formatMiles(row.mileage)}</span>
              {row.mileageDelta != null ? (
                <span className={getTrendClass(row.mileageDelta)}>
                  {row.mileageDelta >= 0 ? "▲" : "▼"} {formatMiles(Math.abs(row.mileageDelta))}
                </span>
              ) : null}
            </p>
            <p className="weeklyProgressMetric">
              <span className="weeklyProgressLabel">Avg Pace</span>
              <span className="weeklyProgressValue">
                {row.averagePaceSecondsPerMile == null ? "--" : `${formatPace(row.averagePaceSecondsPerMile)}/mi`}
              </span>
              {row.paceDeltaSeconds != null ? (
                <span className={getTrendClass(row.paceDeltaSeconds)}>
                  {row.paceDeltaSeconds >= 0 ? "▲" : "▼"} {formatPace(Math.abs(row.paceDeltaSeconds))}
                </span>
              ) : null}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function getTrendClass(delta: number): string {
  return `cellDeltaValue ${delta >= 0 ? "deltaPositive" : "deltaNegative"}`;
}

function formatWeekLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function formatMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPace(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${minutesPart}:${String(secondsPart).padStart(2, "0")}`;
}

export type { WeeklyTrackerRow };
