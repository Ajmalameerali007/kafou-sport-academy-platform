"use client";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import { dubaiDay } from "@/lib/platform/portal-model";
import type { DailyPage } from "@/lib/platform/daily-operations";
import { usePortalQuery } from "./use-portal-query";
import { AttendanceWorkspace } from "./attendance-workspace";
import { PortalDrawer, StatusBadge } from "./portal-ui";
import type { Navigate } from "./portal-shell";

type RehearsalOption = { id: string; name: string; branch_id: string };

export function StudentCheckIn({
  branch,
  navigate,
}: {
  branch: string;
  navigate: Navigate;
}) {
  const { t, locale } = useLocale();
  const [day, setDay] = useState(dubaiDay(new Date()));
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [session, setSession] = useState("");
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [rehearsalOptions, setRehearsalOptions] = useState<RehearsalOption[]>(
    [],
  );
  const [rehearsalClass, setRehearsalClass] = useState("");
  const [rehearsalBusy, setRehearsalBusy] = useState(false);
  const [rehearsalMessage, setRehearsalMessage] = useState("");
  const q = usePortalQuery<DailyPage>(
    `daily?view=today&from=${day}&to=${day}&q=${encodeURIComponent(search)}&offset=${offset}${branch ? `&branch=${branch}` : ""}`,
    !!day,
  );
  async function openRehearsal() {
    setRehearsalOpen(true);
    setRehearsalMessage("");
    const result = await api<RehearsalOption[]>("checkin-rehearsal");
    if (result.ok) {
      const options = branch
        ? result.data.filter((option) => option.branch_id === branch)
        : result.data;
      setRehearsalOptions(options);
      setRehearsalClass(options[0]?.id || "");
    } else setRehearsalMessage(result.message);
  }
  async function createRehearsal() {
    if (!rehearsalClass) return;
    setRehearsalBusy(true);
    setRehearsalMessage("");
    const result = await api<{ id: string }>("checkin-rehearsal", {
      class_id: rehearsalClass,
    });
    if (result.ok) {
      setRehearsalMessage(t("Test session ready. Opening check-in."));
      setRehearsalOpen(false);
      setSession(result.data.id);
      q.refresh();
    } else setRehearsalMessage(result.message);
    setRehearsalBusy(false);
  }
  return (
    <section className="portal-panel daily-today">
      <header>
        <h2>{t("Student check-in")}</h2>
        <p>
          {t(
            "Choose the dated session, record arrivals, then review attendance.",
          )}
        </p>
      </header>
      <div className="daily-toolbar">
        <label>
          {t("Date")}
          <input
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          {t("Find class")}
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <button className="portal-btn" onClick={() => navigate("Attendance")}>
          {t("Attendance register")}
        </button>
        <button
          className="portal-btn"
          onClick={() => navigate("Staff attendance")}
        >
          {t("Staff attendance")}
        </button>
        <button className="portal-primary" onClick={() => void openRehearsal()}>
          {t("Create test check-in session")}
        </button>
      </div>
      <div className="checkin-rehearsal" hidden={!rehearsalOpen}>
        <div>
          <strong>{t("Immediate check-in rehearsal")}</strong>
          <p>
            {t(
              "Creates a real synthetic session and trial roster for this branch. It is available now even when no scheduled class exists.",
            )}
          </p>
        </div>
        <label>
          {t("Base class")}
          <select
            value={rehearsalClass}
            onChange={(event) => setRehearsalClass(event.target.value)}
            disabled={!rehearsalOptions.length || rehearsalBusy}
          >
            {!rehearsalOptions.length && (
              <option value="">{t("No rehearsal classes available")}</option>
            )}
            {rehearsalOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <div className="checkin-rehearsal-actions">
          <button
            className="portal-primary"
            disabled={!rehearsalClass || rehearsalBusy}
            onClick={() => void createRehearsal()}
          >
            {rehearsalBusy ? t("Creating…") : t("Create and open check-in")}
          </button>
          <button
            className="portal-btn"
            disabled={rehearsalBusy}
            onClick={() => setRehearsalOpen(false)}
          >
            {t("Close")}
          </button>
        </div>
      </div>
      {rehearsalMessage && <p role="status">{t(rehearsalMessage)}</p>}
      {q.error && <p role="alert">{t(q.error)}</p>}
      {!day ? (
        <p>{t("Choose a date.")}</p>
      ) : !q.data && !q.error ? (
        <p role="status">{t("Loading sessions…")}</p>
      ) : (
        q.data && (
          <>
            <div className="daily-session-list">
              {q.data.rows.map((row) => (
                <article key={row.id} className="daily-session">
                  <div>
                    <strong>{String(row.name)}</strong>
                    <p>
                      {String(row.branch_name)} · {t(String(row.sport))} ·{" "}
                      {String(row.venue_name)}
                    </p>
                    <time>
                      {new Date(String(row.starts_at)).toLocaleString(
                        locale === "ar" ? "ar-AE" : "en-GB",
                        {
                          timeZone: "Asia/Dubai",
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}
                    </time>
                  </div>
                  <div>
                    <StatusBadge
                      status={
                        row.finalized_at ? "finalized" : String(row.status)
                      }
                    />
                    <p>
                      {t("Expected")}: {Number(row.expected)}
                    </p>
                  </div>
                  <button
                    className="portal-primary"
                    disabled={!!q.error}
                    onClick={() => setSession(row.id)}
                  >
                    {t(
                      row.finalized_at || row.status === "cancelled"
                        ? "View arrivals"
                        : "Open check-in",
                    )}
                  </button>
                </article>
              ))}
              {!q.data.rows.length && (
                <p>{t("No sessions for this date. Choose another date.")}</p>
              )}
            </div>
            <div className="daily-pager">
              <span>
                {q.data.total
                  ? `${offset + 1}–${Math.min(offset + 50, q.data.total)} / ${q.data.total}`
                  : 0}
              </span>
              <button
                className="portal-btn"
                disabled={!offset}
                onClick={() => setOffset(offset - 50)}
              >
                {t("Previous")}
              </button>
              <button
                className="portal-btn"
                disabled={offset + 50 >= q.data.total}
                onClick={() => setOffset(offset + 50)}
              >
                {t("Next")}
              </button>
            </div>
          </>
        )
      )}
      <PortalDrawer
        open={!!session}
        onClose={() => setSession("")}
        title={t("Student check-in")}
      >
        {session && (
          <AttendanceWorkspace
            key={session}
            sessionId={session}
            initialPanel="check-in"
            onSaved={q.refresh}
          />
        )}
      </PortalDrawer>
    </section>
  );
}
