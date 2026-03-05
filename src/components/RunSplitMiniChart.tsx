import type { MileSplitPoint } from "../lib/runMileSplits";

interface RunSplitMiniChartProps {
  splits: MileSplitPoint[];
  showTargetPaceOverlay?: boolean;
  targetPaceSecondsPerMile?: number;
}

const WIDTH = 210;
const HEIGHT = 122;
const PADDING_LEFT = 26;
const PADDING_RIGHT = 26;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 26;
const PACE_MIN_SECONDS = 6 * 60;
const PACE_MAX_SECONDS = 10 * 60;
const HR_MIN_BPM = 120;
const HR_MAX_BPM = 180;

export function RunSplitMiniChart({
  splits,
  showTargetPaceOverlay = false,
  targetPaceSecondsPerMile = 390
}: RunSplitMiniChartProps): JSX.Element {
  if (splits.length === 0) {
    return null;
  }

  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = splits.length > 1 ? plotWidth / (splits.length - 1) : 0;

  const getY = (value: number, min: number, max: number): number => {
    if (max === min) {
      return PADDING_TOP + plotHeight / 2;
    }
    const clamped = Math.min(max, Math.max(min, value));
    const ratio = (clamped - min) / (max - min);
    return PADDING_TOP + plotHeight - ratio * plotHeight;
  };

  const getPaceY = (paceSecondsPerMile: number): number => {
    const clamped = Math.min(PACE_MAX_SECONDS, Math.max(PACE_MIN_SECONDS, paceSecondsPerMile));
    const ratio = (clamped - PACE_MIN_SECONDS) / (PACE_MAX_SECONDS - PACE_MIN_SECONDS);
    return PADDING_TOP + ratio * plotHeight;
  };

  const pacePoints = splits
    .map((split, index) => `${PADDING_LEFT + index * stepX},${getPaceY(split.paceSecondsPerMile)}`)
    .join(" ");
  const hrPoints = splits
    .map((split, index) => `${PADDING_LEFT + index * stepX},${getY(split.heartRateBpm, HR_MIN_BPM, HR_MAX_BPM)}`)
    .join(" ");

  const targetPaceY = getPaceY(targetPaceSecondsPerMile);

  return (
    <div className="runSplitChartWrap" aria-hidden="true">
      <div className="runSplitLegend">
        <span className="runSplitLegendPace">Pace</span>
        <span className="runSplitLegendHr">HR</span>
      </div>
      <svg className="runSplitChart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <line className="runSplitGridLine" x1={PADDING_LEFT} y1={PADDING_TOP + plotHeight} x2={WIDTH - PADDING_RIGHT} y2={PADDING_TOP + plotHeight} />
        <line className="runSplitGridLine" x1={PADDING_LEFT} y1={PADDING_TOP} x2={WIDTH - PADDING_RIGHT} y2={PADDING_TOP} />
        <line className="runSplitGridLine" x1={PADDING_LEFT} y1={PADDING_TOP + plotHeight / 2} x2={WIDTH - PADDING_RIGHT} y2={PADDING_TOP + plotHeight / 2} />
        <text className="runSplitMiniAxisLabel runSplitMiniPaceAxis" x={PADDING_LEFT - 2} y={PADDING_TOP + 4} textAnchor="end">
          6:00
        </text>
        <text className="runSplitMiniAxisLabel runSplitMiniPaceAxis" x={PADDING_LEFT - 2} y={PADDING_TOP + plotHeight + 4} textAnchor="end">
          10:00
        </text>
        <text className="runSplitMiniAxisLabel runSplitMiniHrAxis" x={WIDTH - PADDING_RIGHT + 2} y={PADDING_TOP + 4} textAnchor="start">
          180
        </text>
        <text className="runSplitMiniAxisLabel runSplitMiniHrAxis" x={WIDTH - PADDING_RIGHT + 2} y={PADDING_TOP + plotHeight + 4} textAnchor="start">
          120
        </text>
        {showTargetPaceOverlay ? (
          <>
            <line
              className="runSplitTargetPaceLine"
              x1={PADDING_LEFT}
              y1={targetPaceY}
              x2={WIDTH - PADDING_RIGHT}
              y2={targetPaceY}
            />
            <text className="runSplitTargetPaceLabel" x={WIDTH - PADDING_RIGHT} y={Math.max(PADDING_TOP + 9, targetPaceY - 4)} textAnchor="end">
              {`Target ${formatPace(targetPaceSecondsPerMile)}`}
            </text>
          </>
        ) : null}
        <polyline className="runSplitPaceLine" points={pacePoints} />
        <polyline className="runSplitHrLine" points={hrPoints} />
        {splits.map((split, index) => {
          const x = PADDING_LEFT + index * stepX;
          return (
            <text key={`${split.mileIndex}-${index}`} className="runSplitMiniMileLabel" x={x} y={HEIGHT - 5} textAnchor="middle">
              {split.mileIndex}
            </text>
          );
        })}
        <text className="runSplitMiniAxisTitle" x={WIDTH / 2} y={HEIGHT - 14} textAnchor="middle">
          Miles
        </text>
      </svg>
    </div>
  );
}

function formatPace(secondsPerMile: number): string {
  const total = Math.max(0, Math.round(secondsPerMile));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
