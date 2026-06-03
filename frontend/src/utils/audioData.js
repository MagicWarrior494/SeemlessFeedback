function durationFromAudioElement(audio) {
  const d = audio.duration;
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.max(1, Math.ceil(d));
}

export function blobToDataUrl(blob) {
  if (!blob || blob.size === 0) {
    return Promise.reject(new Error("Empty audio blob"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
      } else {
        reject(new Error("Invalid data URL"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

function measureAudioDuration(audio, { onCleanup } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let best = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      onCleanup?.();
      audio.removeAttribute("src");
      resolve(value);
    };

    const tryRead = () => {
      const sec = durationFromAudioElement(audio);
      if (sec != null) {
        best = best == null ? sec : Math.max(best, sec);
        finish(best);
      }
    };

    audio.addEventListener("loadedmetadata", tryRead);
    audio.addEventListener("durationchange", tryRead);
    audio.addEventListener("error", () => finish(null), { once: true });
    setTimeout(() => finish(best), 4000);
  });
}

/** Measure encoded audio length (may be unreliable for WebM — prefer max with timer). */
export function getBlobDurationSec(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.src = url;
  return measureAudioDuration(audio, {
    onCleanup: () => URL.revokeObjectURL(url),
  });
}

/** Read duration from a stored data URL (fixes history labels for old entries). */
export function getDataUrlDurationSec(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  const audio = new Audio();
  audio.src = dataUrl;
  return measureAudioDuration(audio);
}
