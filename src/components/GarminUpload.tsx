import { useState } from "react";
import { parseGarminActivitiesCsv, type GarminActivitiesImport } from "../lib/garminActivitiesCsv";

interface GarminUploadProps {
  onActivitiesParsed: (data: GarminActivitiesImport) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function GarminUpload({ onActivitiesParsed, compact = false, disabled = false }: GarminUploadProps): JSX.Element {
  const [status, setStatus] = useState<string>("Upload a Garmin All Activities CSV to update actuals.");
  const [error, setError] = useState<string>("");
  const wrapperClassName = compact ? "uploadPanel uploadPanelCompact" : "panel uploadPanel";

  return (
    <section className={wrapperClassName}>
      <div className={compact ? "utilityItemHeader" : "panelHeader"}>
        <h2>Garmin Activities Upload</h2>
      </div>
      <div className="uploadRow">
        <input
          className="glassInput"
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          onChange={async (event) => {
            if (disabled) {
              return;
            }
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            try {
              setError("");
              setStatus(`Parsing ${file.name}...`);
              const text = await file.text();
              const parsed = parseGarminActivitiesCsv(text);
              onActivitiesParsed(parsed);
              setStatus(`Imported Garmin data from ${file.name}.`);
            } catch (parseError) {
              setError(parseError instanceof Error ? parseError.message : "Failed to parse Garmin CSV.");
              setStatus("Upload failed.");
            } finally {
              event.currentTarget.value = "";
            }
          }}
        />
      </div>
      <p className="uploadStatus">{status}</p>
      {disabled ? <p className="uploadStatus">Sign in as owner to upload.</p> : null}
      {error ? <p className="uploadError">{error}</p> : null}
    </section>
  );
}
