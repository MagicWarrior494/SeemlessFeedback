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
  const { needsPermission, requestAccess, refresh } = useMicrophonePermission();

  const onPermissionGranted = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleComplete = useCallback(
    async ({ blob, durationSec, mimeType }) => {
      setStatus("Saving…");

      const measuredDuration = await getBlobDurationSec(blob);
      const finalDuration = Math.max(durationSec, measuredDuration ?? 0) || 1;

      const upload = await uploadRecording(blob, { durationSec: finalDuration });

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
        transcript: upload.ok
          ? "Transcript pending from backend…"
          : "Transcript pending (upload stub — backend not ready)",
        uploadStatus: upload.message,
        mimeType: mimeType || blob.type,
      };

      try {
        addHistoryEntry(entry);
      } catch (err) {
        if (err?.name === "QuotaExceededError") {
          saveWarning =
            "Recording saved without audio — storage full. Clear old history or use shorter clips.";
          addHistoryEntry({ ...entry, audioDataUrl: null });
        } else {
          throw err;
        }
      }

      onHistoryUpdate?.();
      const baseMsg = upload.ok ? "Saved and sent to backend." : upload.message;
      setStatus(saveWarning ? `${baseMsg} ${saveWarning}` : baseMsg);
      setTimeout(() => setStatus(null), 5000);
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
      </div>
    </div>
  );
}
