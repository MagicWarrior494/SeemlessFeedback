import React from "react";

export default function RecordButton({ isRecording, onClick, disabled }) {
  return (
    <button
      type="button"
      className={`tape-record-btn${isRecording ? " tape-record-btn--recording" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isRecording}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      <span className="tape-record-housing">
        <span className="tape-record-cap" aria-hidden="true" />
        <span className="tape-record-label">REC</span>
      </span>
    </button>
  );
}
