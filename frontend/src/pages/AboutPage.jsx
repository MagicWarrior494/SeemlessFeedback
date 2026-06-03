import React from "react";

export default function AboutPage() {
  return (
    <div className="page page--about">
      <header className="page-header">
        <h1>About</h1>
        <p className="page-subtitle">SeemlessFeedback</p>
      </header>
      <section className="about-panel">
        <p>
          Capture voice feedback, send audio to the FastAPI backend, and view
          transcripts in History.
        </p>
        <p className="about-version">Frontend v0.1 · React + Vite</p>
      </section>
    </div>
  );
}
