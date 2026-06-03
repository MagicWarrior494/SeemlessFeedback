import React, { useEffect, useState } from "react";
import { getDataUrlDurationSec } from "../utils/audioData";
import { formatDuration } from "../utils/historyStorage";

export default function HistoryDuration({ audioDataUrl, durationSec }) {
  const [displaySec, setDisplaySec] = useState(durationSec ?? 0);

  useEffect(() => {
    let cancelled = false;
    const fallback = durationSec ?? 0;
    setDisplaySec(fallback);

    if (!audioDataUrl) return undefined;

    getDataUrlDurationSec(audioDataUrl).then((measured) => {
      if (cancelled) return;
      const best = Math.max(fallback, measured ?? 0) || fallback;
      setDisplaySec(best);
    });

    return () => {
      cancelled = true;
    };
  }, [audioDataUrl, durationSec]);

  return (
    <span className="history-duration">{formatDuration(displaySec)}</span>
  );
}
