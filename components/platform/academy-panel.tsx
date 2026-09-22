"use client";
import { AttendanceWorkspace } from "./attendance-workspace";
import { administratorVerified } from "@/lib/platform/contracts";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import { dubaiDay } from "@/lib/platform/portal-model";
import { productCommand, type ProductRow } from "@/lib/platform/product";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductProps,
} from "./product-shared";
import { OperationalDirectory, SessionCalendar } from "./operational-directory";
import { StatusBadge, EmptyState, PortalDrawer } from "./portal-ui";
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type Option = { value: string; label: string };
type FormatTime = (value: unknown) => string;
const dubaiInput = (value: unknown) => {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() + 4 * 3600000).toISOString().slice(0, 16);
};
const dubaiIso = (value: FormDataEntryValue | null) =>
  new Date(`${String(value)}:00+04:00`).toISOString();

function AcademyAction({
  action,
  payload,
  children,
  onSaved,
  disabled = false,
}: {
  action: string;
  payload: ProductRow;
  children: React.ReactNode;
  onSaved: () => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  return (
    <div>
      <button
        type="button"
        className="button button-dark"
        disabled={busy || disabled}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          const result = await productCommand(action, payload, key.current);
          setBusy(false);
          if (result.ok) {
            key.current = crypto.randomUUID();
            onSaved();
          } else setError(result.message);
        }}
      >
        {busy ? t("Saving…") : children}
      </button>
      {error && <ProductNotice error>{t(error)}</ProductNotice>}
    </div>
  );
}
function ScheduleChange({
  session,
  count,
  head,
  time,
  refresh,
}: {
  session: ProductRow;
  count: number;
  head: boolean;
  time: FormatTime;
  refresh: () => void;
}) {
  const { t } = useLocale();
  const [scope, setScope] = useState("occurrence"),
    [mode, setMode] = useState(head ? "move" : "cancel"),
    [minutes, setMinutes] = useState(30),
    [reason, setReason] = useState("");
  const [preview, setPreview] = useState<ProductRow[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const invalidate = () => {
    setPreview(null);
    setError("");
    key.current = crypto.randomUUID();
  };
  return (
    <details className="product-panel">
      <summary>{t("Review a schedule change")}</summary>
      <form
        className="product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setPreview(null);
          if (head) {
            const result = await productCommand<{ sessions: ProductRow[] }>(
              "schedule.preview",
              { session_id: session.id, scope },
            );
            if (result.ok) setPreview(result.data.sessions);
            else setError(result.message);
          } else setPreview([{ ...session, bookings: count }]);
          setBusy(false);
        }}
      >
        <div className="ops-form-grid">
          <label>
            {t("Change type")}
            <select
              value={mode}
              disabled={!head || busy}
              onChange={(e) => {
                setMode(e.target.value);
                invalidate();
              }}
            >
              {head && <option value="move">{t("Move session time")}</option>}
              <option value="cancel">{t("Cancel sessions")}</option>
            </select>
          </label>
          <label>
            {t("Apply to")}
            <select
              value={scope}
              disabled={!head || busy}
              onChange={(e) => {
                setScope(e.target.value);
                invalidate();
              }}
            >
              <option value="occurrence">{t("This occurrence")}</option>
              {head && (
                <>
                  <option value="future">
                    {t("This and later occurrences")}
                  </option>
                  <option value="series">
                    {t("All remaining occurrences")}
                  </option>
                </>
              )}
            </select>
          </label>
          {mode === "move" && (
            <label>
              {t("Shift by minutes")}
              <input
                type="number"
                min={-180}
                max={180}
                step={1}
                required
                value={minutes}
                onChange={(e) => {
                  setMinutes(Number(e.target.value));
                  invalidate();
                }}
              />
              <small>
                {t(
                  "Use a negative number for earlier or a positive number for later, up to three hours.",
                )}
              </small>
            </label>
          )}
          <label>
            {t("Reason")}
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                invalidate();
              }}
            />
          </label>
        </div>
        <button
          className="button button-dark"
          disabled={busy || (mode === "move" && !minutes)}
        >
          {t(busy ? "Loading…" : "Review affected sessions")}
        </button>
      </form>
      {error && <ProductNotice error>{t(error)}</ProductNotice>}
      {preview && (
        <section aria-live="polite">
          <h4>
            {preview.length} {t("sessions affected")} ·{" "}
            {preview.reduce((n, row) => n + Number(row.bookings), 0)}{" "}
            {t("bookings affected")}
          </h4>
          <p>
            {t(
              "Completed history is retained. Capacity and conflicts are checked again when you confirm.",
            )}
          </p>
          {preview.map((row) => (
            <p key={val(row, "id")}>
              <time>{time(row.starts_at)}</time>
              {mode === "move" && (
                <>
                  {" "}
                  →{" "}
                  <time>
                    {time(
                      new Date(
                        Date.parse(val(row, "starts_at")) + minutes * 60000,
                      ).toISOString(),
                    )}
                  </time>
                </>
              )}{" "}
              · {val(row, "bookings")} {t("bookings")}
            </p>
          ))}
          {!preview.length && (
            <p>
              {t("There are no editable future occurrences in this scope.")}
            </p>
          )}
          <button
            className="button button-dark"
            disabled={busy || !preview.length}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              if (head) {
                const current = await productCommand<{
                  sessions: ProductRow[];
                }>("schedule.preview", { session_id: session.id, scope });
                if (!current.ok) {
                  setBusy(false);
                  setError(current.message);
                  return;
                }
                const snapshot = (items: ProductRow[]) =>
                  JSON.stringify(
                    items.map((item) => [
                      item.id,
                      item.starts_at,
                      item.ends_at,
                      item.bookings,
                    ]),
                  );
                if (snapshot(current.data.sessions) !== snapshot(preview)) {
                  setPreview(current.data.sessions);
                  setBusy(false);
                  setError(
                    "The schedule changed since preview. Review the updated occurrences before confirming.",
                  );
                  return;
                }
              }
              const action = head
                ? `schedule.${mode}`
                : "academy.session.cancel";
              const value: ProductRow = {
                session_id: session.id,
                reason,
                ...(head ? { scope } : {}),
                ...(mode === "move" ? { minutes_delta: minutes } : {}),
              };
              const result = await productCommand(action, value, key.current);
              setBusy(false);
              if (result.ok) {
                setPreview(null);
                key.current = crypto.randomUUID();
                refresh();
              } else setError(result.message);
            }}
          >
            {t(
              busy
                ? "Saving…"
                : mode === "move"
                  ? "Confirm time change"
                  : "Confirm cancellation",
            )}
          </button>
        </section>
      )}
    </details>
  );
}
function SubstituteForm({
  session,
  coaches,
  refresh,
}: {
  session: ProductRow;
  coaches: Option[];
  refresh: () => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID()),
    fingerprint = useRef("");
  return (
    <form
      className="product-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        const value = {
          session_id: session.id,
          coach_id: form.get("coach_id"),
          starts_at: dubaiIso(form.get("starts_at")),
          ends_at: dubaiIso(form.get("ends_at")),
          reason: form.get("reason"),
        };
        if (Date.parse(value.ends_at) <= Date.parse(value.starts_at)) {
          setError("Access end must be after access start.");
          return;
        }
        const next = JSON.stringify(value);
        if (fingerprint.current && fingerprint.current !== next)
          key.current = crypto.randomUUID();
        fingerprint.current = next;
        setBusy(true);
        setError("");
        const result = await productCommand(
          "academy.substitute",
          value,
          key.current,
        );
        setBusy(false);
        if (result.ok) {
          key.current = crypto.randomUUID();
          refresh();
        } else setError(result.message);
      }}
    >
      <h4>{t("Assign a substitute")}</h4>
      <p>
        {t(
          "The substitute can access this session only during the access window shown in UAE time.",
        )}
      </p>
      <div className="ops-form-grid">
        <label>
          {t("Substitute coach")}
          <select name="coach_id" required>
            <option value="">{t("Choose")}</option>
            {coaches.map((coach) => (
              <option value={coach.value} key={coach.value}>
                {coach.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Access starts (UAE time)")}
          <input
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={dubaiInput(session.starts_at)}
          />
        </label>
        <label>
          {t("Access ends (UAE time)")}
          <input
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={dubaiInput(
              new Date(
                Date.parse(val(session, "ends_at")) + 2 * 3600000,
              ).toISOString(),
            )}
          />
        </label>
        <label>
          {t("Reason")}
          <textarea name="reason" required minLength={5} maxLength={500} />
        </label>
      </div>
      {error && <ProductNotice error>{t(error)}</ProductNotice>}
      {!coaches.length && (
        <p>
          {t("No permitted substitute coaches are available for this branch.")}
        </p>
      )}
      <button className="button button-dark" disabled={busy || !coaches.length}>
        {t(busy ? "Saving…" : "Assign substitute")}
      </button>
    </form>
  );
}
export function AcademyPanel({
  account,
  data,
  refresh,
  section,
  focusRecord = "",
}: ProductProps & { focusRecord?: string }) {
  const { t, locale } = useLocale();
  const now = useNow();
  const [sessionDetail, setSessionDetail] = useState(focusRecord);
  const focusedRecord = useRef("");
  useEffect(() => {
    if (!focusRecord || focusedRecord.current === focusRecord) return;
    const item = document.querySelector<HTMLDetailsElement>(
      `[data-product-session="${CSS.escape(focusRecord)}"]`,
    );
    if (!item) return;
    focusedRecord.current = focusRecord;
    item.open = true;
    item.scrollIntoView({ block: "start", behavior: "instant" });
    item.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
  }, [focusRecord, data]);
  const [child, setChild] = useState(""),
    [day, setDay] = useState(""),
    [credit, setCredit] = useState("");
  const [slots, setSlots] = useState<ProductRow[]>([]),
    [slotStatus, setSlotStatus] = useState<
      "idle" | "loading" | "loaded" | "error"
    >("idle"),
    [slotError, setSlotError] = useState("");
  const [enrollment, setEnrollment] = useState(""),
    [transferEnrollment, setTransferEnrollment] = useState(""),
    [parentScheduleView, setParentScheduleView] = useState<
      "upcoming" | "history"
    >("upcoming");
  const requestId = useRef(0);
  const rows = (name: string) => data[name] || [];
  const find = (table: string, id: unknown) =>
    rows(table).find((row) => row.id === id);
  const label = (table: string, id: unknown, key = "name") =>
    val(find(table, id), key);
  const head = account.roles.some(
      (role) => role === "super_admin" || role === "admin",
    ),
    staff = head || account.roles.includes("branch"),
    coach = account.roles.includes("coach") && !staff,
    parent = account.roles.includes("parent") && !staff && !coach;
  const can = (permission: string, branch: unknown) =>
    (account.roles.includes("super_admin") && administratorVerified(account)) ||
    rows("product_permissions").some(
      (row) =>
        row.user_id === account.userId &&
        row.permission === permission &&
        (!row.branch_id || row.branch_id === branch),
    );
  const time: FormatTime = (value) => {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? t("Time unavailable")
      : date.toLocaleString(locale === "ar" ? "ar-AE" : "en-GB", {
          timeZone: "Asia/Dubai",
          dateStyle: "medium",
          timeStyle: "short",
        });
  };
  const children = rows("children"),
    selectedChild = children.some((row) => row.id === child) ? child : "",
    childIds = new Set(
      children
        .filter((row) => !selectedChild || row.id === selectedChild)
        .map((row) => row.id),
    );
  const ownEnrollments = rows("enrollments").filter((row) =>
    childIds.has(row.child_id),
  );
  const enrollmentChild = (id: unknown) => find("enrollments", id)?.child_id;
  const trial = (row: ProductRow) =>
    find(
      "trial_enquiries",
      find("trial_bookings", row.trial_booking_id)?.enquiry_id,
    );
  const person = (row: ProductRow) =>
    label("children", enrollmentChild(row.enrollment_id)) ||
    val(trial(row), "child_name") ||
    t("Trial participant");
  const participation = (row: ProductRow) => {
    if (row.enrollment_id)
      return childIds.has(enrollmentChild(row.enrollment_id));
    const enquiry = trial(row);
    return (
      !!enquiry &&
      (enquiry.child_id
        ? childIds.has(enquiry.child_id)
        : !selectedChild && enquiry.submitted_by === account.userId)
    );
  };
  const parentProjection = parent && "family_schedule" in data;
  const sourceSessions = rows(
    coach
      ? "development_sessions"
      : parentProjection
        ? "family_schedule"
        : "class_sessions",
  );
  const projectedStudents = (session: ProductRow) =>
    (Array.isArray(session.students)
      ? (session.students as ProductRow[])
      : []
    ).filter(
      (student) =>
        (!student.cancelled || session.status === "cancelled") &&
        (!parent ||
          (student.id
            ? childIds.has(student.id)
            : rows("session_roster").some(
                (row) => row.id === student.roster_id && participation(row),
              ))),
    );
  const sessions = sourceSessions
    .filter(
      (session) =>
        (!parent ||
          (parentProjection
            ? projectedStudents(session).some(
                (student) =>
                  !student.cancelled || session.status === "cancelled",
              )
            : rows("session_roster").some(
                (row) =>
                  row.session_id === session.id &&
                  participation(row) &&
                  (!row.cancelled || session.status === "cancelled"),
              ))) &&
        (!selectedChild ||
          parent ||
          rows("session_roster").some(
            (row) => row.session_id === session.id && participation(row),
          )) &&
        (!parent ||
          section.toLowerCase() !== "schedule" ||
          (parentScheduleView === "upcoming"
            ? session.status === "scheduled" &&
              Date.parse(val(session, "ends_at")) >= now
            : session.status !== "scheduled" ||
              Date.parse(val(session, "ends_at")) < now)) &&
        (!day || dubaiDay(val(session, "starts_at")) === day),
    )
    .sort((a, b) => val(a, "starts_at").localeCompare(val(b, "starts_at")));
  const sessionLabel = (id: unknown) => {
    const session =
      sourceSessions.find((row) => row.id === id) || find("class_sessions", id);
    return session
      ? `${label("academy_classes", session.class_id) || val(session, "name") || t("Session")} · ${time(session.starts_at)}`
      : t("Session details unavailable");
  };
  const enrollmentOptions = ownEnrollments
    .filter((row) => row.status === "active")
    .map((row) => ({
      value: val(row, "id"),
      label: `${label("children", row.child_id)} · ${label("academy_classes", row.class_id)}`,
    }));
  const selectedEnrollment = find("enrollments", enrollment),
    sourceClass = find("academy_classes", selectedEnrollment?.class_id);
  const waitingSessions = rows("class_sessions").filter((session) => {
    const cls = find("academy_classes", session.class_id);
    return (
      selectedEnrollment &&
      session.status === "scheduled" &&
      Date.parse(val(session, "starts_at")) > now &&
      cls?.branch_id === sourceClass?.branch_id &&
      cls?.sport === sourceClass?.sport &&
      cls?.level_id === sourceClass?.level_id &&
      !rows("session_roster").some(
        (row) =>
          row.session_id === session.id &&
          !row.cancelled &&
          enrollmentChild(row.enrollment_id) === selectedEnrollment.child_id,
      )
    );
  });
  const transferSource = find("enrollments", transferEnrollment);
  const transferTargets = rows("academy_classes").filter(
    (cls) =>
      transferSource &&
      cls.id !== transferSource.class_id &&
      cls.active &&
      rows("child_sports").some(
        (sport) =>
          sport.child_id === transferSource.child_id &&
          sport.sport === cls.sport &&
          sport.level_id === cls.level_id,
      ),
  );
  const scopedCredits = rows("makeup_credits").filter(
    (row) => (!parent && !selectedChild) || childIds.has(row.child_id),
  );
  const loadSlots = async (id: string) => {
    const request = ++requestId.current;
    setCredit(id);
    setSlots([]);
    setSlotError("");
    setSlotStatus("loading");
    const result = await api<ProductRow[]>(
      `makeups?credit=${encodeURIComponent(id)}`,
    );
    if (request !== requestId.current) return;
    if (result.ok) {
      setSlots(result.data);
      setSlotStatus("loaded");
    } else {
      setSlotError(result.message);
      setSlotStatus("error");
    }
  };
  return (
    <div className="product-stack">
      {(!staff || section === "Makeups") && (
        <div className="product-section-intro">
          <h2>
            {t(
              section.toLowerCase() === "makeups"
                ? "Attendance & makeups"
                : section.toLowerCase() === "attendance"
                  ? "Session workspace"
                  : "Your schedule",
            )}
          </h2>
          <p>
            {t(
              section.toLowerCase() === "makeups"
                ? "Replacement credits follow the recorded policy. Availability is checked again when you book."
                : "Times shown in UAE time. Booking type and attendance are separate.",
            )}
          </p>
        </div>
      )}
      <div className="ops-form-grid">
        {parent && section.toLowerCase() === "schedule" && (
          <div
            className="parent-schedule-view"
            role="tablist"
            aria-label={t("Schedule view")}
          >
            {(["upcoming", "history"] as const).map((view) => (
              <button
                type="button"
                role="tab"
                aria-selected={parentScheduleView === view}
                key={view}
                onClick={() => {
                  setParentScheduleView(view);
                  setDay("");
                }}
              >
                {t(view === "upcoming" ? "Upcoming" : "History")}
              </button>
            ))}
          </div>
        )}
        {children.length > 1 && (
          <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
            {t("Child")}
            <select
              aria-label={t("Child")}
              style={{ width: "100%", minWidth: 0 }}
              value={selectedChild}
              onChange={(e) => {
                setChild(e.target.value);
                setEnrollment("");
                setTransferEnrollment("");
                setCredit("");
                setSlots([]);
                setSlotStatus("idle");
                ++requestId.current;
              }}
            >
              <option value="">{t("All children")}</option>
              {children.map((row) => (
                <option key={val(row, "id")} value={val(row, "id")}>
                  {val(row, "name")}
                </option>
              ))}
            </select>
          </label>
        )}
        {section.toLowerCase() !== "makeups" &&
          !(staff && section === "Schedule") && (
            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              {t("Session date (UAE time)")}
              <input
                style={{ width: "100%", minWidth: 0 }}
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          )}
        {day && (
          <button
            type="button"
            className="portal-link"
            onClick={() => setDay("")}
          >
            {t("Clear date")}
          </button>
        )}
      </div>
      {section.toLowerCase() === "makeups" ? (
        <>
          {!scopedCredits.length && (
            <EmptyState
              title="No makeup credits"
              copy="Eligible finalized absences will appear here."
            />
          )}
          {scopedCredits.map((item) => (
            <article className="product-record" key={val(item, "id")}>
              <div>
                <h3>{label("children", item.child_id) || t("Child")}</h3>
                <p>
                  {t(val(item, "sport"))} · {label("branches", item.branch_id)}{" "}
                  · {label("sport_levels", item.level_id)}
                </p>
                <p>
                  {t("Expires")} {time(item.expires_at)}
                </p>
                <StatusBadge
                  status={
                    Date.parse(val(item, "expires_at")) <= now &&
                    item.status === "available"
                      ? "expired"
                      : val(item, "status")
                  }
                />
              </div>
              {item.status === "available" &&
                Date.parse(val(item, "expires_at")) > now && (
                  <button
                    className="button button-green"
                    disabled={slotStatus === "loading"}
                    onClick={() => loadSlots(val(item, "id"))}
                  >
                    {t("Find replacement")}
                  </button>
                )}
            </article>
          ))}
          {credit && scopedCredits.some((item) => item.id === credit) && (
            <section
              className="product-panel"
              aria-busy={slotStatus === "loading"}
            >
              <h3>
                {t("Eligible replacements")} ·{" "}
                {label("children", find("makeup_credits", credit)?.child_id)}
              </h3>
              {slotStatus === "loading" && (
                <p role="status">{t("Checking eligible sessions…")}</p>
              )}
              {slotStatus === "error" && (
                <>
                  <ProductNotice error>{t(slotError)}</ProductNotice>
                  <button
                    className="button button-dark"
                    onClick={() => loadSlots(credit)}
                  >
                    {t("Try again")}
                  </button>
                </>
              )}
              {slotStatus === "loaded" && !slots.length && (
                <p>
                  {t(
                    "No compatible available sessions. Contact reception for help.",
                  )}
                </p>
              )}
              {slotStatus === "loaded" &&
                slots.map((slot) => (
                  <article className="product-record" key={val(slot, "id")}>
                    <div>
                      <h4>{val(slot, "name")}</h4>
                      <p>
                        {time(slot.starts_at)} · {val(slot, "venue")}
                      </p>
                      <small>
                        {val(slot, "places")} {t("places available")}
                      </small>
                    </div>
                    <AcademyAction
                      action="academy.makeup.book"
                      payload={{ credit_id: credit, session_id: slot.id }}
                      onSaved={() => {
                        setCredit("");
                        setSlots([]);
                        setSlotStatus("idle");
                        refresh();
                      }}
                    >
                      {t("Book makeup")}
                    </AcademyAction>
                  </article>
                ))}
            </section>
          )}
          {rows("makeup_bookings")
            .filter((booking) =>
              scopedCredits.some((item) => item.id === booking.credit_id),
            )
            .map((booking) => {
              const item = find("makeup_credits", booking.credit_id),
                session = find("class_sessions", booking.session_id);
              return (
                <article className="product-record" key={val(booking, "id")}>
                  <div>
                    <h3>{label("children", item?.child_id)}</h3>
                    <p>{sessionLabel(booking.session_id)}</p>
                    <small>{val(booking, "reference")}</small>
                    <StatusBadge status={val(booking, "status")} />
                  </div>
                  {booking.status === "reserved" &&
                    session &&
                    Date.parse(val(session, "starts_at")) > now && (
                      <AcademyAction
                        action="academy.makeup.cancel"
                        payload={{ id: booking.id }}
                        onSaved={refresh}
                      >
                        {t("Cancel replacement")}
                      </AcademyAction>
                    )}
                </article>
              );
            })}
          {head && (
            <details className="product-panel">
              <summary>{t("Makeup policy versions")}</summary>
              <p>
                {t(
                  "New credits use the new policy. Existing credit expiry and history are retained.",
                )}
              </p>
              <ProductForm
                title="Add policy version"
                action="academy.policy"
                fields={[
                  {
                    name: "branch_id",
                    label: "Branch",
                    options: rows("branches").map((row) => ({
                      value: val(row, "id"),
                      label: val(row, "name"),
                    })),
                    required: true,
                  },
                  {
                    name: "name",
                    label: "Synthetic policy name",
                    required: true,
                  },
                  {
                    name: "makeup_days",
                    label: "Days to use credit",
                    type: "number",
                    min: 1,
                    max: 365,
                    required: true,
                  },
                  {
                    name: "allow_absent",
                    label: "Unexcused absence eligible",
                    options: [
                      { value: "false", label: "No" },
                      { value: "true", label: "Yes" },
                    ],
                    required: true,
                  },
                ]}
                onSaved={refresh}
              />
            </details>
          )}
        </>
      ) : (
        <>
          {!sessions.length && (
            <EmptyState
              title="No sessions in this view."
              copy="Choose another date or contact reception."
            />
          )}
          {(staff || coach) &&
            (section === "Schedule" ? (
              <SessionCalendar
                sessions={sessions}
                name={(s) =>
                  label("academy_classes", s.class_id) || val(s, "name")
                }
                detail={(s) => {
                  const c = find("academy_classes", s.class_id);
                  return [
                    label("coach_directory", s.coach_id || c?.coach_id),
                    label("venues", s.venue_id || c?.venue_id),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                }}
                onOpen={setSessionDetail}
              />
            ) : (
              <OperationalDirectory
                title="Session register"
                rows={sessions}
                searchText={(s) =>
                  [
                    label("academy_classes", s.class_id) || val(s, "name"),
                    label(
                      "coach_directory",
                      s.coach_id ||
                        find("academy_classes", s.class_id)?.coach_id,
                    ),
                    val(s, "status"),
                  ].join(" ")
                }
                columns={[
                  {
                    label: "Session",
                    render: (s) => (
                      <strong>
                        {label("academy_classes", s.class_id) || val(s, "name")}
                      </strong>
                    ),
                  },
                  { label: "Date / Time", render: (s) => time(s.starts_at) },
                  {
                    label: "Coach",
                    render: (s) =>
                      label(
                        "coach_directory",
                        s.coach_id ||
                          find("academy_classes", s.class_id)?.coach_id,
                      ) ||
                      val(s, "coach_name") ||
                      t("Assigned coach"),
                  },
                  {
                    label: "Roster",
                    render: (s) =>
                      coach
                        ? projectedStudents(s).length
                        : rows("session_roster").filter(
                            (r) => r.session_id === s.id && !r.cancelled,
                          ).length,
                  },
                  {
                    label: "Status",
                    render: (s) => (
                      <StatusBadge
                        status={s.finalized_at ? "finalized" : val(s, "status")}
                      />
                    ),
                  },
                ]}
                onOpen={setSessionDetail}
                action={(row) =>
                  row.finalized_at || row.status === "cancelled"
                    ? "View attendance"
                    : "Take attendance"
                }
              />
            ))}
          {sessions
            .filter((s) => !(staff || coach) || s.id === sessionDetail)
            .map((session) => {
              const cls = find("academy_classes", session.class_id),
                branchId = cls?.branch_id || session.branch_id;
              const roster = rows("session_roster").filter(
                (row) =>
                  row.session_id === session.id &&
                  !row.cancelled &&
                  (!parent || participation(row)),
              );
              const canCorrect =
                staff &&
                can("attendance.correct", branchId) &&
                !!session.finalized_at &&
                session.status !== "cancelled";
              const coachRows = rows("coach_directory")
                .filter(
                  (row) =>
                    Array.isArray(row.branch_ids) &&
                    row.branch_ids.includes(branchId),
                )
                .map((row) => ({
                  value: val(row, "id"),
                  label: val(row, "name"),
                }));
              const students = projectedStudents(session);
              return (
                <SessionDetailFrame
                  staff={staff || coach}
                  id={val(session, "id")}
                  key={val(session, "id")}
                  onClose={() => setSessionDetail("")}
                  title={
                    staff || coach
                      ? t("Attendance register")
                      : val(cls, "name") || val(session, "name") || t("Session")
                  }
                >
                  {!staff && !coach && (
                    <summary>
                      <span>
                        <strong>
                          {val(cls, "name") ||
                            val(session, "name") ||
                            t("Session")}
                        </strong>
                        <small>
                          {time(session.starts_at)} ·{" "}
                          {label("venues", cls?.venue_id) ||
                            val(session, "venue_name")}
                        </small>
                      </span>
                      <StatusBadge status={val(session, "status")} />
                    </summary>
                  )}
                  <div className="product-session-body">
                    <p>
                      {t("Coach")}:{" "}
                      {label(
                        "coach_directory",
                        cls?.coach_id || session.coach_id,
                      ) ||
                        val(session, "coach_name") ||
                        t("Assigned coach")}
                      {staff && (
                        <>
                          {" "}
                          · {roster.length}/{val(session, "capacity")}{" "}
                          {t("places")}
                        </>
                      )}
                    </p>
                    {staff || coach ? (
                      <AttendanceWorkspace
                        key={val(session, "id")}
                        sessionId={val(session, "id")}
                        manageReferences={staff}
                        onSaved={refresh}
                      />
                    ) : (
                      <>
                        {(!parentProjection ? roster : []).map((row) => (
                          <div className="product-record" key={val(row, "id")}>
                            <div>
                              <strong>{person(row)}</strong>
                              <small>{t(val(row, "kind"))}</small>
                              <StatusBadge
                                status={val(row, "attendance") || "unmarked"}
                              />
                            </div>
                            {canCorrect && row.kind !== "trial" && (
                              <details>
                                <summary>{t("Correct attendance")}</summary>
                                <ProductForm
                                  title="Record an attendance correction"
                                  action="academy.attendance.correct"
                                  initial={{
                                    roster_id: row.id,
                                    attendance: row.attendance,
                                  }}
                                  fields={[
                                    {
                                      name: "attendance",
                                      label: "Correct attendance",
                                      options: [
                                        "present",
                                        "absent",
                                        "late",
                                        "excused",
                                      ].map((value) => ({
                                        value,
                                        label: value,
                                      })),
                                      required: true,
                                    },
                                    {
                                      name: "reason",
                                      label: "Correction reason",
                                      type: "textarea",
                                      required: true,
                                    },
                                  ]}
                                  onSaved={refresh}
                                />
                              </details>
                            )}
                          </div>
                        ))}
                        {(coach || parentProjection) &&
                          students.map((student, index) => (
                            <div
                              className="product-record"
                              key={
                                val(student, "roster_id") ||
                                val(student, "id") ||
                                index
                              }
                            >
                              <span>
                                <strong>
                                  {val(student, "name") || t("Student")}
                                </strong>
                                {Boolean(student.kind) && (
                                  <small>{t(val(student, "kind"))}</small>
                                )}
                              </span>
                              {Boolean(student.attendance) && (
                                <StatusBadge
                                  status={val(student, "attendance")}
                                />
                              )}
                            </div>
                          ))}
                        {!roster.length && !students.length && (
                          <p>{t("No students on this roster.")}</p>
                        )}
                      </>
                    )}
                    {canCorrect && (
                      <details className="product-panel">
                        <summary>{t("Correct attendance")}</summary>
                        {roster
                          .filter((r) => r.kind !== "trial")
                          .map((row) => (
                            <ProductForm
                              key={val(row, "id")}
                              title={person(row)}
                              action="academy.attendance.correct"
                              initial={{
                                roster_id: row.id,
                                attendance: row.attendance,
                              }}
                              fields={[
                                {
                                  name: "attendance",
                                  label: "Correct attendance",
                                  options: [
                                    "present",
                                    "late",
                                    "absent",
                                    "excused",
                                  ].map((value) => ({ value, label: value })),
                                  required: true,
                                },
                                {
                                  name: "reason",
                                  label: "Correction reason",
                                  type: "textarea",
                                  required: true,
                                },
                              ]}
                              onSaved={refresh}
                            />
                          ))}
                      </details>
                    )}
                    {Boolean(session.finalized_at) && (
                      <p>
                        {t("Attendance finalized. Normal editing is locked.")}
                      </p>
                    )}
                    {Boolean(session.delivered_at) && (
                      <p>
                        {t("Delivery confirmed")} · {time(session.delivered_at)}
                      </p>
                    )}
                    {staff &&
                      session.status === "scheduled" &&
                      !session.finalized_at &&
                      !session.delivered_at &&
                      Date.parse(val(session, "starts_at")) > now && (
                        <ScheduleChange
                          session={session}
                          count={roster.length}
                          head={head}
                          time={time}
                          refresh={refresh}
                        />
                      )}
                    {head &&
                      session.status !== "cancelled" &&
                      !session.delivered_at && (
                        <details className="product-panel">
                          <summary>{t("Substitute access")}</summary>
                          <SubstituteForm
                            session={session}
                            coaches={coachRows}
                            refresh={refresh}
                          />
                          {rows("coach_substitutions")
                            .filter((row) => row.session_id === session.id)
                            .map((row) => (
                              <div
                                className="product-record"
                                key={val(row, "id")}
                              >
                                <span>
                                  {label("coach_directory", row.coach_id) ||
                                    t("Assigned coach")}
                                  <small>
                                    {time(row.starts_at)} → {time(row.ends_at)}
                                  </small>
                                </span>
                                {row.revoked_at ? (
                                  <StatusBadge status="revoked" />
                                ) : (
                                  <AcademyAction
                                    action="academy.substitute.revoke"
                                    payload={{ id: row.id }}
                                    onSaved={refresh}
                                  >
                                    {t("Revoke substitute access")}
                                  </AcademyAction>
                                )}
                              </div>
                            ))}
                        </details>
                      )}
                    {rows("session_changes")
                      .filter((row) => row.session_id === session.id)
                      .map((change) => (
                        <div className="product-record" key={val(change, "id")}>
                          <div>
                            <strong>{t("Schedule change")}</strong>
                            <p>{val(change, "reason")}</p>
                            {Boolean(change.created_at) && (
                              <small>{time(change.created_at)}</small>
                            )}
                          </div>
                          {coach &&
                            (rows("operational_acknowledgements").some(
                              (row) =>
                                row.change_id === change.id &&
                                row.user_id === account.userId,
                            ) ? (
                              <StatusBadge status="acknowledged" />
                            ) : (
                              <AcademyAction
                                action="schedule.acknowledge"
                                payload={{ id: change.id }}
                                onSaved={refresh}
                              >
                                {t("Acknowledge change")}
                              </AcademyAction>
                            ))}
                        </div>
                      ))}
                  </div>
                </SessionDetailFrame>
              );
            })}
          {!coach && (
            <>
              <details
                className="product-panel"
                open={parent ? true : undefined}
              >
                <summary>{t("Waiting for a place")}</summary>
                <p>
                  {t(
                    "A waitlist entry is not a booking. Reception offers a place when capacity is available; accept before the offer expires.",
                  )}
                </p>
                {rows("waitlist_entries")
                  .filter(
                    (row) =>
                      (!parent && !selectedChild) || childIds.has(row.child_id),
                  )
                  .map((entry) => {
                    const expired =
                      entry.status === "offered" &&
                      Date.parse(val(entry, "offered_until")) <= now;
                    return (
                      <article
                        className="product-record"
                        key={val(entry, "id")}
                      >
                        <div>
                          <strong>{label("children", entry.child_id)}</strong>
                          <p>{sessionLabel(entry.session_id)}</p>
                          <StatusBadge
                            status={expired ? "expired" : val(entry, "status")}
                          />
                          {Boolean(entry.offered_until) && (
                            <small>
                              {t("Accept before")} {time(entry.offered_until)}
                            </small>
                          )}
                        </div>
                        {entry.status === "offered" && !expired && (
                          <AcademyAction
                            action="academy.waitlist.accept"
                            payload={{ id: entry.id }}
                            onSaved={refresh}
                          >
                            {t("Accept place")}
                          </AcademyAction>
                        )}
                        {staff && entry.status === "waiting" && (
                          <AcademyAction
                            action="academy.waitlist.offer"
                            payload={{ session_id: entry.session_id }}
                            onSaved={refresh}
                          >
                            {t("Offer next eligible place")}
                          </AcademyAction>
                        )}
                      </article>
                    );
                  })}
                {enrollmentOptions.length > 0 && (
                  <details>
                    <summary>{t("Join a session waitlist")}</summary>
                    <label>
                      {t("Child and enrollment")}
                      <select
                        value={enrollment}
                        onChange={(e) => setEnrollment(e.target.value)}
                      >
                        <option value="">{t("Choose")}</option>
                        {enrollmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {enrollment &&
                      (waitingSessions.length ? (
                        <ProductForm
                          key={enrollment}
                          title="Request a place"
                          action="academy.waitlist.join"
                          initial={{ enrollment_id: enrollment }}
                          fields={[
                            {
                              name: "session_id",
                              label: "Session",
                              options: waitingSessions.map((row) => ({
                                value: val(row, "id"),
                                label: sessionLabel(row.id),
                              })),
                              required: true,
                            },
                          ]}
                          onSaved={refresh}
                          submitLabel="Join waitlist"
                        />
                      ) : (
                        <p>
                          {t(
                            "No alternative sessions are visible for this enrollment. Reception can review other compatible options.",
                          )}
                        </p>
                      ))}
                  </details>
                )}
              </details>
              <details
                className="product-panel"
                open={parent ? true : undefined}
              >
                <summary>{t("Class transfers")}</summary>
                <p>
                  {t(
                    "Request a compatible class. Approval checks membership, level, age, capacity and timetable conflicts. Resolve any reserved makeup first.",
                  )}
                </p>
                {rows("transfer_requests")
                  .filter(
                    (row) =>
                      (!parent && !selectedChild) ||
                      childIds.has(enrollmentChild(row.enrollment_id)),
                  )
                  .map((request) => {
                    const source = find(
                        "academy_classes",
                        find("enrollments", request.enrollment_id)?.class_id,
                      ),
                      target = find("academy_classes", request.target_class_id),
                      review =
                        staff &&
                        can("operations.transfer", source?.branch_id) &&
                        can("operations.transfer", target?.branch_id);
                    return (
                      <article
                        className="product-record"
                        key={val(request, "id")}
                      >
                        <div>
                          <strong>
                            {label(
                              "children",
                              enrollmentChild(request.enrollment_id),
                            )}
                          </strong>
                          <p>
                            {val(source, "name") || t("Current class")} →{" "}
                            {val(target, "name") || t("Requested class")}
                          </p>
                          <p>{val(request, "reason")}</p>
                          <StatusBadge status={val(request, "status")} />
                          {Boolean(request.resolution) && (
                            <p>{val(request, "resolution")}</p>
                          )}
                        </div>
                        {review && request.status === "requested" && (
                          <ProductForm
                            title="Review transfer"
                            action="schedule.transfer.review"
                            initial={{ id: request.id }}
                            fields={[
                              {
                                name: "decision",
                                label: "Decision",
                                required: true,
                                options: [
                                  { value: "approved", label: "Approve" },
                                  { value: "declined", label: "Decline" },
                                ],
                              },
                              {
                                name: "reason",
                                label: "Review reason",
                                required: true,
                                type: "textarea",
                              },
                            ]}
                            onSaved={refresh}
                          />
                        )}
                      </article>
                    );
                  })}
                {enrollmentOptions.length > 0 && (
                  <details>
                    <summary>{t("Request a class transfer")}</summary>
                    <label>
                      {t("Child and enrollment")}
                      <select
                        value={transferEnrollment}
                        onChange={(e) => setTransferEnrollment(e.target.value)}
                      >
                        <option value="">{t("Choose")}</option>
                        {enrollmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {transferEnrollment &&
                      (transferTargets.length ? (
                        <ProductForm
                          key={transferEnrollment}
                          title="Transfer request"
                          action="academy.transfer.request"
                          initial={{ enrollment_id: transferEnrollment }}
                          fields={[
                            {
                              name: "target_class_id",
                              label: "Requested class",
                              required: true,
                              options: transferTargets.map((row) => ({
                                value: val(row, "id"),
                                label: `${val(row, "name")} · ${label("branches", row.branch_id)} · ${t(val(row, "sport"))}`,
                              })),
                            },
                            {
                              name: "reason",
                              label: "Reason",
                              required: true,
                              type: "textarea",
                            },
                          ]}
                          onSaved={refresh}
                          submitLabel="Request transfer"
                        />
                      ) : (
                        <p>
                          {t(
                            "No compatible alternative classes are visible. Reception can review the available classes and membership requirements.",
                          )}
                        </p>
                      ))}
                  </details>
                )}
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SessionDetailFrame({
  staff,
  id,
  title,
  onClose,
  children,
}: {
  staff: boolean;
  id: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return staff ? (
    <PortalDrawer open onClose={onClose} title={title}>
      <div className="product-session" data-product-session={id}>
        {children}
      </div>
    </PortalDrawer>
  ) : (
    <details className="product-session" data-product-session={id}>
      {children}
    </details>
  );
}
