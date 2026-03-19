import { useRef, useState, type MouseEvent } from "react";
import { fromIsoDate, getWeekStartIso } from "../lib/dateUtils";
import type { MileSplitPoint } from "../lib/runMileSplits";
import type { WeeklyProgressPoint } from "../lib/weeklyProgress";

interface FitnessInsightsTabProps {
  weeklyProgress: WeeklyProgressPoint[];
  runSplitsByDate: Record<string, MileSplitPoint[]>;
  actualsByDate: Record<string, number>;
  raceDateIso: string;
}

interface WeeklyFitnessPoint {
  weekStartIso: string;
  volumeMiles: number;
  avgPaceSecondsPerMile: number | null;
  avgHrBpm: number | null;
  hasObservedData: boolean;
}

interface RunDayPoint {
  isoDate: string;
  miles: number;
  avgPaceSecondsPerMile: number;
  avgHrBpm: number;
}

interface FitnessHoverState {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

type WeeklyWindow = "all" | "12m" | "6m" | "3m";
type RelationshipWindow = "all" | "1y" | "6m" | "3m" | "target";
type FocusedChart = "volume" | "paceHrTrend" | "relationship" | null;
type DetailLevel = "compact" | "full";

export function FitnessInsightsTab({
  weeklyProgress,
  runSplitsByDate,
  actualsByDate,
  raceDateIso
}: FitnessInsightsTabProps): JSX.Element {
  const vizWrapRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<FitnessHoverState | null>(null);
  const [focusedChart, setFocusedChart] = useState<FocusedChart>(null);
  const [volumeWindow, setVolumeWindow] = useState<WeeklyWindow>("6m");
  const [paceHrWindow, setPaceHrWindow] = useState<WeeklyWindow>("6m");
  const [relationshipWindow, setRelationshipWindow] = useState<RelationshipWindow>("all");
  const [relationshipIncludeZeroBaseline, setRelationshipIncludeZeroBaseline] = useState(false);
  const runDays = buildRunDayPoints(runSplitsByDate, actualsByDate);
  const weeklyFitness = buildWeeklyFitnessPoints(weeklyProgress, runDays, actualsByDate);
  const allWeeks = weeklyFitness.filter((week) => week.hasObservedData);
  const overviewWeeks = filterWeeksByWindow(allWeeks, "6m");
  const filteredVolumeWeeks = filterWeeksByWindow(allWeeks, volumeWindow);
  const filteredPaceHrWeeks = filterWeeksByWindow(allWeeks, paceHrWindow);
  const filteredRunDays = filterRunDaysByWindow(runDays, relationshipWindow);

  const currentWeek = allWeeks[allWeeks.length - 1] ?? null;
  const previousWeek = allWeeks.length > 1 ? allWeeks[allWeeks.length - 2] : null;
  const rolling4Volume = average(allWeeks.slice(-4).map((week) => week.volumeMiles));
  const rolling4Pace = average(
    allWeeks
      .slice(-4)
      .map((week) => week.avgPaceSecondsPerMile)
      .filter((value): value is number => value != null)
  );
  const rolling4Hr = average(
    allWeeks
      .slice(-4)
      .map((week) => week.avgHrBpm)
      .filter((value): value is number => value != null)
  );

  const showHover = (event: MouseEvent<SVGElement>, title: string, lines: string[]): void => {
    const wrap = vizWrapRef.current;
    if (!wrap) {
      return;
    }
    const rect = wrap.getBoundingClientRect();
    setHoverState({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      title,
      lines
    });
  };

  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Fitness</h2>
      </div>

      <div className="fitnessKpiGrid">
        <article className="fitnessKpiCard">
          <p className="fitnessKpiLabel">Current Volume</p>
          <p className="fitnessKpiValue">{currentWeek ? formatMiles(currentWeek.volumeMiles) : "--"} mi</p>
          <p className="fitnessKpiMeta">
            {currentWeek && previousWeek
              ? `vs prev: ${formatSignedMiles(currentWeek.volumeMiles - previousWeek.volumeMiles)}`
              : "Need two weeks of data"}
          </p>
        </article>
        <article className="fitnessKpiCard">
          <p className="fitnessKpiLabel">Current Avg Pace</p>
          <p className="fitnessKpiValue">
            {currentWeek?.avgPaceSecondsPerMile != null ? `${formatPace(currentWeek.avgPaceSecondsPerMile)}/mi` : "--"}
          </p>
          <p className="fitnessKpiMeta">
            4w avg: {rolling4Pace != null ? `${formatPace(rolling4Pace)}/mi` : "--"}
          </p>
        </article>
        <article className="fitnessKpiCard">
          <p className="fitnessKpiLabel">Current Avg HR</p>
          <p className="fitnessKpiValue">{currentWeek?.avgHrBpm != null ? `${Math.round(currentWeek.avgHrBpm)} bpm` : "--"}</p>
          <p className="fitnessKpiMeta">4w avg: {rolling4Hr != null ? `${Math.round(rolling4Hr)} bpm` : "--"}</p>
        </article>
        <article className="fitnessKpiCard">
          <p className="fitnessKpiLabel">4-Week Volume Avg</p>
          <p className="fitnessKpiValue">{rolling4Volume != null ? `${formatMiles(rolling4Volume)} mi` : "--"}</p>
          <p className="fitnessKpiMeta">Based on weekly actual mileage</p>
        </article>
      </div>

      <div className="fitnessInteractiveArea" ref={vizWrapRef} onMouseLeave={() => setHoverState(null)}>
        {focusedChart ? (
          <article className="fitnessFocusedPanel">
            <div className="fitnessVizHeader">
              <h3>
                {focusedChart === "volume"
                  ? "Volume Trend + 4w Baseline"
                  : focusedChart === "paceHrTrend"
                    ? "Pace and HR Trends"
                    : "Pace vs HR Relationship"}
              </h3>
              <button
                type="button"
                className="chartModeButton bubbleInteractive"
                onClick={() => {
                  setFocusedChart(null);
                  setHoverState(null);
                }}
              >
                Back to overview
              </button>
            </div>

            {focusedChart === "volume" ? (
              <>
                <div className="fitnessWindowToggle" role="radiogroup" aria-label="Volume timeframe">
                  {(["3m", "6m", "12m", "all"] as WeeklyWindow[]).map((window) => (
                    <button
                      key={window}
                      type="button"
                      className={`chartModeButton ${volumeWindow === window ? "active" : ""}`}
                      aria-pressed={volumeWindow === window}
                      onClick={() => setVolumeWindow(window)}
                    >
                      {window === "all" ? "All" : window.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="fitnessChartScroll">
                  <div className="fitnessChartFrame">
                    <VolumeTrendChart points={filteredVolumeWeeks} detailLevel="full" onPointHover={showHover} />
                  </div>
                </div>
              </>
            ) : null}

            {focusedChart === "paceHrTrend" ? (
              <>
                <div className="fitnessWindowToggle" role="radiogroup" aria-label="Pace and HR timeframe">
                  {(["3m", "6m", "12m", "all"] as WeeklyWindow[]).map((window) => (
                    <button
                      key={window}
                      type="button"
                      className={`chartModeButton ${paceHrWindow === window ? "active" : ""}`}
                      aria-pressed={paceHrWindow === window}
                      onClick={() => setPaceHrWindow(window)}
                    >
                      {window === "all" ? "All" : window.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="fitnessChartScroll">
                  <div className="fitnessChartFrame">
                    <PaceHrTrendChart points={filteredPaceHrWeeks} detailLevel="full" onPointHover={showHover} />
                  </div>
                </div>
              </>
            ) : null}

            {focusedChart === "relationship" ? (
              <>
                <div className="fitnessWindowToggle" role="radiogroup" aria-label="Pace vs HR timeframe">
                  <button
                    type="button"
                    className={`chartModeButton ${relationshipWindow === "all" ? "active" : ""}`}
                    aria-pressed={relationshipWindow === "all"}
                    onClick={() => setRelationshipWindow("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`chartModeButton ${relationshipWindow === "1y" ? "active" : ""}`}
                    aria-pressed={relationshipWindow === "1y"}
                    onClick={() => setRelationshipWindow("1y")}
                  >
                    1Y
                  </button>
                  <button
                    type="button"
                    className={`chartModeButton ${relationshipWindow === "6m" ? "active" : ""}`}
                    aria-pressed={relationshipWindow === "6m"}
                    onClick={() => setRelationshipWindow("6m")}
                  >
                    6M
                  </button>
                  <button
                    type="button"
                    className={`chartModeButton ${relationshipWindow === "3m" ? "active" : ""}`}
                    aria-pressed={relationshipWindow === "3m"}
                    onClick={() => setRelationshipWindow("3m")}
                  >
                    3M
                  </button>
                  <button
                    type="button"
                    className={`chartModeButton ${relationshipWindow === "target" ? "active" : ""}`}
                    aria-pressed={relationshipWindow === "target"}
                    onClick={() => setRelationshipWindow("target")}
                  >
                    Target
                  </button>
                </div>
                <div className="fitnessChartScroll">
                  <div className="fitnessChartFrame">
                    <PaceHrScatterChart
                      runDays={filteredRunDays}
                      raceDateIso={raceDateIso}
                      showTargetBubble={relationshipWindow === "target"}
                      includeZeroBaseline={relationshipIncludeZeroBaseline}
                      onToggleYAxisBaseline={() => setRelationshipIncludeZeroBaseline((current) => !current)}
                      detailLevel="full"
                      onPointHover={showHover}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </article>
        ) : (
          <div className="fitnessOverviewGrid">
            <button
              type="button"
              className={`fitnessOverviewCard bubbleInteractive ${focusedChart === "volume" ? "active" : ""}`}
              onClick={() => setFocusedChart("volume")}
            >
              <div className="fitnessOverviewHeader">
                <h3>Volume Trend + 4w Baseline</h3>
                <span>Tap for detail</span>
              </div>
              <div className="fitnessChartScroll">
                <div className="fitnessChartFrame">
                  <VolumeTrendChart points={overviewWeeks} detailLevel="compact" onPointHover={() => undefined} />
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`fitnessOverviewCard bubbleInteractive ${focusedChart === "paceHrTrend" ? "active" : ""}`}
              onClick={() => setFocusedChart("paceHrTrend")}
            >
              <div className="fitnessOverviewHeader">
                <h3>Pace and HR Trends</h3>
                <span>Tap for detail</span>
              </div>
              <div className="fitnessChartScroll">
                <div className="fitnessChartFrame">
                  <PaceHrTrendChart points={overviewWeeks} detailLevel="compact" onPointHover={() => undefined} />
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`fitnessOverviewCard bubbleInteractive ${focusedChart === "relationship" ? "active" : ""}`}
              onClick={() => setFocusedChart("relationship")}
            >
              <div className="fitnessOverviewHeader">
                <h3>Pace vs HR Relationship</h3>
                <span>Tap for detail</span>
              </div>
              <div className="fitnessChartScroll">
                <div className="fitnessChartFrame">
                  <PaceHrScatterChart
                    runDays={filterRunDaysByWindow(runDays, "6m")}
                    raceDateIso={raceDateIso}
                    showTargetBubble={false}
                    includeZeroBaseline={false}
                    detailLevel="compact"
                    onPointHover={() => undefined}
                  />
                </div>
              </div>
            </button>
          </div>
        )}

        {hoverState ? (
          <div
            className="chartHoverBox"
            style={{
              left: `${hoverState.x + 12}px`,
              top: `${Math.max(8, hoverState.y - 84)}px`
            }}
          >
            <p className="chartHoverTitle">{hoverState.title}</p>
            {hoverState.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function VolumeTrendChart({
  points,
  detailLevel,
  onPointHover
}: {
  points: WeeklyFitnessPoint[];
  detailLevel: DetailLevel;
  onPointHover: (event: MouseEvent<SVGElement>, title: string, lines: string[]) => void;
}): JSX.Element {
  if (points.length < 2) {
    return <p className="chartEmptyState">Add more completed weeks to render a trend.</p>;
  }
  const width = detailLevel === "full" ? 980 : 560;
  const height = detailLevel === "full" ? 260 : 170;
  const padX = 34;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxVolume = Math.max(1, ...points.map((point) => point.volumeMiles));
  const stepX = innerW / Math.max(1, points.length - 1);
  const rolling = movingAverage(points.map((point) => point.volumeMiles), 4);
  const xTickStep = detailLevel === "full" ? Math.max(1, Math.floor(points.length / 8)) : Math.max(1, Math.floor(points.length / 3));
  const yTickRatios = detailLevel === "full" ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];

  const getX = (index: number): number => padX + index * stepX;
  const getY = (value: number): number => padY + innerH - (value / maxVolume) * innerH;
  const volumePath = points.map((point, index) => `${getX(index)},${getY(point.volumeMiles)}`).join(" ");
  const baselinePath = rolling.map((value, index) => `${getX(index)},${getY(value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="fitnessChart" style={{ width: `${width}px`, minWidth: `${width}px` }}>
      {yTickRatios.map((ratio) => {
        const y = getY(maxVolume * ratio);
        const value = maxVolume * ratio;
        return (
          <g key={ratio}>
            <line className="fitnessGridLine" x1={padX} y1={y} x2={width - padX} y2={y} />
            {detailLevel === "full" ? (
              <text className="fitnessTickLabel" x={padX - 6} y={y + 3} textAnchor="end">
                {formatMiles(value)}
              </text>
            ) : null}
          </g>
        );
      })}
      {points.map((point, index) => {
        if (index % xTickStep !== 0 && index !== points.length - 1) {
          return null;
        }
        const x = getX(index);
        return (
          <text key={`${point.weekStartIso}-xtick`} className="fitnessTickLabel" x={x} y={height - 10} textAnchor="middle">
            {formatShortDate(point.weekStartIso)}
          </text>
        );
      })}
      <polyline className="fitnessVolumeLine" points={volumePath} />
      <polyline className="fitnessBaselineLine" points={baselinePath} />
      {points.map((point, index) => {
        const weekLabel = formatWeekLabel(point.weekStartIso);
        return (
          <circle
            key={point.weekStartIso}
            className="fitnessVolumePoint"
            cx={getX(index)}
            cy={getY(point.volumeMiles)}
            r="2.8"
            onMouseMove={(event) =>
              onPointHover(
                event,
                weekLabel,
                detailLevel === "full"
                  ? [
                      `Volume: ${formatMiles(point.volumeMiles)} mi`,
                      `4w baseline: ${formatMiles(rolling[index])} mi`,
                      `Delta: ${formatSignedMiles(point.volumeMiles - rolling[index])}`
                    ]
                  : [`Volume: ${formatMiles(point.volumeMiles)} mi`]
              )
            }
            onClick={(event) => {
              event.stopPropagation();
              onPointHover(
                event,
                weekLabel,
                detailLevel === "full"
                  ? [
                      `Volume: ${formatMiles(point.volumeMiles)} mi`,
                      `4w baseline: ${formatMiles(rolling[index])} mi`,
                      `Delta: ${formatSignedMiles(point.volumeMiles - rolling[index])}`
                    ]
                  : [`Volume: ${formatMiles(point.volumeMiles)} mi`]
              );
            }}
          />
        );
      })}
      {detailLevel === "full" ? (
        <>
          <text className="fitnessAxisLabel" x={width / 2} y={height - 2} textAnchor="middle">
            Week Start Date
          </text>
          <text className="fitnessAxisLabel" x={11} y={height / 2} transform={`rotate(-90 11 ${height / 2})`} textAnchor="middle">
            Volume (mi)
          </text>
        </>
      ) : null}
    </svg>
  );
}

function PaceHrTrendChart({
  points,
  detailLevel,
  onPointHover
}: {
  points: WeeklyFitnessPoint[];
  detailLevel: DetailLevel;
  onPointHover: (event: MouseEvent<SVGElement>, title: string, lines: string[]) => void;
}): JSX.Element {
  const valid = points.filter((point) => point.avgPaceSecondsPerMile != null && point.avgHrBpm != null);
  if (valid.length < 2) {
    return <p className="chartEmptyState">Need split data across multiple weeks.</p>;
  }

  const width = detailLevel === "full" ? 980 : 560;
  const height = detailLevel === "full" ? 260 : 180;
  const padX = 34;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const paceMin = 6 * 60;
  const paceMax = 10 * 60;
  const hrMin = 120;
  const hrMax = 180;
  const stepX = innerW / Math.max(1, valid.length - 1);
  const xTickStep = detailLevel === "full" ? Math.max(1, Math.floor(valid.length / 8)) : Math.max(1, Math.floor(valid.length / 3));
  const paceTicks = [6 * 60, 7 * 60, 8 * 60, 9 * 60, 10 * 60];
  const hrTicks = [120, 135, 150, 165, 180];

  const getX = (index: number): number => padX + index * stepX;
  const getPaceY = (value: number): number => padY + ((value - paceMin) / (paceMax - paceMin)) * innerH;
  const getHrY = (value: number): number => padY + innerH - ((value - hrMin) / (hrMax - hrMin)) * innerH;
  const pacePath = valid.map((point, index) => `${getX(index)},${getPaceY(point.avgPaceSecondsPerMile ?? paceMax)}`).join(" ");
  const hrPath = valid.map((point, index) => `${getX(index)},${getHrY(point.avgHrBpm ?? hrMin)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="fitnessChart" style={{ width: `${width}px`, minWidth: `${width}px` }}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padY + innerH * ratio;
        return <line key={ratio} className="fitnessGridLine" x1={padX} y1={y} x2={width - padX} y2={y} />;
      })}
      {(detailLevel === "full" ? paceTicks : [6 * 60, 8 * 60, 10 * 60]).map((value) => {
        const y = getPaceY(value);
        return (
          <text key={`pace-${value}`} className="fitnessTickLabel fitnessPaceTick" x={padX - 6} y={y + 3} textAnchor="end">
            {formatPace(value)}
          </text>
        );
      })}
      {(detailLevel === "full" ? hrTicks : [120, 150, 180]).map((value) => {
        const y = getHrY(value);
        return (
          <text key={`hr-${value}`} className="fitnessTickLabel fitnessHrTick" x={width - padX + 6} y={y + 3} textAnchor="start">
            {value}
          </text>
        );
      })}
      {valid.map((point, index) => {
        if (index % xTickStep !== 0 && index !== valid.length - 1) {
          return null;
        }
        return (
          <text key={`${point.weekStartIso}-xtick`} className="fitnessTickLabel" x={getX(index)} y={height - 10} textAnchor="middle">
            {formatShortDate(point.weekStartIso)}
          </text>
        );
      })}
      <polyline className="fitnessPaceLine" points={pacePath} />
      <polyline className="fitnessHrLine" points={hrPath} />
      {valid.map((point, index) => {
        const weekLabel = formatWeekLabel(point.weekStartIso);
        const pace = point.avgPaceSecondsPerMile ?? paceMax;
        const hr = point.avgHrBpm ?? hrMin;
        return (
          <g key={point.weekStartIso}>
            <circle
              className="fitnessPacePoint"
              cx={getX(index)}
              cy={getPaceY(pace)}
              r="2.8"
              onMouseMove={(event) =>
                onPointHover(event, `${weekLabel} (Pace)`, [
                  `Pace: ${formatPace(pace)}/mi`,
                  `HR: ${Math.round(hr)} bpm`
                ])
              }
              onClick={(event) => {
                event.stopPropagation();
                onPointHover(event, `${weekLabel} (Pace)`, [
                  `Pace: ${formatPace(pace)}/mi`,
                  `HR: ${Math.round(hr)} bpm`
                ]);
              }}
            />
            <circle
              className="fitnessHrPoint"
              cx={getX(index)}
              cy={getHrY(hr)}
              r="2.8"
              onMouseMove={(event) =>
                onPointHover(event, `${weekLabel} (HR)`, [
                  `HR: ${Math.round(hr)} bpm`,
                  `Pace: ${formatPace(pace)}/mi`
                ])
              }
              onClick={(event) => {
                event.stopPropagation();
                onPointHover(event, `${weekLabel} (HR)`, [
                  `HR: ${Math.round(hr)} bpm`,
                  `Pace: ${formatPace(pace)}/mi`
                ]);
              }}
            />
          </g>
        );
      })}
      {detailLevel === "full" ? (
        <>
          <text className="fitnessAxisLabel" x={width / 2} y={height - 2} textAnchor="middle">
            Week Start Date
          </text>
          <text
            className="fitnessAxisLabel fitnessPaceTick"
            x={11}
            y={height / 2}
            transform={`rotate(-90 11 ${height / 2})`}
            textAnchor="middle"
          >
            Pace (min/mi)
          </text>
          <text
            className="fitnessAxisLabel fitnessHrTick"
            x={width - 11}
            y={height / 2}
            transform={`rotate(90 ${width - 11} ${height / 2})`}
            textAnchor="middle"
          >
            HR (bpm)
          </text>
        </>
      ) : null}
    </svg>
  );
}

function PaceHrScatterChart({
  runDays,
  raceDateIso,
  showTargetBubble,
  includeZeroBaseline,
  onToggleYAxisBaseline,
  detailLevel,
  onPointHover
}: {
  runDays: RunDayPoint[];
  raceDateIso: string;
  showTargetBubble: boolean;
  includeZeroBaseline: boolean;
  onToggleYAxisBaseline?: () => void;
  detailLevel: DetailLevel;
  onPointHover: (event: MouseEvent<SVGElement>, title: string, lines: string[]) => void;
}): JSX.Element {
  const hasTargetDate = /^\d{4}-\d{2}-\d{2}$/.test(raceDateIso);
  const targetDateMs = hasTargetDate ? fromIsoDate(raceDateIso).getTime() : null;
  const targetPoint =
    showTargetBubble && targetDateMs != null
      ? {
          isoDate: raceDateIso,
          miles: 26,
          avgPaceSecondsPerMile: 390,
          avgHrBpm: 140,
          beatsPerMile: (390 / 60) * 140
        }
      : null;

  if (runDays.length < 3 && !targetPoint) {
    return <p className="chartEmptyState">Need more completed runs with split data.</p>;
  }
  const width = detailLevel === "full" ? 980 : 640;
  const height = detailLevel === "full" ? 290 : 220;
  const padX = 52;
  const padY = 26;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const chronologicalRuns = [...runDays].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const relationshipSeries = chronologicalRuns.map((day) => ({
    ...day,
    beatsPerMile: (day.avgPaceSecondsPerMile / 60) * day.avgHrBpm
  }));
  const relationshipValues = relationshipSeries.map((day) => day.beatsPerMile);
  if (targetPoint) {
    relationshipValues.push(targetPoint.beatsPerMile);
  }
  const derivedValueMin = Math.floor((Math.min(...relationshipValues) - 6) / 2) * 2;
  const derivedValueMax = Math.ceil((Math.max(...relationshipValues) + 6) / 2) * 2;
  const valueMin = includeZeroBaseline ? 0 : derivedValueMin;
  const valueMax = Math.max(valueMin + 2, derivedValueMax);
  const valueRange = Math.max(1, valueMax - valueMin);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => valueMin + ratio * (valueMax - valueMin));
  const rolling = movingAverage(relationshipSeries.map((day) => day.beatsPerMile), 5);
  const runDateMs = relationshipSeries.map((point) => fromIsoDate(point.isoDate).getTime());
  const today = new Date();
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const domainDateMs = targetPoint && targetDateMs != null ? [...runDateMs, targetDateMs] : runDateMs;
  const domainMinMs = domainDateMs.length > 0 ? Math.min(...domainDateMs) : targetDateMs ?? todayMs;
  const domainMaxMs =
    targetPoint && targetDateMs != null
      ? Math.max(...domainDateMs)
      : Math.max(todayMs, ...(domainDateMs.length > 0 ? domainDateMs : [todayMs]));
  const domainSpanMs = Math.max(24 * 60 * 60 * 1000, domainMaxMs - domainMinMs);
  const xTickStep =
    detailLevel === "full"
      ? Math.max(1, Math.floor(Math.max(1, relationshipSeries.length) / 8))
      : Math.max(1, Math.floor(Math.max(1, relationshipSeries.length) / 3));

  const getXForDateMs = (dateMs: number): number => padX + ((dateMs - domainMinMs) / domainSpanMs) * innerW;
  const getY = (value: number): number => padY + innerH - ((value - valueMin) / valueRange) * innerH;
  const relationshipPath = relationshipSeries
    .map((point) => `${getXForDateMs(fromIsoDate(point.isoDate).getTime())},${getY(point.beatsPerMile)}`)
    .join(" ");
  const rollingPath = rolling
    .map((value, index) => `${getXForDateMs(fromIsoDate(relationshipSeries[index].isoDate).getTime())},${getY(value)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="fitnessChart fitnessChartWide"
      style={{ width: `max(100%, ${width}px)`, minWidth: `${width}px` }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padY + innerH * ratio;
        return (
          <g key={ratio}>
            <line className="fitnessGridLine" x1={padX} y1={y} x2={width - padX} y2={y} />
          </g>
        );
      })}
      {yTicks.map((value) => {
        const y = getY(value);
        return (
          <text key={`y-${value}`} className="fitnessTickLabel" x={padX - 6} y={y + 3} textAnchor="end">
            {Math.round(value)}
          </text>
        );
      })}
      {relationshipSeries.map((day, index) => {
        if (index % xTickStep !== 0 && index !== relationshipSeries.length - 1) {
          return null;
        }
        const x = getXForDateMs(fromIsoDate(day.isoDate).getTime());
        return (
          <text key={`${day.isoDate}-xtick`} className="fitnessTickLabel" x={x} y={height - 24} textAnchor="middle">
            {formatShortDate(day.isoDate)}
          </text>
        );
      })}
      {detailLevel === "full" && targetPoint && targetDateMs != null ? (
        <text className="fitnessTickLabel fitnessTargetTick" x={getXForDateMs(targetDateMs)} y={height - 24} textAnchor="middle">
          {formatShortDate(targetPoint.isoDate)}
        </text>
      ) : null}

      {detailLevel === "full" && relationshipSeries.length > 1 ? (
        <polyline className="fitnessRelationshipSeries" points={relationshipPath} />
      ) : null}
      {detailLevel === "full" && relationshipSeries.length > 1 ? (
        <polyline className="fitnessRelationshipTrend" points={rollingPath} />
      ) : null}
      {relationshipSeries.map((day, index) => (
        <g key={day.isoDate}>
          <circle
            className="fitnessScatterPoint"
            cx={getXForDateMs(fromIsoDate(day.isoDate).getTime())}
            cy={getY(day.beatsPerMile)}
            r={Math.max(3, Math.min(8, day.miles / 2))}
            style={{ opacity: 0.82 }}
            onMouseMove={(event) =>
              onPointHover(
                event,
                formatDayLabel(day.isoDate),
                detailLevel === "full"
                  ? [
                      `Run order: ${index + 1}/${chronologicalRuns.length}`,
                      `Pace: ${formatPace(day.avgPaceSecondsPerMile)}/mi`,
                      `HR: ${Math.round(day.avgHrBpm)} bpm`,
                      `Miles: ${formatMiles(day.miles)}`,
                      `Relationship: ${Math.round(day.beatsPerMile)} beats/mile`
                    ]
                  : [`Pace: ${formatPace(day.avgPaceSecondsPerMile)}/mi`, `HR: ${Math.round(day.avgHrBpm)} bpm`, `Miles: ${formatMiles(day.miles)}`]
              )
            }
            onClick={(event) => {
              event.stopPropagation();
              onPointHover(
                event,
                formatDayLabel(day.isoDate),
                detailLevel === "full"
                  ? [
                      `Run order: ${index + 1}/${chronologicalRuns.length}`,
                      `Pace: ${formatPace(day.avgPaceSecondsPerMile)}/mi`,
                      `HR: ${Math.round(day.avgHrBpm)} bpm`,
                      `Miles: ${formatMiles(day.miles)}`,
                      `Relationship: ${Math.round(day.beatsPerMile)} beats/mile`
                    ]
                  : [`Pace: ${formatPace(day.avgPaceSecondsPerMile)}/mi`, `HR: ${Math.round(day.avgHrBpm)} bpm`, `Miles: ${formatMiles(day.miles)}`]
              );
            }}
          />
          {detailLevel === "full" && index === chronologicalRuns.length - 1 ? (
            <circle
              className="fitnessLatestPointRing"
              cx={getXForDateMs(fromIsoDate(day.isoDate).getTime())}
              cy={getY(day.beatsPerMile)}
              r={Math.max(5, Math.min(10, day.miles / 2 + 2))}
            />
          ) : null}
        </g>
      ))}
      {detailLevel === "full" && targetPoint && targetDateMs != null ? (
        <g>
          <circle
            className="fitnessTargetPoint"
            cx={getXForDateMs(targetDateMs)}
            cy={getY(targetPoint.beatsPerMile)}
            r={Math.max(5, Math.min(10, targetPoint.miles / 2))}
            onMouseMove={(event) =>
              onPointHover(event, "Target Marathon Effort", [
                `Date: ${formatDayLabel(targetPoint.isoDate)}`,
                "Pace: 6:30/mi",
                "HR: 140 bpm",
                "Miles: 26",
                `Relationship: ${Math.round(targetPoint.beatsPerMile)} beats/mile`
              ])
            }
            onClick={(event) => {
              event.stopPropagation();
              onPointHover(event, "Target Marathon Effort", [
                `Date: ${formatDayLabel(targetPoint.isoDate)}`,
                "Pace: 6:30/mi",
                "HR: 140 bpm",
                "Miles: 26",
                `Relationship: ${Math.round(targetPoint.beatsPerMile)} beats/mile`
              ]);
            }}
          />
          <circle
            className="fitnessTargetPointRing"
            cx={getXForDateMs(targetDateMs)}
            cy={getY(targetPoint.beatsPerMile)}
            r={Math.max(7, Math.min(12, targetPoint.miles / 2 + 2))}
          />
        </g>
      ) : null}
      {detailLevel === "full" ? (
        <>
          {onToggleYAxisBaseline ? (
            <rect
              className="fitnessYAxisToggleTarget"
              x={0}
              y={padY}
              width={padX + 8}
              height={innerH}
              onClick={(event) => {
                event.stopPropagation();
                onToggleYAxisBaseline();
              }}
            />
          ) : null}
          <text className="fitnessAxisLabel" x={width / 2} y={height - 6} textAnchor="middle">
            Date
          </text>
          <text
            className={`fitnessAxisLabel ${onToggleYAxisBaseline ? "fitnessYAxisToggleLabel" : ""}`}
            x={10}
            y={height / 2}
            transform={`rotate(-90 10 ${height / 2})`}
            textAnchor="middle"
            onClick={(event) => {
              event.stopPropagation();
              onToggleYAxisBaseline?.();
            }}
          >
            Beats per Mile (HR x pace)
          </text>
          <text className="fitnessTickLabel fitnessYAxisHint" x={padX - 2} y={padY - 7} textAnchor="end">
            {includeZeroBaseline ? "Y: 0 baseline (tap axis)" : "Y: data min (tap axis)"}
          </text>
        </>
      ) : null}
    </svg>
  );
}

function buildRunDayPoints(
  runSplitsByDate: Record<string, MileSplitPoint[]>,
  actualsByDate: Record<string, number>
): RunDayPoint[] {
  return Object.entries(runSplitsByDate)
    .map(([isoDate, splits]) => {
      const valid = splits.filter((split) => split.paceSecondsPerMile > 0 && split.heartRateBpm > 0);
      if (valid.length === 0) {
        return null;
      }
      const avgPaceSecondsPerMile = average(valid.map((split) => split.paceSecondsPerMile));
      const avgHrBpm = average(valid.map((split) => split.heartRateBpm));
      if (avgPaceSecondsPerMile == null || avgHrBpm == null) {
        return null;
      }
      const actualMiles = actualsByDate[isoDate];
      const miles = Number.isFinite(actualMiles) && actualMiles > 0 ? actualMiles : valid.length;
      return {
        isoDate,
        miles,
        avgPaceSecondsPerMile,
        avgHrBpm
      };
    })
    .filter((point): point is RunDayPoint => point != null)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function buildWeeklyFitnessPoints(
  weeklyProgress: WeeklyProgressPoint[],
  runDays: RunDayPoint[],
  actualsByDate: Record<string, number>
): WeeklyFitnessPoint[] {
  const byWeek: Record<
    string,
    { paceMiles: number; paceWeighted: number; hrMiles: number; hrWeighted: number; runDayVolumeMiles: number }
  > = {};

  runDays.forEach((day) => {
    const weekStartIso = getWeekStartIso(fromIsoDate(day.isoDate));
    if (!byWeek[weekStartIso]) {
      byWeek[weekStartIso] = { paceMiles: 0, paceWeighted: 0, hrMiles: 0, hrWeighted: 0, runDayVolumeMiles: 0 };
    }
    byWeek[weekStartIso].paceMiles += day.miles;
    byWeek[weekStartIso].paceWeighted += day.avgPaceSecondsPerMile * day.miles;
    byWeek[weekStartIso].hrMiles += day.miles;
    byWeek[weekStartIso].hrWeighted += day.avgHrBpm * day.miles;
    byWeek[weekStartIso].runDayVolumeMiles += day.miles;
  });

  const scheduleWeekStarts = weeklyProgress.map((week) => week.weekStart);
  const splitWeekStarts = Object.keys(byWeek);
  const allWeekStarts = Array.from(new Set([...scheduleWeekStarts, ...splitWeekStarts])).sort();
  const weeklyVolumeByStart = weeklyProgress.reduce<Record<string, number>>((acc, week) => {
    acc[week.weekStart] = week.actualTotal;
    return acc;
  }, {});
  const actualEntryCountByWeek = Object.keys(actualsByDate).reduce<Record<string, number>>((acc, isoDate) => {
    const weekStartIso = getWeekStartIso(fromIsoDate(isoDate));
    acc[weekStartIso] = (acc[weekStartIso] ?? 0) + 1;
    return acc;
  }, {});

  return allWeekStarts.map((weekStartIso) => {
    const aggregate = byWeek[weekStartIso];
    const avgPaceSecondsPerMile =
      aggregate && aggregate.paceMiles > 0 ? aggregate.paceWeighted / aggregate.paceMiles : null;
    const avgHrBpm = aggregate && aggregate.hrMiles > 0 ? aggregate.hrWeighted / aggregate.hrMiles : null;
    const scheduleVolume = weeklyVolumeByStart[weekStartIso] ?? 0;
    const splitVolume = aggregate?.runDayVolumeMiles ?? 0;

    return {
      weekStartIso,
      volumeMiles: scheduleVolume > 0 ? scheduleVolume : splitVolume,
      avgPaceSecondsPerMile,
      avgHrBpm,
      hasObservedData: (actualEntryCountByWeek[weekStartIso] ?? 0) > 0 || splitVolume > 0
    };
  });
}

function movingAverage(values: number[], windowSize: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSignedMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const label = Number.isInteger(Math.abs(rounded)) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  return `${rounded >= 0 ? "+" : "-"}${label} mi`;
}

function formatPace(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${minutesPart}:${String(secondsPart).padStart(2, "0")}`;
}

function formatWeekLabel(weekStartIso: string): string {
  const start = fromIsoDate(weekStartIso);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function formatDayLabel(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatShortDate(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function filterRunDaysByWindow(runDays: RunDayPoint[], window: RelationshipWindow): RunDayPoint[] {
  if (runDays.length === 0) {
    return runDays;
  }
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (window === "all" || window === "target") {
    return runDays.filter((day) => fromIsoDate(day.isoDate).getTime() <= todayDate.getTime());
  }
  const cutoff = new Date(todayDate);
  if (window === "1y") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else if (window === "6m") {
    cutoff.setMonth(cutoff.getMonth() - 6);
  } else {
    cutoff.setMonth(cutoff.getMonth() - 3);
  }
  return runDays.filter((day) => {
    const dayMs = fromIsoDate(day.isoDate).getTime();
    return dayMs >= cutoff.getTime() && dayMs <= todayDate.getTime();
  });
}

function filterWeeksByWindow(points: WeeklyFitnessPoint[], window: WeeklyWindow): WeeklyFitnessPoint[] {
  if (points.length === 0) {
    return points;
  }
  if (window === "all") {
    return points;
  }
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cutoff = new Date(endDate);
  if (window === "12m") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else if (window === "6m") {
    cutoff.setMonth(cutoff.getMonth() - 6);
  } else {
    cutoff.setMonth(cutoff.getMonth() - 3);
  }
  return points.filter((point) => {
    const weekDate = fromIsoDate(point.weekStartIso);
    const weekMs = weekDate.getTime();
    return weekMs >= cutoff.getTime() && weekMs <= endDate.getTime();
  });
}
