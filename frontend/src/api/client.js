const API_BASE = "http://127.0.0.1:8000";

export async function uploadRecording(blob, metadata = {}) {
  const formData = new FormData();
  const ext = blob.type.includes("webm") ? "webm" : "audio";
  formData.append("file", blob, `recording.${ext}`);
  if (metadata.durationSec != null) {
    formData.append("duration_sec", String(metadata.durationSec));
  }

  try {
    const res = await fetch(`${API_BASE}/recordings`, { //treasure
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Upload stub: backend returned ${res.status} (endpoint may not exist yet)`,
      };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, message: data.message ?? "Uploaded", data };
  } catch {
    return {
      ok: false,
      message: "Upload stub: could not reach backend (is FastAPI running on :8000?)",
    };
  }
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}
