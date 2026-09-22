"use client";
import { administratorVerified } from "@/lib/platform/contracts";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { productCommand, type ProductRow } from "@/lib/platform/product";
import { recognitionChildren } from "@/lib/platform/community-model";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductProps,
  type ProductField,
} from "./product-shared";

type Option = { value: string; label: string };
const options = (
  rows: ProductRow[],
  label: (r: ProductRow) => string,
): Option[] => rows.map((r) => ({ value: val(r, "id"), label: label(r) }));
function CommunityAction({
  action,
  payload,
  label,
  onSaved,
}: {
  action: string;
  payload: ProductRow;
  label: string;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  return (
    <span className="product-inline-action">
      <button
        type="button"
        className="button button-ghost"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          const fp = JSON.stringify(payload);
          if (fingerprint.current && fingerprint.current !== fp)
            key.current = crypto.randomUUID();
          fingerprint.current = fp;
          setBusy(true);
          setNotice("");
          try {
            const result = await productCommand(action, payload, key.current);
            if (result.ok) {
              key.current = crypto.randomUUID();
              onSaved();
              setNotice(t("Saved"));
            } else setNotice(t(result.message));
          } catch {
            setNotice(t("Unable to save. Retry with the same details."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(busy ? "Saving…" : label)}
      </button>
      {notice && <span role="status">{notice}</span>}
    </span>
  );
}
function GuardianInvite({ families }: { families: ProductRow[] }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState<{
    token: string;
    family: string;
    account: string;
  } | null>(null);
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  return (
    <div>
      <form
        className="ops-editor product-form"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setNotice("");
          setInvite(null);
          const fd = new FormData(e.currentTarget);
          const family_id = String(fd.get("family_id") ?? "");
          const user_id = String(fd.get("user_id") ?? "").trim();
          const fp = family_id + user_id;
          if (fingerprint.current && fingerprint.current !== fp)
            key.current = crypto.randomUUID();
          fingerprint.current = fp;
          setBusy(true);
          try {
            const result = await productCommand<{ token?: string }>(
              "community.guardian.invite",
              { family_id, user_id },
              key.current,
            );
            if (result.ok && result.data.token) {
              setInvite({
                token: result.data.token,
                family: val(
                  families.find((f) => f.id === family_id),
                  "name",
                ),
                account: user_id,
              });
              key.current = crypto.randomUUID();
            } else
              setNotice(
                result.ok
                  ? t("Invitation code was not returned.")
                  : t(result.message),
              );
          } catch {
            setNotice(t("Unable to save. Retry with the same details."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>{t("Invite another guardian")}</h3>
        <ProductNotice>
          {t(
            "Ask the guardian for their verified parent account ID. The invitation grants access to this whole family. Share its one-time code privately; it expires after 24 hours.",
          )}
        </ProductNotice>
        <div className="ops-form-grid">
          <label>
            {t("Family")}
            <select name="family_id" required defaultValue="">
              <option value="">{t("Choose")}</option>
              {families.map((f) => (
                <option key={val(f, "id")} value={val(f, "id")}>
                  {val(f, "name")}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Verified parent account ID")}
            <input
              name="user_id"
              required
              autoComplete="off"
              spellCheck={false}
              pattern="[0-9a-fA-F-]{36}"
            />
          </label>
        </div>
        {notice && <p role="status">{notice}</p>}
        <button disabled={busy} className="button button-green">
          {t(busy ? "Saving…" : "Create private invitation code")}
        </button>
      </form>
      {invite && (
        <section className="ops-card" aria-label={t("Private invitation code")}>
          <h3>{t("Private invitation code")}</h3>
          <p>
            {invite.family} · {invite.account}
          </p>
          <p>{t("Only the invited parent account can accept this code.")}</p>
          <label>
            {t("Invitation code")}
            <input
              readOnly
              value={invite.token}
              autoComplete="off"
              spellCheck={false}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setInvite(null)}
          >
            {t("Hide code")}
          </button>
        </section>
      )}
    </div>
  );
}
function DocumentDecision({
  document,
  families,
  onSaved,
}: {
  document: ProductRow;
  families: ProductRow[];
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [family, setFamily] = useState(
    families.length === 1 ? val(families[0], "id") : "",
  );
  const [read, setRead] = useState(false);
  return (
    <div className="product-document-decision">
      <label>
        {t("Family")}
        <select
          value={family}
          onChange={(e) => {
            setFamily(e.target.value);
            setRead(false);
          }}
        >
          <option value="">{t("Choose")}</option>
          {families.map((f) => (
            <option key={val(f, "id")} value={val(f, "id")}>
              {val(f, "name")}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={read}
          onChange={(e) => setRead(e.target.checked)}
        />
        {t(
          "I have read this exact document version and choose to accept it for my family.",
        )}
      </label>
      {family && read && (
        <CommunityAction
          action="community.document.accept"
          payload={{ id: document.id, family_id: family, granted: true }}
          label="Record my acceptance"
          onSaved={onSaved}
        />
      )}
      {family && (
        <CommunityAction
          action="community.document.accept"
          payload={{ id: document.id, family_id: family, granted: false }}
          label="Withdraw my acceptance"
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
function HandoverForm({
  branches,
  assignees,
  onSaved,
}: {
  branches: Option[];
  assignees: Option[];
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  return (
    <form
      className="ops-editor product-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const fd = new FormData(e.currentTarget);
        const payload: ProductRow = {
          branch_id: String(fd.get("branch_id")),
          title: String(fd.get("title")).trim(),
          note: String(fd.get("note")).trim(),
        };
        const assigned = String(fd.get("assigned_to") ?? "");
        const follow = String(fd.get("follow_up_at") ?? "");
        if (assigned) payload.assigned_to = assigned;
        if (follow) {
          const parsed = new Date(follow);
          if (Number.isNaN(parsed.getTime())) {
            setNotice(t("Choose a valid follow-up time."));
            return;
          }
          payload.follow_up_at = parsed.toISOString();
        }
        const fp = JSON.stringify(payload);
        if (fingerprint.current && fingerprint.current !== fp)
          key.current = crypto.randomUUID();
        fingerprint.current = fp;
        setBusy(true);
        setNotice("");
        try {
          const result = await productCommand(
            "community.handover.create",
            payload,
            key.current,
          );
          if (result.ok) {
            key.current = crypto.randomUUID();
            setNotice(t("Saved"));
            onSaved();
          } else setNotice(t(result.message));
        } catch {
          setNotice(t("Unable to save. Retry with the same details."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t("Create shift handover")}</h3>
      <div className="ops-form-grid">
        <label>
          {t("Branch")}
          <select name="branch_id" required defaultValue="">
            <option value="">{t("Choose")}</option>
            {branches.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Title")}
          <input name="title" required maxLength={160} />
        </label>
        <label>
          {t("Handover note")}
          <textarea name="note" required maxLength={2000} />
        </label>
        <label>
          {t("Assign to (optional)")}
          <select name="assigned_to" defaultValue="">
            <option value="">{t("Unassigned")}</option>
            {assignees.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Follow-up time (your device timezone)")}
          <input type="datetime-local" name="follow_up_at" />
        </label>
      </div>
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} className="button button-green">
        {t(busy ? "Saving…" : "Create handover")}
      </button>
    </form>
  );
}
export function CommunityPanel({
  account,
  data,
  refresh,
  section,
}: ProductProps) {
  const { t, locale } = useLocale();
  const rows = (name: string) => data[name] ?? [];
  const lookup = (name: string, id: unknown, field = "name") =>
    val(
      rows(name).find((r) => r.id === id),
      field,
    );
  const isStaff = account.roles.some((r) =>
    ["super_admin", "admin", "branch"].includes(r),
  );
  const isCoach = account.roles.includes("coach");
  const isHead = account.roles.some((r) =>
    ["super_admin", "admin"].includes(r),
  );
  const isOwner =
    account.roles.includes("super_admin") && administratorVerified(account);
  const families = rows("families");
  const ownedFamilies = families.filter(
    (f) =>
      account.roles.includes("parent") &&
      rows("guardians").some(
        (g) => g.family_id === f.id && g.user_id === account.userId,
      ),
  );
  const familyOptions = options(families, (f) => val(f, "name"));
  const branchOptions = options(rows("branches"), (b) =>
    locale === "ar" && b.name_ar ? val(b, "name_ar") : val(b, "name"),
  );
  const recognitionSubjects = recognitionChildren(data, isStaff);
  const recognitionName = (id: unknown) =>
    recognitionSubjects.find((child) => child.id === id)?.name ||
    lookup("children", id) ||
    t("Child");
  const recognitionBranches = isStaff
    ? branchOptions
    : branchOptions.filter((branch) =>
        rows("development_sessions").some(
          (session) =>
            session.can_coach === true &&
            session.status !== "cancelled" &&
            session.branch_id === branch.value,
        ),
      );
  const staffOptions = options(
    rows("profiles").filter((p) =>
      rows("role_assignments").some(
        (r) =>
          r.user_id === p.id &&
          ["admin", "super_admin", "branch"].includes(val(r, "role")),
      ),
    ),
    (p) => val(p, "name"),
  );
  const branchStaff = options(
    rows("profiles").filter((p) =>
      rows("role_assignments").some(
        (r) => r.user_id === p.id && r.role === "branch",
      ),
    ),
    (p) => val(p, "name"),
  );
  const normalized = section.toLowerCase();
  const defaultView = normalized.includes("notification")
    ? "notifications"
    : normalized.includes("handover")
      ? "handover"
      : normalized.includes("document")
        ? "documents"
        : normalized.includes("recognition")
          ? "recognition"
          : normalized.includes("family") || normalized.includes("guardian")
            ? "family"
            : "support";
  const [selection, setSelection] = useState({ section, view: defaultView });
  const view = selection.section === section ? selection.view : defaultView;
  const sections = [
    ["notifications", "Notifications"],
    ["support", "Support"],
    ["family", "Family access"],
    ["documents", "Documents"],
    ["recognition", "Recognition"],
    ...(isStaff ? [["handover", "Handover"]] : []),
  ];
  const tickets = rows("support_tickets");
  const ticketName = (r: ProductRow) =>
    `${val(r, "reference")} · ${val(r, "subject")}`;
  const formatDate = (v: unknown) =>
    v
      ? new Date(String(v)).toLocaleString(locale === "ar" ? "ar-AE" : "en-AE")
      : "—";
  const messageField: ProductField = {
    name: "message",
    label: "Message",
    type: "textarea",
    required: true,
  };
  return (
    <section
      className="product-panel community-panel"
      aria-label={t("Family and community")}
    >
      <nav className="ops-subnav" aria-label={t("Community sections")}>
        {sections.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={view === key}
            className={view === key ? "active" : ""}
            onClick={() => setSelection({ section, view: key })}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      {view === "notifications" && (
        <>
          <h2>{t("Notifications")}</h2>
          <ProductNotice>
            {t(
              "Notifications appear inside this account. Email, WhatsApp, and push delivery are not configured; queued records are not delivery confirmation.",
            )}
          </ProductNotice>
          {!rows("notifications").length && (
            <ProductNotice>
              {t("No notifications are available for this account.")}
            </ProductNotice>
          )}
          <div className="product-cards">
            {rows("notifications").map((n) => {
              const href = val(n, "href");
              const safeHref =
                href.startsWith("/") &&
                !href.startsWith("//") &&
                !href.includes("\\");
              return (
                <article className="ops-card" key={val(n, "id")}>
                  <h3>{t(val(n, "title"))}</h3>
                  <p>{t(val(n, "body"))}</p>
                  <p>
                    {formatDate(n.created_at)} ·{" "}
                    {t(n.read_at ? "Read" : "Unread")}
                  </p>
                  {safeHref && <a href={href}>{t("Open related record")}</a>}
                  {!n.read_at && (
                    <CommunityAction
                      action="community.notification.read"
                      payload={{ id: n.id }}
                      label="Mark as read"
                      onSaved={refresh}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
      {view === "support" && (
        <>
          <h2>{t("Support")}</h2>
          {!tickets.length && (
            <ProductNotice>
              {t(
                "No support conversations are available in your permitted scope.",
              )}
            </ProductNotice>
          )}
          <div className="product-cards">
            {tickets.map((ticket) => (
              <article className="ops-card" key={val(ticket, "id")}>
                <h3>{ticketName(ticket)}</h3>
                <p>
                  {lookup("families", ticket.family_id)} ·{" "}
                  {lookup("branches", ticket.branch_id)} ·{" "}
                  {t(val(ticket, "status"))}
                </p>
                {Boolean(ticket.child_id) && (
                  <p>
                    {t("Child")}: {lookup("children", ticket.child_id)}
                  </p>
                )}
                {Boolean(ticket.invoice_id) && (
                  <p>
                    {t("Invoice")}:{" "}
                    {lookup(
                      "commercial_invoices",
                      ticket.invoice_id,
                      "reference",
                    ) || t("Linked invoice")}
                  </p>
                )}
                {Boolean(ticket.assigned_to) && (
                  <p>
                    {t("Assigned to")}:{" "}
                    {lookup("profiles", ticket.assigned_to) ||
                      t("Academy staff")}
                  </p>
                )}
                <ol className="product-conversation">
                  {rows("support_messages")
                    .filter((m) => m.ticket_id === ticket.id)
                    .sort((a, b) =>
                      val(a, "created_at").localeCompare(val(b, "created_at")),
                    )
                    .map((m) => (
                      <li key={val(m, "id")}>
                        <strong>
                          {m.author_id === account.userId
                            ? t("You")
                            : lookup("profiles", m.author_id) ||
                              t("Participant")}
                        </strong>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {val(m, "message")}
                        </p>
                        <small>{formatDate(m.created_at)}</small>
                      </li>
                    ))}
                </ol>
                {ticket.status === "resolved" ? (
                  <p>
                    {t("Resolution")}: {val(ticket, "resolution")}
                  </p>
                ) : (
                  <>
                    <ProductForm
                      title="Reply to conversation"
                      action="community.ticket.reply"
                      initial={{ id: ticket.id }}
                      fields={[messageField]}
                      onSaved={refresh}
                      submitLabel="Send reply"
                    />
                    <details>
                      <summary>{t("Resolve conversation")}</summary>
                      <ProductForm
                        title="Record a resolution"
                        action="community.ticket.resolve"
                        initial={{ id: ticket.id }}
                        fields={[
                          {
                            name: "resolution",
                            label: "Resolution",
                            required: true,
                            type: "textarea",
                          },
                        ]}
                        onSaved={refresh}
                        submitLabel="Resolve conversation"
                      />
                    </details>
                  </>
                )}
              </article>
            ))}
          </div>
          {(isStaff || ownedFamilies.length > 0) && (
            <ProductForm
              title="Open a support conversation"
              action="community.ticket.open"
              fields={[
                {
                  name: "family_id",
                  label: "Family",
                  required: true,
                  options: familyOptions,
                },
                {
                  name: "branch_id",
                  label: "Branch",
                  required: true,
                  options: branchOptions,
                },
                { name: "subject", label: "Subject", required: true },
                messageField,
                {
                  name: "child_id",
                  label: "Child (optional)",
                  options: options(
                    rows("children"),
                    (c) =>
                      `${val(c, "name")} · ${lookup("families", c.family_id)}`,
                  ),
                },
                {
                  name: "session_id",
                  label: "Session (optional)",
                  options: options(
                    rows("class_sessions"),
                    (s) =>
                      `${lookup("academy_classes", s.class_id)} · ${formatDate(s.starts_at)}`,
                  ),
                },
                {
                  name: "invoice_id",
                  label: "Invoice (optional)",
                  options: options(rows("commercial_invoices"), (i) =>
                    val(i, "reference"),
                  ),
                },
              ]}
              onSaved={refresh}
              submitLabel="Create support conversation"
            />
          )}
          {isStaff && (
            <ProductForm
              title="Assign support conversation"
              action="community.ticket.assign"
              fields={[
                {
                  name: "id",
                  label: "Conversation",
                  required: true,
                  options: options(
                    tickets.filter((t) => t.status !== "resolved"),
                    ticketName,
                  ),
                },
                {
                  name: "user_id",
                  label: "Assigned to",
                  required: true,
                  options: staffOptions,
                },
              ]}
              onSaved={refresh}
            />
          )}
        </>
      )}
      {view === "family" && (
        <>
          <h2>{t("Family access")}</h2>
          <p>
            {t("Your account ID")}: <code>{account.userId}</code>
          </p>
          <ProductNotice>
            {t(
              "Guardianship links provide access to the whole family. An invitation is accepted only by its named, verified parent account; matching an email address does not grant access.",
            )}
          </ProductNotice>
          {rows("family_emergency_contacts").map((c) => (
            <article key={val(c, "id")} className="ops-card">
              <h3>
                {lookup("families", c.family_id)} · {t("Emergency contact")}
              </h3>
              <p>
                {val(c, "name")} · {val(c, "relationship")}
              </p>
              <p dir="ltr">{val(c, "mobile")}</p>
            </article>
          ))}
          {ownedFamilies.map((family) => (
            <article className="ops-card" key={val(family, "id")}>
              <h3>
                {val(family, "name")} · {t("Linked guardians")}
              </h3>
              <ul>
                {rows("guardians")
                  .filter((g) => g.family_id === family.id)
                  .map((g) => (
                    <li key={val(g, "user_id")}>
                      {g.user_id === account.userId
                        ? t("You")
                        : lookup("profiles", g.user_id) || t("Guardian")}{" "}
                      · <code>{val(g, "user_id")}</code>
                    </li>
                  ))}
              </ul>
            </article>
          ))}
          {ownedFamilies.length > 0 && (
            <>
              <ProductForm
                title="Save emergency contact"
                action="community.contact.save"
                fields={[
                  {
                    name: "family_id",
                    label: "Family",
                    required: true,
                    options: options(ownedFamilies, (f) => val(f, "name")),
                  },
                  { name: "name", label: "Contact name", required: true },
                  {
                    name: "mobile",
                    label: "Mobile number",
                    required: true,
                    type: "tel",
                  },
                  {
                    name: "relationship",
                    label: "Relationship",
                    required: true,
                  },
                ]}
                onSaved={refresh}
              />
              <GuardianInvite families={ownedFamilies} />
              <ProductForm
                title="Revoke an invited guardian"
                action="community.guardian.revoke"
                fields={[
                  {
                    name: "family_id",
                    label: "Family",
                    required: true,
                    options: options(ownedFamilies, (f) => val(f, "name")),
                  },
                  {
                    name: "user_id",
                    label: "Invited guardian account ID",
                    required: true,
                  },
                ]}
                onSaved={refresh}
                submitLabel="Revoke family access"
              />
              <ProductNotice>
                {t(
                  "Only access created by your invitation can be removed. Revoking a pending invitation preserves independently granted family access.",
                )}
              </ProductNotice>
            </>
          )}
          {account.roles.includes("parent") && (
            <ProductForm
              title="Accept a guardian invitation"
              action="community.guardian.accept"
              fields={[
                {
                  name: "token",
                  label: "Private invitation code",
                  required: true,
                },
              ]}
              onSaved={refresh}
              submitLabel="Accept family access"
            />
          )}
        </>
      )}
      {view === "handover" && (
        <>
          <h2>{t("Handover")}</h2>
          <ProductNotice>
            {t(
              "Handover notes coordinate follow-up. They do not verify a pickup, authorize release of a child, or replace safeguarding checks.",
            )}
          </ProductNotice>
          {!rows("shift_handovers").length && (
            <ProductNotice>
              {t("No handovers are available in your permitted scope.")}
            </ProductNotice>
          )}
          <div className="product-cards">
            {rows("shift_handovers").map((h) => (
              <article className="ops-card" key={val(h, "id")}>
                <h3>{val(h, "title")}</h3>
                <p>
                  {lookup("branches", h.branch_id)} · {t(val(h, "status"))}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{val(h, "note")}</p>
                <p>
                  {t("Assigned to")}:{" "}
                  {lookup("profiles", h.assigned_to) || t("Unassigned")} ·{" "}
                  {t("Follow-up")}: {formatDate(h.follow_up_at)}
                </p>
                {h.status === "resolved" ? (
                  <p>
                    {t("Resolution")}: {val(h, "resolution")}
                  </p>
                ) : (
                  isStaff && (
                    <ProductForm
                      title="Close handover"
                      action="community.handover.close"
                      initial={{ id: h.id }}
                      fields={[
                        {
                          name: "resolution",
                          label: "Resolution",
                          type: "textarea",
                          required: true,
                        },
                      ]}
                      onSaved={refresh}
                    />
                  )
                )}
              </article>
            ))}
          </div>
          {isStaff && (
            <HandoverForm
              branches={branchOptions}
              assignees={branchStaff}
              onSaved={refresh}
            />
          )}
        </>
      )}
      {view === "documents" && (
        <>
          <h2>{t("Documents")}</h2>
          <ProductNotice>
            {t(
              "Document versions are synthetic until the academy approves their wording. Acceptance records the signed-in guardian’s explicit choice for that version; it is not a handwritten signature.",
            )}
          </ProductNotice>
          {!rows("document_versions").length && (
            <ProductNotice>
              {t("No document versions are available.")}
            </ProductNotice>
          )}
          <div className="product-cards">
            {rows("document_versions").map((d) => (
              <article className="ops-card" key={val(d, "id")}>
                <h3>{val(d, "title")}</h3>
                <p>
                  {t(val(d, "purpose"))} · {t("Version")} {val(d, "version")}
                </p>
                <div style={{ whiteSpace: "pre-wrap" }}>{val(d, "body")}</div>
                <details>
                  <summary>{t("Acceptance history")}</summary>
                  <ul>
                    {rows("document_acceptances")
                      .filter((a) => a.document_id === d.id)
                      .sort((a, b) =>
                        val(b, "created_at").localeCompare(
                          val(a, "created_at"),
                        ),
                      )
                      .map((a) => (
                        <li key={val(a, "id")}>
                          {lookup("families", a.family_id)} ·{" "}
                          {t(a.granted ? "Accepted" : "Withdrawn")} ·{" "}
                          {a.guardian_id === account.userId
                            ? t("You")
                            : t("Guardian")}{" "}
                          · {formatDate(a.created_at)}
                        </li>
                      ))}
                  </ul>
                </details>
                {ownedFamilies.length > 0 && (
                  <DocumentDecision
                    document={d}
                    families={ownedFamilies}
                    onSaved={refresh}
                  />
                )}
              </article>
            ))}
          </div>
          {isOwner && (
            <ProductForm
              title="Create a document version"
              action="community.document.create"
              fields={[
                { name: "title", label: "Document title", required: true },
                {
                  name: "purpose",
                  label: "Purpose",
                  required: true,
                  options: ["privacy", "waiver", "media", "contact"].map(
                    (p) => ({ value: p, label: t(p) }),
                  ),
                },
                { name: "version", label: "Version", required: true },
                {
                  name: "body",
                  label: "Full document text",
                  type: "textarea",
                  required: true,
                },
              ]}
              onSaved={refresh}
            />
          )}
        </>
      )}
      {view === "recognition" && (
        <>
          <h2>{t("Recognition")}</h2>
          <ProductNotice>
            {t(
              "Recognition needs an independent review before appearing to a family. Approval does not publish a child’s identity or image publicly and does not create a cash reward.",
            )}
          </ProductNotice>
          {!rows("recognition_nominations").length && (
            <ProductNotice>
              {t(
                "No recognition records are available in your permitted scope.",
              )}
            </ProductNotice>
          )}
          <div className="product-cards">
            {rows("recognition_nominations").map((n) => (
              <article className="ops-card" key={val(n, "id")}>
                <h3>{val(n, "title")}</h3>
                <p>
                  {recognitionName(n.child_id)} · {t(val(n, "status"))}
                </p>
                <p>{val(n, "evidence")}</p>
                {Boolean(n.review_reason) && (
                  <p>
                    {t("Review")}: {val(n, "review_reason")}
                  </p>
                )}
              </article>
            ))}
          </div>
          {(isStaff || isCoach) && (
            <ProductForm
              title="Nominate recognition"
              action="community.recognition.nominate"
              fields={[
                {
                  name: "child_id",
                  label: "Child",
                  required: true,
                  options: options(recognitionSubjects, (c) => val(c, "name")),
                },
                {
                  name: "branch_id",
                  label: "Branch",
                  required: true,
                  options: recognitionBranches,
                },
                { name: "title", label: "Recognition title", required: true },
                {
                  name: "evidence",
                  label: "Evidence",
                  type: "textarea",
                  required: true,
                },
              ]}
              onSaved={refresh}
            />
          )}{" "}
          {isHead && (
            <ProductForm
              title="Review recognition nomination"
              action="community.recognition.review"
              fields={[
                {
                  name: "id",
                  label: "Nomination",
                  required: true,
                  options: options(
                    rows("recognition_nominations").filter(
                      (n) =>
                        n.status === "submitted" &&
                        n.nominated_by !== account.userId,
                    ),
                    (n) =>
                      `${recognitionName(n.child_id)} · ${val(n, "title")}`,
                  ),
                },
                {
                  name: "decision",
                  label: "Decision",
                  required: true,
                  options: [
                    { value: "approved", label: "Approve" },
                    { value: "returned", label: "Return for review" },
                  ],
                },
                {
                  name: "reason",
                  label: "Review reason",
                  type: "textarea",
                  required: true,
                },
              ]}
              onSaved={refresh}
            />
          )}
        </>
      )}
    </section>
  );
}
