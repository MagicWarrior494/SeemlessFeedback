import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useAudioRecorder({ onRecordingComplete, onPermissionGranted } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const elapsedSecRef = useRef(0);
  const stopDurationSecRef = useRef(null);
  const onCompleteRef = useRef(onRecordingComplete);

  useEffect(() => {
    onCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  useEffect(() => {
    if (!isRecording) return undefined;

    const id = setInterval(() => {
      if (startedAtRef.current) {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        elapsedSecRef.current = sec;
        setElapsedSec(sec);
      }
    }, 200);

    return () => clearInterval(id);
  }, [isRecording]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const computeDurationSec = useCallback(() => {
    if (stopDurationSecRef.current != null) {
      return Math.max(1, stopDurationSecRef.current);
    }
    if (startedAtRef.current) {
      return Math.max(
        1,
        Math.ceil((Date.now() - startedAtRef.current) / 1000)
      );
    }
    return Math.max(1, elapsedSecRef.current || 1);
  }, []);

  const finalizeRecording = useCallback(
    (recorder) => {
      const durationSec = computeDurationSec();
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });

      stopTracks();
      chunksRef.current = [];
      startedAtRef.current = null;
      elapsedSecRef.current = 0;
      stopDurationSecRef.current = null;
      mediaRecorderRef.current = null;

      if (blob.size === 0) {
        setError("Recording failed — no audio data captured. Try again.");
        return;
      }

      onCompleteRef.current?.({ blob, durationSec, mimeType });
    },
    [computeDurationSec, stopTracks]
  );

  const start = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    elapsedSecRef.current = 0;
    stopDurationSecRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); //here
      onPermissionGranted?.();
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        finalizeRecording(recorder);
      };

      recorder.onerror = () => {
        setError("Recording error. Please try again.");
        stopTracks();
        setIsRecording(false);
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setIsRecording(true);
    } catch (err) {
      stopTracks();
      if (err?.name === "NotAllowedError") {
        setError("denied");
      } else {
        setError("Could not access microphone.");
      }
    }
  }, [finalizeRecording, onPermissionGranted, stopTracks]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }

    if (startedAtRef.current) {
      const sec = Math.ceil((Date.now() - startedAtRef.current) / 1000);
      stopDurationSecRef.current = Math.max(elapsedSecRef.current, sec, 1);
      elapsedSecRef.current = stopDurationSecRef.current;
    }

    setIsRecording(false);

    try {
      if (recorder.state === "recording") {
        recorder.requestData();
      }
      recorder.stop();
    } catch {
      setError("Could not stop recording.");
      stopTracks();
    }
  }, [stopTracks]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  const clearError = useCallback(() => setError(null), []);

  return { isRecording, elapsedSec, error, start, stop, toggle, clearError };
}
