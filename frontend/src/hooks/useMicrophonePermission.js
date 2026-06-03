import { useCallback, useEffect, useState } from "react";

export function useMicrophonePermission() {
  const [permission, setPermission] = useState("checking");

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      return;
    }

    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: "microphone" });
        setPermission(status.state);
        status.onchange = () => setPermission(status.state);
        return;
      } catch {
        /* fall through — Safari etc. */
      }
    }

    setPermission("prompt");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
      return true;
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setPermission("denied");
      }
      return false;
    }
  }, []);

  const needsPermission = permission !== "granted" && permission !== "checking";

  return { permission, needsPermission, requestAccess, refresh };
}
