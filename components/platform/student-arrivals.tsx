"use client";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import { arrivalDecision } from "@/lib/platform/student-arrival";
import type { DailyPage } from "@/lib/platform/daily-operations";
import type { Register } from "./attendance-workspace";
import { usePortalQuery } from "./use-portal-query";

export function StudentArrivals({
  register,
  disabled = false,
  onSaved,
  onReview,
}: {
  register: Register;
  disabled?: boolean;
  onSaved: () => void;
  onReview: () => void;
}) {
  const { t, locale } = useLocale();
  const q = usePortalQuery<DailyPage>(`daily?view=session&id=${register.id}`);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [committed, setCommitted] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const lock = useRef(false);
  const arrivals = q.data?.arrivals || [];
  const syncing =
    !!committed &&
    (register.revision <= committed.revision ||
      !arrivals.some((a) => a.roster_id === committed.id));
  const editable =
    register.can_mark &&
    !register.finalized_at &&
    register.status === "scheduled" &&
    !disabled &&
    !q.error;
  async function checkIn(id: string) {
    if (lock.current || !editable || syncing) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    const data = { id, revision: register.revision };
    const fingerprint = JSON.stringify(data);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await api("daily", {
        action: "student.arrive",
        data,
        key: pending.current.key,
      });
      if (result.ok) {
        pending.current = null;
        setCommitted({ id, revision: register.revision });
        setNotice(t("Checked in — attendance remains a draft"));
        window.dispatchEvent(
          new CustomEvent("kafou:saved", { detail: { inlineFeedback: true } }),
        );
      } else setNotice(result.message);
      q.refresh();
      onSaved();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const rows = register.roster.filter((r) =>
    r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <section aria-label={t("Student check-in")} className="student-arrivals">
      <p>
        {t(
          "Record arrival when the student reaches the session. Review and finish attendance separately.",
        )}
      </p>
      <label className="attendance-search">
        {t("Find student")}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {notice && <p role="status">{notice}</p>}
      {(q.error || disabled) && (
        <p role="alert">
          {t(q.error || "Refresh the register before recording arrivals.")}
        </p>
      )}
      {!q.data ? (
        <p role="status">{t("Loading arrivals…")}</p>
      ) : (
        <div className="attendance-roster">
          {rows.map((row) => {
            const arrival = arrivals.find((a) => a.roster_id === row.id);
            const mark = register.finalized_at
              ? row.attendance || ""
              : register.marks[row.id] || "";
            const decision = arrivalDecision(
              mark,
              arrival ? { source: arrival.source } : null,
              editable,
            );
            return (
              <div className="attendance-row" key={row.id}>
                <div className="attendance-person">
                  <strong>{row.name}</strong>
                  <span>
                    {t(
                      row.kind === "enrollment"
                        ? "Regular"
                        : row.kind === "trial"
                          ? "Trial"
                          : "Make-up",
                    )}
                  </span>
                </div>
                <div className="attendance-arrival-status">
                  <strong>{t(decision.label)}</strong>
                  {arrival && (
                    <small>
                      {t(
                        arrival.source === "check_in"
                          ? "Arrival recorded"
                          : "Attendance recorded",
                      )}{" "}
                      ·{" "}
                      {new Date(String(arrival.recorded_at)).toLocaleString(
                        locale === "ar" ? "ar-AE" : "en-GB",
                        {
                          timeZone: "Asia/Dubai",
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      )}
                    </small>
                  )}
                  <small>
                    {t("Attendance")}: {t(mark || "Unmarked")}
                  </small>
                </div>
                {decision.canCheckIn ? (
                  <button
                    type="button"
                    className="portal-primary"
                    aria-label={`${t("Check in")} ${row.name}`}
                    disabled={busy || syncing}
                    onClick={() => void checkIn(row.id)}
                  >
                    {t("Check in")}
                  </button>
                ) : !arrival && editable ? (
                  <button
                    type="button"
                    className="portal-btn"
                    onClick={onReview}
                  >
                    {t("Review attendance decision")}
                  </button>
                ) : null}
              </div>
            );
          })}
          {!rows.length && (
            <p className="attendance-empty">
              {t(
                search
                  ? "No matching students."
                  : "No students on this roster.",
              )}
            </p>
          )}
        </div>
      )}
      {syncing && <p role="status">{t("Updating shared register…")}</p>}
      {register.finalized_at && (
        <p>{t("Attendance is finalized. Arrival history is read only.")}</p>
      )}
      {!register.can_mark && (
        <p>
          {t(
            "Read only. Ask the owner for attendance permission for this branch.",
          )}
        </p>
      )}
      <button
        type="button"
        className="portal-btn"
        disabled={busy || syncing}
        onClick={onReview}
      >
        {t("Review attendance")}
      </button>
      <p className="daily-attestation">
        {t(
          "An attendance confirmation is not a timed check-in. Staff clock-in and coach delivery are recorded separately.",
        )}
      </p>
    </section>
  );
}
