import { useRef, useState, type MouseEvent } from "react";
import { addDays, fromIsoDate, getWeekStartIso, toIsoDate } from "../lib/dateUtils";
import type { ProgressGranularity, WeeklyProgressPoint } from "../lib/weeklyProgress";

export type ChartMode = "line" | "bar";

interface WeeklyProgressChartProps {
  data: WeeklyProgressPoint[];
  mode: ChartMode;
  showActual: boolean;
  granularity: ProgressGranularity;
  referenceDateIso: string;
  raceDateIso: string;
  extendTrailingSpace: boolean;
}

const SVG_WIDTH = 980;
const SVG_HEIGHT = 280;
const PADDING_X = 44;
const PADDING_TOP = 22;
const PADDING_BOTTOM = 32;
const MAX_EXPANDED_SVG_WIDTH = 1600;

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

interface HoverState {
  x: number;
  y: number;
  point: WeeklyProgressPoint;
}

export function WeeklyProgressChart({
  data,
  mode,
  showActual,
  granularity,
  referenceDateIso,
  raceDateIso,
  extendTrailingSpace
}: WeeklyProgressChartProps): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  if (data.length === 0) {
    return (
      <div className="chartEmptyState">
        No weekly data available. Upload a plan to see progression.
      </div>
    );
  }

  const minPixelsPerStep = mode === "bar" ? (granularity === "daily" ? 8 : 10) : granularity === "daily" ? 6 : 12;
  const stepDays = granularity === "daily" ? 1 : 7;
  const firstDataDate = fromIsoDate(data[0].weekStart);
  const lastDataDate = fromIsoDate(data[data.length - 1].weekStart);
  const baseSpanSteps = Math.max(1, diffDays(firstDataDate, lastDataDate) / stepDays);
  const idealSvgWidth = PADDING_X * 2 + baseSpanSteps * minPixelsPerStep;
  const svgWidth = Math.min(MAX_EXPANDED_SVG_WIDTH, Math.max(SVG_WIDTH, idealSvgWidth));
  const plotWidth = svgWidth - PADDING_X * 2;
  const plotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const maxValue = Math.max(
    1,
    ...data.map((point) => (showActual ? Math.max(point.plannedTotal, point.actualTotal) : point.plannedTotal))
  );
  const trailingSlots = extendTrailingSpace ? 2 : 0;
  const stepX = plotWidth / Math.max(1, baseSpanSteps + trailingSlots);

  const getY = (value: number): number => PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;
  const getXForIsoDate = (isoDate: string): number => {
    const offset = diffDays(firstDataDate, fromIsoDate(isoDate)) / stepDays;
    return PADDING_X + offset * stepX;
  };

  const plannedPoints = data.map((point) => `${getXForIsoDate(point.weekStart)},${getY(point.plannedTotal)}`).join(" ");
  const actualPoints = data.map((point) => `${getXForIsoDate(point.weekStart)},${getY(point.actualTotal)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => roundToTenth(maxValue * ratio));
  const monthMarkers = getMonthMarkers(data);
  const todayMarkerX = getXForIsoDate(referenceDateIso);
  const firstVisibleIso = data[0]?.weekStart ?? "";
  const lastVisibleIso = data[data.length - 1]?.weekStart ?? "";
  const extendedLastVisibleIso = toIsoDate(addDays(fromIsoDate(lastVisibleIso), trailingSlots * stepDays));
  const normalizedRaceIso = raceDateIso.trim().length > 0 ? raceDateIso : "";
  const hasRaceMarker =
    raceDateIso.trim().length > 0 &&
    normalizedRaceIso >= firstVisibleIso &&
    normalizedRaceIso <= extendedLastVisibleIso;
  const raceMarkerX = hasRaceMarker ? getXForIsoDate(normalizedRaceIso) : 0;

  const showTooltipAtEvent = (event: MouseEvent<SVGElement>, point: WeeklyProgressPoint): void => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const rect = wrap.getBoundingClientRect();
    setHoverState({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      point
    });
  };

  return (
    <div className="chartWrap" ref={wrapRef} onMouseLeave={() => setHoverState(null)}>
      <div className="chartYAxisOverlay" aria-hidden="true">
        {yTicks.map((tick, index) => {
          const y = getY(tick);
          return (
            <span
              key={`${tick}-${index}`}
              className="chartYAxisTickLabel"
              style={{ top: `${y}px` }}
            >
              {formatMilesLabel(tick)}
            </span>
          );
        })}
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${SVG_HEIGHT}`}
        className="progressChart"
        style={{ minWidth: `${svgWidth}px` }}
        role="img"
        aria-label="Weekly mileage progression chart"
      >
        {monthMarkers.map((marker) => {
          const x = getXForIsoDate(marker.isoDate);
          return (
            <line
              key={`month-divider-${marker.isoDate}`}
              className="chartMonthDivider"
              x1={x}
              y1={PADDING_TOP}
              x2={x}
              y2={PADDING_TOP + plotHeight}
            />
          );
        })}

        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line className="chartGridLine" x1={PADDING_X} y1={y} x2={svgWidth - PADDING_X} y2={y} />
            </g>
          );
        })}

        {mode === "line" ? (
          <>
            <polyline className="plannedLine" points={plannedPoints} />
            {showActual ? <polyline className="actualLine" points={actualPoints} /> : null}
            {data.map((point) => {
              const x = getXForIsoDate(point.weekStart);
              return (
                <g key={point.weekStart}>
                  <circle className="plannedPoint" cx={x} cy={getY(point.plannedTotal)} r="3.3" />
                  {showActual ? <circle className="actualPoint" cx={x} cy={getY(point.actualTotal)} r="3.3" /> : null}
                  <circle
                    className="chartHoverTarget"
                    cx={x}
                    cy={getY(point.plannedTotal)}
                    r="9"
                    onMouseMove={(event) => showTooltipAtEvent(event, point)}
                  />
                  {showActual ? (
                    <circle
                      className="chartHoverTarget"
                      cx={x}
                      cy={getY(point.actualTotal)}
                      r="9"
                      onMouseMove={(event) => showTooltipAtEvent(event, point)}
                    />
                  ) : null}
                </g>
              );
            })}
          </>
        ) : (
          <>
            {data.map((point) => {
              const groupCenter = getXForIsoDate(point.weekStart);
              const groupWidth = Math.max(2, Math.min(12, stepX * 0.9));
              const splitGap = 1;
              const pairedBarWidth = Math.max(1, (groupWidth - splitGap) / 2);
              const plannedY = getY(point.plannedTotal);
              const actualY = getY(point.actualTotal);
              const baseline = PADDING_TOP + plotHeight;
              const plannedX = showActual ? groupCenter - pairedBarWidth - splitGap / 2 : groupCenter - groupWidth / 2;
              const plannedWidth = showActual ? pairedBarWidth : groupWidth;
              const actualX = groupCenter + splitGap / 2;

              return (
                <g key={point.weekStart}>
                  <rect
                    className="plannedBar"
                    x={plannedX}
                    y={plannedY}
                    width={plannedWidth}
                    height={Math.max(1, baseline - plannedY)}
                    rx="2"
                    onMouseMove={(event) => showTooltipAtEvent(event, point)}
                  />
                  {showActual ? (
                    <rect
                      className="actualBar"
                      x={actualX}
                      y={actualY}
                      width={pairedBarWidth}
                      height={Math.max(1, baseline - actualY)}
                      rx="2"
                      onMouseMove={(event) => showTooltipAtEvent(event, point)}
                    />
                  ) : null}
                </g>
              );
            })}
          </>
        )}

        <line
          className="chartTodayLine"
          x1={todayMarkerX}
          y1={PADDING_TOP}
          x2={todayMarkerX}
          y2={PADDING_TOP + plotHeight}
        />
        <text className="chartTodayLabel" x={todayMarkerX + 5} y={PADDING_TOP + 11}>
          Today
        </text>
        {hasRaceMarker ? (
          <>
            <line
              className="chartRaceLine"
              x1={raceMarkerX}
              y1={PADDING_TOP}
              x2={raceMarkerX}
              y2={PADDING_TOP + plotHeight}
            />
            <text className="chartRaceLabel" x={raceMarkerX + 5} y={PADDING_TOP + 24}>
              Race Date
            </text>
          </>
        ) : null}

        {extendTrailingSpace
          ? monthMarkers.map((marker) => {
              const x = getXForIsoDate(marker.isoDate);
              return (
                <text key={`${marker.isoDate}-label`} className="chartAxisLabel xAxisLabel" x={x} y={SVG_HEIGHT - 8} textAnchor="middle">
                  {formatMonthFirstLabel(marker.isoDate)}
                </text>
              );
            })
          : data.map((point, index) => {
              if (index % Math.ceil(data.length / 10) !== 0 && index !== data.length - 1) {
                return null;
              }
              const x = getXForIsoDate(point.weekStart);
              return (
                <text key={`${point.weekStart}-label`} className="chartAxisLabel xAxisLabel" x={x} y={SVG_HEIGHT - 8} textAnchor="middle">
                  {formatWeekLabel(point.weekStart)}
                </text>
              );
            })}
      </svg>
      {hoverState ? (
        <div
          className="chartHoverBox"
          style={{
            left: `${hoverState.x + 12}px`,
            top: `${Math.max(8, hoverState.y - 74)}px`
          }}
        >
          <p className="chartHoverTitle">{formatPointLabel(hoverState.point.weekStart, granularity)}</p>
          <p>Planned: {formatMilesLabel(hoverState.point.plannedTotal)}</p>
          {showActual ? <p>Actual: {formatMilesLabel(hoverState.point.actualTotal)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function formatWeekLabel(weekStartIso: string): string {
  const date = fromIsoDate(weekStartIso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatPointLabel(isoDate: string, granularity: ProgressGranularity): string {
  const start = fromIsoDate(isoDate);
  if (granularity === "daily") {
    return start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

interface MonthMarker {
  isoDate: string;
}

function getMonthMarkers(data: WeeklyProgressPoint[]): MonthMarker[] {
  if (data.length === 0) {
    return [];
  }

  const markers: MonthMarker[] = [];
  const first = fromIsoDate(data[0].weekStart);
  const last = fromIsoDate(data[data.length - 1].weekStart);
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  if (cursor < first) {
    cursor = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  }

  while (cursor <= last) {
    if (cursor > first) {
      markers.push({
        isoDate: toIsoDate(cursor)
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return markers;
}

function diffDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
}

function formatMonthFirstLabel(isoDate: string): string {
  const date = fromIsoDate(isoDate);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMilesLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

