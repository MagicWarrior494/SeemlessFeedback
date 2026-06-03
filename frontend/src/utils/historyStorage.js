const STORAGE_KEY = "seemlessfeedback_recordings";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(entry) {
  const list = loadHistory();
  const next = [{ ...entry, id: entry.id ?? crypto.randomUUID() }, ...list];
  saveHistory(next);
  return next;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
