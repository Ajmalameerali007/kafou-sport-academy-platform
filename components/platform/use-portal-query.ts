"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/platform/client";
/** Context key is part of state: a late response can never paint under another child/branch. */
export function usePortalQuery<T>(path: string, enabled = true) {
  const [state, setState] = useState<{
    path: string;
    data?: T;
    error?: string;
    denied?: boolean;
  }>({ path: "" });
  const [version, setVersion] = useState(0);
  const epoch = useRef(0);
  const refresh = useCallback(() => setVersion((x) => x + 1), []);
  useEffect(() => {
    const requestEpoch = ++epoch.current;
    let running = false;
    let stopped = false;
    if (!enabled) return;
    const read = async () => {
      if (running || stopped) return;
      running = true;
      const result = await api<T>(path);
      running = false;
      if (stopped || epoch.current !== requestEpoch) return;
      if (result.ok) setState({ path, data: result.data });
      else {
        const denied = ["unauthenticated", "forbidden", "not_found"].includes(
          result.code,
        );
        setState((previous) => ({
          path,
          error: result.message,
          denied,
          data: !denied && previous.path === path ? previous.data : undefined,
        }));
      }
    };
    void read();
    const poll = () => {
      if (document.visibilityState === "visible") void read();
    };
    const timer = window.setInterval(poll, 1200);
    window.addEventListener("focus", poll);
    window.addEventListener("kafou:saved", poll);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
      window.removeEventListener("kafou:saved", poll);
    };
  }, [path, enabled, version]);
  return {
    data: enabled && state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : undefined,
    denied: state.path === path && state.denied === true,
    refresh,
  };
}
