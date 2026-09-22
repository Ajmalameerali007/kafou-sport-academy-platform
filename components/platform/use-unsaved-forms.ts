"use client";
import { useCallback, useEffect, useRef } from "react";

/** Drafts stay in the mounted form, never in local storage. */
export function useUnsavedForms(message: string) {
  const dirty = useRef(new Set<HTMLFormElement>());
  const hasChanges = useCallback(
    () => [...dirty.current].some((form) => form.isConnected),
    [],
  );
  const allowLeave = useCallback(
    () => !hasChanges() || window.confirm(message),
    [hasChanges, message],
  );
  useEffect(() => {
    const changed = (event: Event) => {
      const el = event.target;
      if (el instanceof HTMLElement) {
        const form = el.closest("form");
        if (form && form.closest(".ops-shell,.portal-drawer"))
          dirty.current.add(form);
      }
    };
    const saved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const form = detail instanceof HTMLFormElement ? detail : detail?.form;
      if (form instanceof HTMLFormElement) dirty.current.delete(form);
    };
    const reset = (event: Event) => {
      if (event.target instanceof HTMLFormElement)
        dirty.current.delete(event.target);
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (hasChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const link = (event: MouseEvent) => {
      const el = event.target;
      if (!(el instanceof Element)) return;
      const anchor = el.closest("a[href]");
      if (
        anchor &&
        !(anchor as HTMLAnchorElement).download &&
        !anchor.hasAttribute("target") &&
        !event.defaultPrevented &&
        !allowLeave()
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("input", changed);
    document.addEventListener("change", changed);
    document.addEventListener("reset", reset);
    document.addEventListener("click", link, true);
    window.addEventListener("kafou:saved", saved);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("input", changed);
      document.removeEventListener("change", changed);
      document.removeEventListener("reset", reset);
      document.removeEventListener("click", link, true);
      window.removeEventListener("kafou:saved", saved);
      window.removeEventListener("beforeunload", unload);
    };
  }, [allowLeave, hasChanges]);
  return { hasChanges, allowLeave };
}
