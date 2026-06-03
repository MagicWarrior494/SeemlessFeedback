import React from "react";
import { formatDuration } from "../utils/historyStorage";

export default function RecordingTimer({ elapsedSec, visible }) {
  if (!visible) return null;

  return (
    <div className="recording-timer" role="timer" aria-live="polite">
      <span className="recording-timer-dot" aria-hidden="true" />
      <span className="recording-timer-label">Recording</span>
      <span className="recording-timer-value">{formatDuration(elapsedSec)}</span>
    </div>
  );
}
