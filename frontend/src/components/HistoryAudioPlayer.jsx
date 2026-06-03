import React, { useEffect, useRef, useState } from "react";
import { formatDuration } from "../utils/historyStorage";

export default function HistoryAudioPlayer({ audioDataUrl, durationSec }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSec ?? 0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setTotalSec(durationSec ?? 0);
    setLoadError(false);
    setPlaying(false);
    setProgress(0);
    setCurrentSec(0);
  }, [audioDataUrl, durationSec]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioDataUrl) return undefined;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setTotalSec((prev) =>
          Math.max(prev, Math.ceil(audio.duration))
        );
      }
      setLoadError(false);
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentSec(0);
    };
    const onTimeUpdate = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentSec(Math.floor(audio.currentTime));
      }
    };
    const onError = () => setLoadError(true);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("error", onError);

    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("error", onError);
    };
  }, [audioDataUrl]);

  if (!audioDataUrl) {
    return (
      <p className="history-audio-missing">
        No audio saved for this entry. Record again to capture playback.
      </p>
    );
  }

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || loadError) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setLoadError(true);
    }
  };

  return (
    <div className="history-audio">
      <audio ref={audioRef} src={audioDataUrl} preload="auto" />
      <button
        type="button"
        className="history-audio-play"
        onClick={togglePlay}
        disabled={loadError}
        aria-label={playing ? "Pause" : "Play recording"}
      >
        {playing ? (
          <span className="history-audio-icon history-audio-icon--pause" />
        ) : (
          <span className="history-audio-icon history-audio-icon--play" />
        )}
      </button>
      <div className="history-audio-track">
        <div className="history-audio-bar">
          <div
            className="history-audio-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="history-audio-time">
          {loadError
            ? "Could not play audio"
            : `${formatDuration(currentSec)} / ${formatDuration(totalSec)}`}
        </span>
      </div>
    </div>
  );
}
