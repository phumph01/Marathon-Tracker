import { useEffect } from "react";
import type { MileSplitPoint } from "../lib/runMileSplits";

interface RunSplitDetailModalProps {
  isoDate: string;
  splits: MileSplitPoint[];
  showTargetPaceOverlay?: boolean;
  targetPaceSecondsPerMile?: number;
  onClose: () => void;
}

const WIDTH = 760;
const HEIGHT = 360;
const PADDING_LEFT = 58;
const PADDING_RIGHT = 56;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 40;
const PACE_MIN_SECONDS = 6 * 60;
const PACE_MAX_SECONDS = 10 * 60;
const HR_MIN_BPM = 120;
const HR_MAX_BPM = 180;

export function RunSplitDetailModal({
  isoDate,
  splits,
  showTargetPaceOverlay = false,
  targetPaceSecondsPerMile = 390,
  onClose
}: RunSplitDetailModalProps): JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

  const axisTicks = [0, 0.25, 0.5, 0.75, 1];
  const targetPaceY = getPaceY(targetPaceSecondsPerMile);

  return (
    <div className="runSplitModalOverlay" role="dialog" aria-modal="true" aria-label={`Run details for ${isoDate}`}>
      <div className="runSplitModalBackdrop" onClick={onClose} />
      <section className="runSplitModal panel">
        <div className="runSplitModalHeader">
          <h3>Run Details ({isoDate})</h3>
          <button type="button" className="navButton bubbleInteractive" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="runSplitModalLegend">
          <span className="runSplitLegendPace">Pace</span>
          <span className="runSplitLegendHr">HR</span>
        </div>
        <svg className="runSplitDetailChart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {axisTicks.map((ratio) => {
            const y = PADDING_TOP + ratio * plotHeight;
            const paceValue = PACE_MIN_SECONDS + (PACE_MAX_SECONDS - PACE_MIN_SECONDS) * ratio;
            const hrValue = HR_MAX_BPM - (HR_MAX_BPM - HR_MIN_BPM) * ratio;
            return (
              <g key={ratio}>
                <line className="runSplitGridLine" x1={PADDING_LEFT} y1={y} x2={WIDTH - PADDING_RIGHT} y2={y} />
                <text className="runSplitAxisLabel runSplitPaceAxis" x={PADDING_LEFT - 8} y={y + 4} textAnchor="end">
                  {formatPace(paceValue)}
                </text>
                <text className="runSplitAxisLabel runSplitHrAxis" x={WIDTH - PADDING_RIGHT + 8} y={y + 4} textAnchor="start">
                  {Math.round(hrValue)}
                </text>
              </g>
            );
          })}
          <text className="runSplitAxisTitle runSplitPaceAxis" x={PADDING_LEFT - 40} y={PADDING_TOP - 6}>
            Pace (min/mi)
          </text>
          <text className="runSplitAxisTitle runSplitHrAxis" x={WIDTH - PADDING_RIGHT + 10} y={PADDING_TOP - 6}>
            HR (bpm)
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
              <text
                className="runSplitTargetPaceLabel"
                x={WIDTH - PADDING_RIGHT - 2}
                y={Math.max(PADDING_TOP + 11, targetPaceY - 6)}
                textAnchor="end"
              >
                {`Target ${formatPace(targetPaceSecondsPerMile)}`}
              </text>
            </>
          ) : null}

          <polyline className="runSplitPaceLine" points={pacePoints} />
          <polyline className="runSplitHrLine" points={hrPoints} />

          {splits.map((split, index) => {
            const x = PADDING_LEFT + index * stepX;
            const paceY = getPaceY(split.paceSecondsPerMile);
            const hrY = getY(split.heartRateBpm, HR_MIN_BPM, HR_MAX_BPM);
            return (
              <g key={`${split.mileIndex}-${index}`}>
                <circle className="runSplitPacePoint" cx={x} cy={paceY} r="3.5" />
                <circle className="runSplitHrPoint" cx={x} cy={hrY} r="3.5" />
                <text className="runSplitAxisLabel runSplitMileLabel" x={x} y={HEIGHT - 14} textAnchor="middle">
                  {split.mileIndex}
                </text>
              </g>
            );
          })}
          <text className="runSplitAxisTitle" x={WIDTH / 2} y={HEIGHT - 4} textAnchor="middle">
            Miles
          </text>
        </svg>
      </section>
    </div>
  );
}

function formatPace(secondsPerMile: number): string {
  const total = Math.max(0, Math.round(secondsPerMile));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
