import React, { useEffect, useState } from "react";
import { checkBackendHealth } from "../api/client";

export default function SettingsPage() {
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    checkBackendHealth().then(setBackendOk);
  }, []);

  return (
    <div className="page page--settings">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="page-subtitle">App preferences (more coming soon).</p>
      </header>
      <section className="settings-panel">
        <h2>Backend</h2>
        <p className="settings-row">
          API status:{" "}
          <span
            className={
              backendOk === null
                ? "badge badge--muted"
                : backendOk
                  ? "badge badge--ok"
                  : "badge badge--err"
            }
          >
            {backendOk === null
              ? "Checking…"
              : backendOk
                ? "Connected"
                : "Offline"}
          </span>
        </p>
        <p className="settings-hint">http://127.0.0.1:8000</p>
      </section>
      <section className="settings-panel">
        <h2>Storage</h2>
        <p className="settings-hint">
          Recordings metadata is stored in this browser&apos;s localStorage until
          the backend history API is available.
        </p>
      </section>
    </div>
  );
}
