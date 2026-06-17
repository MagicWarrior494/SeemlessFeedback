import React from "react";
import HistoryAudioPlayer from "../components/HistoryAudioPlayer";
import HistoryDuration from "../components/HistoryDuration";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function HistoryPage({ entries, onClear }) {
  if (entries.length === 0) {
    return (
      <div className="page page--history">
        <header className="page-header">
          <h1>History</h1>
          <p className="page-subtitle">Past recordings and transcripts appear here.</p>
        </header>
        <div className="empty-state">
          <p>No recordings yet.</p>
          <p className="empty-state-hint">Use Record to capture your first clip.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--history">
      <header className="page-header page-header--row">
        <div>
          <h1>History</h1>
          <p className="page-subtitle">{entries.length} recording(s)</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClear}>
          Clear all
        </button>
      </header>
      <ul className="history-list">
        {entries.map((item) => (
          <li key={item.id} className="history-card">
            <div className="history-card-meta">
              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              <HistoryDuration
                audioDataUrl={item.audioDataUrl}
                durationSec={item.durationSec}
              />
            </div>
            <HistoryAudioPlayer
              audioDataUrl={item.audioDataUrl}
              durationSec={item.durationSec}
            />
            <p className="history-transcript">{item.transcript}</p>
            {item.uploadStatus && (
              <p className="history-upload-status">{item.uploadStatus}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
