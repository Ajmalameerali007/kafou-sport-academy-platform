"use client";
import { SessionDelivery } from "./daily-workspace";
import { StudentArrivals } from "./student-arrivals";
import { AttendancePhotos, AttendanceReference } from "./attendance-photos";
import { PortalDrawer } from "./portal-ui";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import { usePortalQuery } from "./use-portal-query";
import { Avatar, StatusBadge } from "./portal-ui";
export type AttendanceMark = "" | "present" | "late" | "absent" | "excused";
export type Register = {
  id: string;
  name: string;
  branch: string;
  branch_id: string;
  sport: string;
  level: string;
  venue: string;
  coach: string;
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
  status: string;
  revision: number;
  roster_token: string;
  can_mark: boolean;
  can_photo: boolean;
  photo_review_required?: string[];
  marks: Record<string, AttendanceMark>;
  roster: {
    id: string;
    child_id: string | null;
    name: string;
    kind: string;
    attendance: AttendanceMark | null;
  }[];
};
export function AttendanceWorkspace({
  sessionId,
  onSaved,
  manageReferences = false,
  initialPanel = "attendance",
}: {
  sessionId: string;
  onSaved: () => void;
  manageReferences?: boolean;
  initialPanel?: "attendance" | "check-in";
}) {
  const { t, locale } = useLocale();
  const [panel, setPanel] = useState<"attendance" | "check-in" | "delivery">(
    initialPanel,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const query = usePortalQuery<Register>(
    `attendance/register?session=${sessionId}`,
  );
  const photoScope = usePortalQuery<
    { roster: string; status: string; reference: string | null }[]
  >(
    `attendance/photo-scope?session=${sessionId}`,
    query.data?.can_photo === true,
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [savedRevision, setSavedRevision] = useState(0);
  const [draft, setDraft] = useState<{
    revision: number;
    token: string;
    marks: Record<string, AttendanceMark>;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const lock = useRef(false);
  const [referenceChild, setReferenceChild] = useState("");
  const data = query.data;
  if (!data)
    return (
      <p role={query.error ? "alert" : "status"}>
        {t(query.error || "Loading attendance…")}
      </p>
    );
  const finalized = !!data.finalized_at;
  const synchronizing = savedRevision > data.revision;
  const inputBusy = busy || photoBusy || synchronizing;
  const editable =
    data.can_mark && !finalized && data.status === "scheduled" && !query.error;
  const marks: Record<string, AttendanceMark> = finalized
    ? Object.fromEntries(
        data.roster.map((r) => [r.id, r.attendance || ("" as AttendanceMark)]),
      )
    : draft?.marks || data.marks;
  const conflict =
    !!draft &&
    (draft.revision !== data.revision || draft.token !== data.roster_token);
  const setMarks = (next: Record<string, AttendanceMark>) =>
    setDraft({
      revision: draft?.revision ?? data.revision,
      token: draft?.token ?? data.roster_token,
      marks: next,
    });
  const counts = Object.fromEntries(
    ["present", "late", "absent", "excused", ""].map((status) => [
      status,
      data.roster.filter((r) => (marks[r.id] || "") === status).length,
    ]),
  );
  const save = async (action: "save" | "finish") => {
    if (lock.current || !editable || conflict || inputBusy) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    let revision = draft?.revision ?? data.revision;
    const token = draft?.token ?? data.roster_token;
    const send = async (step: "save" | "finish") => {
      const payload = {
        session: sessionId,
        action: step,
        revision,
        roster_token: token,
        marks: step === "save" ? marks : {},
      };
      const fingerprint = JSON.stringify(payload);
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, key: crypto.randomUUID() };
      return api<{ revision: number }>("attendance/register", {
        ...payload,
        key: pending.current.key,
      });
    };
    // One final action attests the reviewed draft; a racing actor is still rejected.
    let result = await send(action === "finish" && draft ? "save" : action);
    if (result.ok && action === "finish" && draft) {
      revision = result.data.revision;
      setDraft(null);
      pending.current = null;
      result = await send("finish");
    }
    lock.current = false;
    setBusy(false);
    if (result.ok) {
      pending.current = null;
      setDraft(null);
      setSavedRevision(result.data.revision);
      setNotice(
        t(
          action === "finish"
            ? "Attendance finalized. Normal editing is locked."
            : "Draft saved. Coach and branch share this register.",
        ),
      );
      query.refresh();
      window.dispatchEvent(
        new CustomEvent("kafou:saved", { detail: { inlineFeedback: true } }),
      );
      onSaved();
    } else {
      setNotice(result.message);
      query.refresh();
    }
  };
  const format = (v: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(new Date(v));
  return (
    <section
      className="attendance-workspace"
      aria-label={t("Attendance register")}
      data-attendance-session={sessionId}
    >
      <header>
        <div>
          <span className="portal-eyebrow">{t("Attendance register")}</span>
          <h3>{data.name}</h3>
          <p>
            {data.branch} · {t(data.sport)} · {data.level}
          </p>
          <p>
            {format(data.starts_at)} · {data.venue} · {data.coach}
          </p>
        </div>
        <StatusBadge status={finalized ? "finalized" : "draft"} />
      </header>
      <nav className="daily-section-tabs" aria-label={t("Session workflow")}>
        {(
          [
            ["check-in", "Student check-in"],
            ["attendance", "Attendance"],
            ["delivery", "Session delivery"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={panel === value ? "is-active" : ""}
            aria-current={panel === value ? "page" : undefined}
            disabled={inputBusy || !!draft}
            onClick={() => setPanel(value)}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      {!!draft && (
        <p role="status">
          {t("Save or undo draft changes before switching steps.")}
        </p>
      )}
      {panel === "check-in" && (
        <StudentArrivals
          disabled={!!query.error}
          register={data}
          onSaved={() => {
            query.refresh();
            onSaved();
          }}
          onReview={() => setPanel("attendance")}
        />
      )}
      {panel === "delivery" && (
        <SessionDelivery
          key={sessionId}
          session={sessionId}
          branch={data.branch_id}
          finalized={finalized}
          canMark={data.can_mark && !query.error}
          onSaved={onSaved}
        />
      )}
      {panel === "attendance" && (
        <>
          <dl className="attendance-counts">
            {[
              ["Expected", data.roster.length],
              ["Present", counts.present],
              ["Late", counts.late],
              ["Absent", counts.absent],
              ["Excused", counts.excused],
              ["Unresolved", counts[""]],
            ].map(([label, count]) => (
              <div key={label}>
                <dt>{t(String(label))}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          {query.error && <p role="alert">{t(query.error)}</p>}
          {!data.can_mark && (
            <p role="status">
              {t(
                "Read only. Ask the owner for attendance permission for this branch.",
              )}
            </p>
          )}
          {notice && <p role="status">{t(notice)}</p>}
          {conflict && (
            <div role="alert" className="attendance-conflict">
              <p>
                {t(
                  "Another staff member or the roster changed this register. Your unsaved work has not overwritten it.",
                )}
              </p>
              <button
                type="button"
                className="portal-btn"
                onClick={() => setDraft(null)}
              >
                {t("Review latest saved draft")}
              </button>
            </div>
          )}
          {editable && (
            <div className="attendance-toolbar">
              <button
                type="button"
                className="portal-btn"
                disabled={inputBusy || conflict || !counts[""]}
                onClick={() =>
                  setMarks({
                    ...marks,
                    ...Object.fromEntries(
                      data.roster
                        .filter((r) => !marks[r.id])
                        .map((r) => [r.id, "present" as const]),
                    ),
                  })
                }
              >
                {t("Mark unmarked as present")}
              </button>
              <button
                type="button"
                className="portal-btn"
                disabled={!draft || inputBusy}
                onClick={() => setDraft(null)}
              >
                {t("Undo unsaved changes")}
              </button>
            </div>
          )}
          {editable && data.can_photo && (
            <AttendancePhotos
              key={sessionId}
              session={sessionId}
              disabled={!!draft || busy || conflict || synchronizing}
              onProcessing={setPhotoBusy}
              onSaved={(revision) => {
                setSavedRevision(revision);
                query.refresh();
                onSaved();
              }}
            />
          )}
          <div className="attendance-roster">
            {[...data.roster]
              .sort(
                (a, b) =>
                  Number(!!marks[a.id]) - Number(!!marks[b.id]) ||
                  a.name.localeCompare(b.name),
              )
              .map((row) => (
                <div className="attendance-row" key={row.id}>
                  <AttendanceAvatar
                    name={row.name}
                    session={sessionId}
                    roster={row.id}
                    reference={
                      photoScope.data?.find(
                        (r) => r.roster === row.id && r.status === "ready",
                      )?.reference || null
                    }
                  />
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
                    {!marks[row.id] && photoScope.data && (
                      <small className="attendance-exception">
                        {t(
                          (
                            {
                              consent_unavailable: "Consent unavailable",
                              missing_reference: "Missing reference",
                              ready: "Not identified yet",
                            } as Record<string, string>
                          )[
                            photoScope.data.find((r) => r.roster === row.id)
                              ?.status || "ready"
                          ],
                        )}
                      </small>
                    )}
                  </div>
                  {editable && data.photo_review_required?.includes(row.id) && (
                    <button
                      type="button"
                      className="portal-btn"
                      disabled={inputBusy || !!draft || conflict}
                      onClick={async () => {
                        setBusy(true);
                        const result = await api<{ revision: number }>(
                          "attendance/register",
                          {
                            session: sessionId,
                            action: "review",
                            revision: data.revision,
                            roster_token: data.roster_token,
                            marks: {},
                            roster: row.id,
                            key: crypto.randomUUID(),
                          },
                        );
                        setBusy(false);
                        if (result.ok) setSavedRevision(result.data.revision);
                        setNotice(
                          t(
                            result.ok
                              ? "Automatic mark confirmed manually."
                              : result.message,
                          ),
                        );
                        query.refresh();
                      }}
                    >
                      {t("Confirm manually")}
                    </button>
                  )}
                  {manageReferences && data.can_photo && row.child_id && (
                    <button
                      type="button"
                      className="portal-link"
                      onClick={() => setReferenceChild(row.child_id!)}
                    >
                      {t("Reference")}
                    </button>
                  )}
                  <label>
                    <span className="sr-only">
                      {t("Attendance for")} {row.name}
                    </span>
                    <select
                      aria-label={`${t("Attendance for")} ${row.name}`}
                      value={marks[row.id] || ""}
                      disabled={!editable || inputBusy || conflict}
                      onChange={(e) =>
                        setMarks({
                          ...marks,
                          [row.id]: e.target.value as AttendanceMark,
                        })
                      }
                    >
                      {["", "present", "late", "absent", "excused"].map(
                        (status) => (
                          <option key={status} value={status}>
                            {t(status || "Unmarked")}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
              ))}
          </div>
          <PortalDrawer
            open={!!referenceChild}
            onClose={() => setReferenceChild("")}
            title={t("Attendance photo reference")}
          >
            {referenceChild && (
              <AttendanceReference
                key={referenceChild}
                child={referenceChild}
              />
            )}
          </PortalDrawer>
          {finalized && (
            <AttendanceCorrections session={sessionId} roster={data.roster} />
          )}
          {!data.roster.length && <p>{t("No students on this roster.")}</p>}
          {editable && (
            <p className="daily-attestation">
              {t(
                "Finish attendance confirms the recorded arrivals. Photo time is not proof of arrival time.",
              )}
            </p>
          )}
          {editable && (
            <footer className="attendance-footer">
              <span>
                {photoBusy
                  ? t("Processing photos…")
                  : synchronizing
                    ? t("Updating shared register…")
                    : draft
                      ? t("Unsaved draft changes")
                      : t("Shared draft")}
              </span>
              <button
                type="button"
                className="portal-btn"
                disabled={inputBusy || !draft || conflict}
                onClick={() => void save("save")}
              >
                {t(busy ? "Saving…" : "Save draft")}
              </button>
              <button
                type="button"
                className="portal-primary"
                disabled={
                  inputBusy ||
                  conflict ||
                  counts[""] > 0 ||
                  new Date(data.starts_at).getTime() > now
                }
                onClick={() => void save("finish")}
              >
                {t("Finish attendance")}
              </button>
            </footer>
          )}
        </>
      )}
    </section>
  );
}

function AttendanceCorrections({
  session,
  roster,
}: {
  session: string;
  roster: Register["roster"];
}) {
  const { t } = useLocale();
  const q = usePortalQuery<{
    can_resolve: boolean;
    items: {
      id: string;
      roster_id: string;
      reason: string;
      resolved_at: string | null;
    }[];
  }>(`attendance/reviews?session=${session}`);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<{ value: string; key: string } | null>(null);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const value = JSON.stringify([selected, reason]);
    if (request.current?.value !== value)
      request.current = { value, key: crypto.randomUUID() };
    const result = await api("attendance/reviews", {
      action: "request",
      session,
      roster: selected,
      reason,
      key: request.current.key,
    });
    setBusy(false);
    lock.current = false;
    setMessage(
      t(
        result.ok
          ? "Correction requested. Attendance has not been changed."
          : result.message,
      ),
    );
    if (result.ok) {
      setReason("");
      setSelected("");
      request.current = null;
      q.refresh();
    }
  }
  return (
    <details className="attendance-corrections">
      <summary>{t("Attendance corrections")}</summary>
      <p>
        {t(
          "Finalized attendance is locked. Request an authorized correction with a reason.",
        )}
      </p>
      <label>
        {t("Student")}
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">{t("Choose student")}</option>
          {roster.map((r) => (
            <option value={r.id} key={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Correction reason")}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          minLength={5}
        />
      </label>
      <button
        className="portal-btn"
        disabled={busy || !selected || reason.trim().length < 5 || !!q.error}
        onClick={() => void submit()}
      >
        {t("Request correction")}
      </button>
      {message && <p role="status">{message}</p>}
      {q.error && <p role="alert">{t(q.error)}</p>}
      {q.data?.items.map((r) => (
        <article key={r.id}>
          <strong>
            {roster.find((x) => x.id === r.roster_id)?.name || t("Student")}
          </strong>
          <p>{r.reason}</p>
          <span>{t(r.resolved_at ? "Reviewed" : "Awaiting review")}</span>
          {q.data?.can_resolve && !r.resolved_at && (
            <button
              className="portal-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await api("attendance/reviews", {
                  action: "resolve",
                  id: r.id,
                });
                setBusy(false);
                setMessage(
                  t(
                    result.ok
                      ? "Request reviewed. Attendance changes use the authorized correction controls."
                      : result.message,
                  ),
                );
                q.refresh();
              }}
            >
              {t("Mark reviewed")}
            </button>
          )}
        </article>
      ))}
    </details>
  );
}

function AttendanceAvatar({
  name,
  session,
  roster,
  reference,
}: {
  name: string;
  session: string;
  roster: string;
  reference: string | null;
}) {
  const [photo, setPhoto] = useState<{ key: string; content: string } | null>(
    null,
  );
  const key = `${session}:${roster}:${reference}`;
  useEffect(() => {
    let current = true;
    if (reference)
      void api<{ content: string }>("attendance/photos", {
        action: "thumbnail",
        session,
        roster,
      }).then((r) => {
        if (current && r.ok) setPhoto({ key, content: r.data.content });
      });
    return () => {
      current = false;
    };
  }, [key, reference, session, roster]);
  if (!reference || photo?.key !== key) return <Avatar name={name} small />;
  // Private consent-scoped image must not be sent through remote optimization.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="attendance-avatar"
      src={`data:image/jpeg;base64,${photo.content}`}
      alt={name}
      width={40}
      height={40}
    />
  );
}
