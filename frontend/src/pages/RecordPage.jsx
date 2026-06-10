import React, { useCallback, useState } from "react";
import { uploadRecording } from "../api/client";
import RecordButton from "../components/RecordButton";
import RecordingTimer from "../components/RecordingTimer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useMicrophonePermission } from "../hooks/useMicrophonePermission";
import { blobToDataUrl, getBlobDurationSec } from "../utils/audioData";
import { addHistoryEntry } from "../utils/historyStorage";

export default function RecordPage({ onHistoryUpdate }) {
  const [status, setStatus] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [transcript, setTranscript] = useState(null);
  const [summary, setSummary] = useState("");
  
  const { needsPermission, requestAccess, refresh } = useMicrophonePermission();

  const onPermissionGranted = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleComplete = useCallback(
    async ({ blob, durationSec, mimeType }) => {
      setStatus("Saving…");
      setPipelineStatus("TRANSCRIBING");
      setTranscript(null);
      setSummary("");

      const measuredDuration = await getBlobDurationSec(blob);
      const finalDuration = Math.max(durationSec, measuredDuration ?? 0) || 1;

      // Uploads live stream to your brand new backend /recordings handler endpoint!
      const upload = await uploadRecording(blob, { durationSec: finalDuration });

      if (!upload.ok) {
        setStatus(`Upload Failed: ${upload.message}`);
        setPipelineStatus("Upload Aborted");
        return;
      }

      let audioDataUrl = null;
      let saveWarning = null;

      if (blob.size === 0) {
        saveWarning = "No audio data in recording.";
      } else {
        try {
          audioDataUrl = await blobToDataUrl(blob);
        } catch {
          saveWarning = "Could not encode audio for playback.";
        }
      }

      const entry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        durationSec: finalDuration,
        audioDataUrl,
        transcript: "Processing live transcription via backend cluster...",
        uploadStatus: upload.message,
        mimeType: mimeType || blob.type,
      };

      try {
        addHistoryEntry(entry);
      } catch (err) {
        if (err?.name === "QuotaExceededError") {
          saveWarning = "Recording saved without audio — storage full.";
          addHistoryEntry({ ...entry, audioDataUrl: null });
        } else {
          throw err;
        }
      }

      onHistoryUpdate?.();
      const baseMsg = upload.ok ? "Saved locally." : upload.message;
      setStatus(saveWarning ? `${baseMsg} ${saveWarning}` : baseMsg);

      // Extract tracking ID generated dynamically by the database row assignment
      const taskId = upload.data?.task_id;
      if (!taskId) {
        setPipelineStatus("Task Scheduling Error");
        return;
      }

      // Establish the active state pooling loop interval check
      try {
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch(`http://localhost:8000/tasks/status/${taskId}`);
          const jobData = await statusResponse.json();

          setPipelineStatus(jobData.status);

          if (jobData.status === "COMPLETED") {
            clearInterval(pollInterval);
            setTranscript(jobData.transcript);
            setSummary(jobData.summary);
            setPipelineStatus("Done!");
            setTimeout(() => setStatus(null), 3000);
          } else if (jobData.status.includes("FAILED")) {
            clearInterval(pollInterval);
            setPipelineStatus("Pipeline Failed");
          }
        }, 2000);

      } catch (networkError) {
        console.error("Could not reach backend endpoints:", networkError);
        setPipelineStatus("Backend Offline");
      }
    },
    [onHistoryUpdate]
  );

  const { isRecording, elapsedSec, error, toggle, clearError } =
    useAudioRecorder({
      onRecordingComplete: handleComplete,
      onPermissionGranted,
    });

  const showMicBlocker = needsPermission || error === "denied";

  const handleMicBlockerClick = async () => {
    const ok = await requestAccess();
    if (ok) {
      clearError();
      refresh();
    }
  };

  return (
    <div className="page page--record">
      <RecordingTimer elapsedSec={elapsedSec} visible={isRecording} />
      <div className="record-stage">
        <div
          className={`record-button-wrap${showMicBlocker && !isRecording ? " record-button-wrap--blocked" : ""}`}
        >
          <RecordButton isRecording={isRecording} onClick={toggle} />
          {showMicBlocker && !isRecording && (
            <button
              type="button"
              className="mic-permission-blocker"
              onClick={handleMicBlockerClick}
            >
              Click for microphone permission
            </button>
          )}
        </div>
        <p className="record-hint">
          {isRecording ? "Tap to stop" : "Tap to record"}
        </p>
        {error && error !== "denied" && (
          <p className="record-error">{error}</p>
        )}
        
        {status && <p className="record-status">{status}</p>}
        
        {pipelineStatus && (
          <p className="record-status" style={{ marginTop: "0.5rem" }}>
            AI Pipeline: <span className="badge badge--ok">{pipelineStatus}</span>
          </p>
        )}
      </div>

      {/* Dynamic Results Display Area */}
      {(summary || transcript) && (
        <div style={{ padding: "0 2.5rem 3rem", maxWidth: "900px", margin: "0 auto" }}>
          {summary && (
            <div className="settings-panel">
              <h2>Meeting Summary</h2>
              <p style={{ margin: "0", lineHeight: "1.6", color: "var(--text-muted)" }}>{summary}</p>
            </div>
          )}

          {transcript && (
            <div className="settings-panel" style={{ marginTop: "1.5rem" }}>
              <h2>Diarized Transcript</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
                
                {/* Check if the backend sent a raw error message instead of an array */}
                {transcript.error ? (
                  <p style={{ color: "#f87171", fontStyle: "italic" }}>
                    Backend Notice: {transcript.error}
                  </p>
                ) : Array.isArray(transcript) ? (
                  
                  /* Safe execution loop mapping out the components cleanly */
                  transcript.map((line, index) => (
                    <div key={index} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                      <span style={{ color: "var(--accent)", fontWeight: "600", fontSize: "0.85rem", textTransform: "uppercase" }}>
                        {line.speaker}
                      </span>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.95rem", lineHeight: "1.5" }}>{line.text}</p>
                    </div>
                  ))
                ) : (
                  /* Fallback string parser wrapper */
                  <p style={{ color: "var(--text-muted)" }}>{String(transcript)}</p>
                )}

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}