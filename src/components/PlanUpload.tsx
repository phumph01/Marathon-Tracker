import { useState } from "react";
import { parseCsvPlan } from "../lib/csvPlan";
import type { TrainingSchedule } from "../types/schedule";

interface PlanUploadProps {
  onScheduleParsed: (schedule: TrainingSchedule) => void;
  compact?: boolean;
}

export function PlanUpload({ onScheduleParsed, compact = false }: PlanUploadProps): JSX.Element {
  const [status, setStatus] = useState<string>("Upload a CSV plan to replace the sample schedule.");
  const [error, setError] = useState<string>("");
  const wrapperClassName = compact ? "uploadPanel uploadPanelCompact" : "panel uploadPanel";

  return (
    <section className={wrapperClassName}>
      <div className={compact ? "utilityItemHeader" : "panelHeader"}>
        <h2>{compact ? "Plan Upload" : "Plan Upload"}</h2>
      </div>
      <div className="uploadRow">
        <input
          className="glassInput"
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            try {
              setError("");
              setStatus(`Parsing ${file.name}...`);
              const text = await file.text();
              const schedule = parseCsvPlan(text, file.name.replace(/\.csv$/i, ""));
              onScheduleParsed(schedule);
              setStatus(`Loaded ${Object.keys(schedule.plannedMilesByDate).length} days from ${file.name}.`);
            } catch (parseError) {
              setError(parseError instanceof Error ? parseError.message : "Failed to parse CSV.");
              setStatus("Upload failed.");
            } finally {
              event.currentTarget.value = "";
            }
          }}
        />
      </div>
      <p className="uploadStatus">{status}</p>
      {error ? <p className="uploadError">{error}</p> : null}
    </section>
  );
}

