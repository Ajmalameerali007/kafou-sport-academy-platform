"use client";
import { Dialog } from "radix-ui";
import {
  X,
  ArrowUpRight,
  Inbox,
  Waves,
  Goal,
  CircleDot,
  Swords,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/kafou/locale";
export function PortalDrawer({
  open,
  onClose,
  title,
  description,
  children,
  compact = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const dirty = useRef(new Set<Element>());
  const [confirmClose, setConfirmClose] = useState(false);
  const keepEditing = useRef<HTMLButtonElement | null>(null);
  const descriptionId = useId();
  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const form = detail instanceof HTMLFormElement ? detail : detail?.form;
      if (form) dirty.current.delete(form);
      else if (content.current)
        content.current
          .querySelectorAll(".portal-roster-detail")
          .forEach((el) => dirty.current.delete(el));
    };
    window.addEventListener("kafou:saved", saved);
    return () => window.removeEventListener("kafou:saved", saved);
  }, []);
  useEffect(() => {
    if (confirmClose) keepEditing.current?.focus();
  }, [confirmClose]);
  const close = () => {
    if (
      content.current?.querySelector("form button:disabled, [aria-busy=true]")
    ) {
      setConfirmClose(true);
      return;
    }
    if ([...dirty.current].some((el) => el.isConnected)) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    dirty.current.clear();
    onClose();
  };
  const track = (target: EventTarget) => {
    if (!(target instanceof Element)) return;
    const owner =
      target.closest("form") ||
      target
        .closest(".portal-attendance-controls, [data-draft-change]")
        ?.closest(".portal-roster-detail");
    if (owner) dirty.current.add(owner);
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="portal-overlay" />
        <Dialog.Content
          ref={content}
          onInputCapture={(event) => track(event.target)}
          onChangeCapture={(event) => track(event.target)}
          onClickCapture={(event) => {
            if (
              (event.target as Element).closest(
                ".portal-attendance-buttons, [data-draft-change]",
              )
            )
              track(event.target);
          }}
          onOpenAutoFocus={(event) => {
            returnFocus.current = document.activeElement as HTMLElement;
            const input =
              content.current?.querySelector<HTMLElement>("[data-autofocus]");
            if (input) {
              event.preventDefault();
              input.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
          className={`portal-drawer ${compact ? "portal-command" : ""}`}
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="portal-drawer-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id={descriptionId}>
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="portal-icon-button"
              aria-label={t("Close panel")}
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {confirmClose && (
            <div className="portal-unsaved" role="alert">
              <strong>{t("Unsaved changes")}</strong>
              <p>
                {t(
                  "Keep editing, or discard this draft before leaving. Wait for any save to finish.",
                )}
              </p>
              <div>
                <button
                  ref={keepEditing}
                  className="portal-primary"
                  onClick={() => setConfirmClose(false)}
                >
                  {t("Keep editing")}
                </button>
                <button
                  className="portal-link"
                  onClick={() => {
                    if (
                      content.current?.querySelector(
                        "form button:disabled, [aria-busy=true]",
                      )
                    )
                      return;
                    dirty.current.clear();
                    setConfirmClose(false);
                    onClose();
                  }}
                >
                  {t("Discard changes")}
                </button>
              </div>
            </div>
          )}
          <div className="portal-drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    trial_booked: "Trial Booked",
    trial_attended: "Trial Attended",
    walk_in: "Walk-in",
    new: "New",
    contacted: "Contacted",
    converted: "Converted",
    lost: "Lost",
  };
  return (
    labels[status] ||
    status.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase())
  );
}
export function StatusBadge({ status }: { status: string }) {
  const { t } = useLocale();
  const tone = [
    "active",
    "present",
    "converted",
    "attended",
    "completed",
    "trial_attended",
  ].includes(status)
    ? "green"
    : ["lost", "absent", "cancelled", "missed"].includes(status)
      ? "red"
      : ["booked", "trial_booked", "scheduled", "contacted"].includes(status)
        ? "blue"
        : ["pending", "late", "requested"].includes(status)
          ? "amber"
          : "gray";
  return (
    <span className={`portal-badge ${tone}`}>
      <i />
      {t(statusLabel(status))}
    </span>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span
      className={`portal-avatar ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {name
        .replace(/DEMO\s*[·:]?\s*/i, "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((x) => x[0])
        .join("")
        .toUpperCase() || "K"}
    </span>
  );
}
export function SportIcon({ sport }: { sport: string }) {
  const Icon =
    sport === "swimming"
      ? Waves
      : sport === "football"
        ? Goal
        : sport === "karate"
          ? Swords
          : CircleDot;
  return <Icon size={22} strokeWidth={1.7} aria-hidden="true" />;
}
export function EmptyState({
  title,
  copy,
  action,
  onAction,
}: {
  title: string;
  copy?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="portal-empty">
      <span>
        <Inbox size={24} />
      </span>
      <h3>{t(title)}</h3>
      {copy && <p>{t(copy)}</p>}
      {action && onAction && (
        <button className="portal-link" onClick={onAction}>
          {t(action)}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Skeleton() {
  const { t } = useLocale();
  return (
    <div
      className="portal-skeleton"
      role="status"
      aria-label={t("Loading your workspace…")}
    >
      <div />
      <div />
      <div />
      <div />
      <section />
    </div>
  );
}
export function announceSaved(form?: HTMLFormElement) {
  window.dispatchEvent(new CustomEvent("kafou:saved", { detail: form }));
}
