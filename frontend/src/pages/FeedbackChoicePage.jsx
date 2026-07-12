import React from "react";

export default function FeedbackChoicePage({ onChoose }) {
  return (
    <div className="page feedback-choice-page">
      <section className="hero-card">
        <p className="eyebrow">Student feedback</p>
        <h1>How would you like to give your feedback?</h1>
        <p>
          Choose the format that matches what you have. You can record or upload
          an audio conversation, or paste/upload a written transcript.
        </p>
        <div className="choice-grid">
          <button type="button" className="choice-card" onClick={() => onChoose("record")}>
            <span className="choice-icon">🎙️</span>
            <span className="choice-title">Audio conversation</span>
            <span className="choice-copy">
              Record live audio or upload an audio file, then review the transcript.
            </span>
          </button>
          <button type="button" className="choice-card" onClick={() => onChoose("text")}>
            <span className="choice-icon">📝</span>
            <span className="choice-title">Text or transcription</span>
            <span className="choice-copy">
              Paste or upload a transcript and jump straight into summarizing.
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
