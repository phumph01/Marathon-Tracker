import { useEffect, useRef, useState } from "react";
import { toIsoDate } from "../lib/dateUtils";
import { parseActivityCsv, type ActivityCsvImport } from "../lib/activityCsv";
import type { IsoDateString } from "../types/schedule";

interface ActivityUploadPayload {
  selectedDateIso: IsoDateString;
  doubleRun: boolean;
  parsed: ActivityCsvImport;
}

interface ActivityUploadProps {
  onActivityParsed: (payload: ActivityUploadPayload) => void;
  compact?: boolean;
  persistedStatusMessage?: string;
}

export function ActivityUpload({
  onActivityParsed,
  compact = false,
  persistedStatusMessage
}: ActivityUploadProps): JSX.Element {
  const [selectedDateIso, setSelectedDateIso] = useState<IsoDateString>(toIsoDate(new Date()));
  const [doubleRun, setDoubleRun] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>(
    "Choose an activity CSV, then click Submit to apply it to Actuals."
  );
  const [error, setError] = useState<string>("");
  const wrapperClassName = compact ? "uploadPanel uploadPanelCompact" : "panel uploadPanel";

  useEffect(() => {
    if (!persistedStatusMessage) {
      return;
    }
    setError("");
    setStatus(persistedStatusMessage);
  }, [persistedStatusMessage]);

  return (
    <section className={wrapperClassName}>
      <div className={compact ? "utilityItemHeader" : "panelHeader"}>
        <h2>Single Activity Upload</h2>
      </div>

      <div className="activityUploadControls">
        <label className="activityUploadDateLabel" htmlFor="activityDateInput">
          Run date
        </label>
        <input
          id="activityDateInput"
          className="glassInput"
          type="date"
          value={selectedDateIso}
          onChange={(event) => {
            setSelectedDateIso(event.target.value as IsoDateString);
          }}
        />
        <label className="activityUploadCheckbox">
          <input
            type="checkbox"
            checked={doubleRun}
            onChange={(event) => {
              setDoubleRun(event.target.checked);
            }}
          />
          Double run (add to existing Actual miles)
        </label>
      </div>

      <div className="uploadRow">
        <input
          ref={fileInputRef}
          className="glassInput"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setSelectedFile(null);
              return;
            }
            setSelectedFile(file);
            setError("");
            setStatus(`Ready to import ${file.name}. Click Submit when ready.`);
          }}
        />
        <button
          type="button"
          className="navButton bubbleInteractive"
          disabled={!selectedFile}
          onClick={async () => {
            if (!selectedFile) {
              return;
            }

            try {
              if (!selectedDateIso) {
                throw new Error("Choose a run date before uploading.");
              }

              setError("");
              setStatus(`Parsing ${selectedFile.name}...`);
              const text = await selectedFile.text();
              const parsed = parseActivityCsv(text);
              onActivityParsed({
                selectedDateIso,
                doubleRun,
                parsed
              });
              setStatus(
                `Imported ${parsed.totalMiles} miles for ${selectedDateIso} (${doubleRun ? "double run" : "replace"} mode).`
              );
            } catch (parseError) {
              setError(parseError instanceof Error ? parseError.message : "Failed to parse activity CSV.");
              setStatus("Upload failed.");
            } finally {
              setSelectedFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }
          }}
        >
          Submit
        </button>
      </div>

      <p className="uploadStatus">{status}</p>
      {error ? <p className="uploadError">{error}</p> : null}
    </section>
  );
}

export type { ActivityUploadPayload };
