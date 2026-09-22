"use client";
import { useState, type ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/kafou/locale";
import { dubaiDay } from "@/lib/platform/portal-model";
import { usePortalQuery } from "./use-portal-query";
import { StatusBadge } from "./portal-ui";
type Row = Record<string, unknown>;
export function OperationalDirectory({
  title,
  rows,
  columns,
  searchText,
  onOpen,
  action = "Open details",
}: {
  title: string;
  rows: Row[];
  columns: { label: string; render: (row: Row) => ReactNode }[];
  searchText: (row: Row) => string;
  onOpen?: (id: string) => void;
  action?: string | ((row: Row) => string);
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const remoteKind: Record<string, string> = {
    "Customer directory": "family",
    "Class catalogue": "class",
    "Trial admissions": "trial",
    "Session register": "session",
  };
  const kind = remoteKind[title];
  const branch =
    typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("branch") || ""
      : "";
  const [cursor, setCursor] = useState("");
  const remote = usePortalQuery<{
    items: {
      id: string;
      title: string;
      detail: string;
      record: string;
      section: string;
    }[];
    total: number;
    next_cursor: string | null;
  }>(
    `search?q=${encodeURIComponent(query.trim())}&kinds=${kind}&limit=20${branch ? "&branch=" + branch : ""}${cursor ? "&after=" + encodeURIComponent(cursor) : ""}`,
    !!kind && query.trim().length >= 2,
  );
  const filtered = rows.filter((row) =>
    searchText(row)
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const index = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 10) - 1),
  );
  return (
    <section className="work-directory" aria-label={t(title)}>
      <div className="work-directory-toolbar">
        <div>
          <h2>{t(title)}</h2>
          <span>
            {t(
              kind
                ? "Search all authorized records (at least two characters)"
                : "Search the records loaded in this workspace",
            )}
          </span>
        </div>
        <label className="work-search">
          <Search size={17} />
          <span className="sr-only">
            {t("Search")} · {t(title)}
          </span>
          <input
            type="search"
            placeholder={t("Search by name or details")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
              setCursor("");
            }}
          />
        </label>
      </div>
      {kind && query.trim().length >= 2 ? (
        <div className="work-remote-results">
          {remote.error ? (
            <p role="alert">
              {t(remote.error)}{" "}
              <button onClick={remote.refresh}>{t("Retry")}</button>
            </p>
          ) : !remote.data ? (
            <p role="status">{t("Searching…")}</p>
          ) : (
            <>
              <p>
                {remote.data.total} {t("matching records")}
              </p>
              {remote.data.items.length === 0 && (
                <p>{t("No matching records")}</p>
              )}
              {remote.data.items.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <button
                    className="portal-link"
                    onClick={() => {
                      const u = new URL(window.location.href);
                      u.searchParams.set("record", item.record);
                      u.searchParams.set("recordKind", kind);
                      u.searchParams.set(
                        "view",
                        title === "Session register"
                          ? "Attendance"
                          : item.section,
                      );
                      window.location.assign(u.href);
                    }}
                  >
                    {t(typeof action === "function" ? "Open details" : action)}
                  </button>
                </article>
              ))}
              <div className="family-pagination">
                {cursor && (
                  <button onClick={() => setCursor("")}>
                    {t("First page")}
                  </button>
                )}
                {remote.data.next_cursor && (
                  <button onClick={() => setCursor(remote.data!.next_cursor!)}>
                    {t("Next")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="work-table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.label} scope="col">
                      {t(c.label)}
                    </th>
                  ))}
                  {onOpen && (
                    <th scope="col">
                      <span className="sr-only">{t("Actions")}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(index * 10, index * 10 + 10).map((row) => (
                  <tr key={String(row.id)}>
                    {columns.map((c) => (
                      <td key={c.label} data-label={t(c.label)}>
                        {c.render(row)}
                      </td>
                    ))}
                    {onOpen && (
                      <td>
                        <button
                          className="work-open"
                          onClick={() => onOpen(String(row.id))}
                        >
                          {t(
                            typeof action === "function" ? action(row) : action,
                          )}
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="work-empty">
              <strong>{t("No matching records")}</strong>
              <p>{t("Try another search or load more records.")}</p>
            </div>
          )}
          <footer className="work-directory-footer">
            <span>
              {filtered.length ? index * 10 + 1 : 0}–
              {Math.min(index * 10 + 10, filtered.length)} / {filtered.length}{" "}
              {t("loaded records")}
            </span>
            <div>
              <button
                aria-label={t("Previous page")}
                disabled={!index}
                onClick={() => setPage(index - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label={t("Next page")}
                disabled={(index + 1) * 10 >= filtered.length}
                onClick={() => setPage(index + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
export function SessionCalendar({
  sessions,
  name,
  detail,
  onOpen,
}: {
  sessions: Row[];
  name: (row: Row) => string;
  detail: (row: Row) => string;
  onOpen: (id: string) => void;
}) {
  const { t, locale } = useLocale();
  const [date, setDate] = useState(dubaiDay(new Date()));
  const [mode, setMode] = useState("week");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const branch =
    typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("branch") || ""
      : "";
  const base = new Date(`${date}T12:00:00+04:00`);
  const monday = new Date(base);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const days = Array.from({ length: mode === "week" ? 7 : 1 }, (_, i) => {
    const d = new Date(mode === "week" ? monday : base);
    d.setUTCDate(d.getUTCDate() + i);
    return dubaiDay(d);
  });
  const read = usePortalQuery<{ items: Row[]; total: number }>(
    `portal/calendar?from=${days[0]}&to=${days[days.length - 1]}&q=${encodeURIComponent(query)}&offset=${offset}${branch ? "&branch=" + branch : ""}`,
  );
  const visibleSessions = read.data?.items || [];
  const open = (id: string) => {
    if (sessions.some((s) => s.id === id)) onOpen(id);
    else {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "Attendance");
      url.searchParams.set("recordKind", "session");
      url.searchParams.set("record", id);
      window.location.assign(url.href);
    }
  };
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00+04:00`).toLocaleDateString(
      locale === "ar" ? "ar-AE" : "en-GB",
      { timeZone: "Asia/Dubai", ...options },
    );
  const shift = (n: number) => {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + n * (mode === "week" ? 7 : 1));
    setOffset(0);
    setDate(dubaiDay(next));
  };
  return (
    <section className="work-calendar" aria-label={t("Session calendar")}>
      <div className="work-calendar-toolbar">
        <div>
          <h2>{t("Session calendar")}</h2>
          <span>
            {format(days[0], { day: "numeric", month: "short" })} —{" "}
            {format(days[days.length - 1], {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {t("UAE time")}
          </span>
        </div>
        <div className="work-calendar-controls">
          <button aria-label={t("Previous period")} onClick={() => shift(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              setOffset(0);
              setDate(dubaiDay(new Date()));
            }}
          >
            {t("Today")}
          </button>
          <button aria-label={t("Next period")} onClick={() => shift(1)}>
            <ChevronRight size={16} />
          </button>
          <input
            aria-label={t("Calendar date")}
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setOffset(0);
                setDate(e.target.value);
              }
            }}
          />
          <select
            aria-label={t("Calendar view")}
            value={mode}
            onChange={(e) => {
              setOffset(0);
              setMode(e.target.value);
            }}
          >
            <option value="week">{t("Week")}</option>
            <option value="day">{t("Day")}</option>
          </select>
        </div>
      </div>
      <label className="work-search work-calendar-search">
        <Search size={17} />
        <span className="sr-only">{t("Search sessions")}</span>
        <input
          type="search"
          placeholder={t("Search class, coach or venue")}
          value={query}
          onChange={(e) => {
            setOffset(0);
            setQuery(e.target.value);
          }}
        />
      </label>
      {read.error ? (
        <p role="alert">
          {t(read.error)} <button onClick={read.refresh}>{t("Retry")}</button>
        </p>
      ) : !read.data ? (
        <p role="status">{t("Loading sessions…")}</p>
      ) : null}
      <div className={`work-calendar-grid work-calendar-mode-${mode}`}>
        {days.map((day) => {
          const entries = visibleSessions
            .filter(
              (s) =>
                dubaiDay(String(s.starts_at)) === day &&
                `${s.class_name} ${s.venue_name} ${s.coach_name}`
                  .toLocaleLowerCase()
                  .includes(query.toLocaleLowerCase()),
            )
            .sort((a, b) =>
              String(a.starts_at).localeCompare(String(b.starts_at)),
            );
          return (
            <div
              className={`work-calendar-day${day === dubaiDay(new Date()) ? " is-today" : ""}`}
              key={day}
            >
              <header>
                <span>{format(day, { weekday: "short" })}</span>
                <strong>{format(day, { day: "numeric" })}</strong>
              </header>
              <div>
                {entries.length ? (
                  entries.map((s) => (
                    <button
                      key={String(s.id)}
                      className="work-calendar-event"
                      data-session-id={String(s.id)}
                      onClick={() => open(String(s.id))}
                    >
                      <time>
                        {new Date(String(s.starts_at)).toLocaleTimeString(
                          locale === "ar" ? "ar-AE" : "en-GB",
                          {
                            timeZone: "Asia/Dubai",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </time>
                      <strong>{String(s.class_name || name(s))}</strong>
                      <span>
                        {[s.venue_name, s.coach_name]
                          .filter(Boolean)
                          .join(" · ") || detail(s)}
                      </span>
                      <StatusBadge status={String(s.status)} />
                    </button>
                  ))
                ) : (
                  <p className="work-calendar-empty">
                    {t("No sessions in this period")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {read.data && read.data.total > 100 && (
        <nav className="family-pagination" aria-label={t("Calendar pages")}>
          <button
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            {t("Previous")}
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 100, read.data.total)} /{" "}
            {read.data.total}
          </span>
          <button
            disabled={offset + 100 >= read.data.total}
            onClick={() => setOffset(offset + 100)}
          >
            {t("Next")}
          </button>
        </nav>
      )}
    </section>
  );
}
