"use client";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { money } from "@/lib/platform/commercial";
import { productCommand } from "@/lib/platform/product";
import {
  type PortalRow,
  type PortalData,
  value,
} from "@/lib/platform/portal-model";
import { PortalDrawer, StatusBadge } from "./portal-ui";
import { ParentMembershipStart } from "./commercial-panel";
import { usePortalQuery } from "./use-portal-query";
type Page = { items: PortalRow[]; total: number };
export function ParentMemberships({
  child,
  workspaceData,
  refresh: refreshWorkspace,
}: {
  child: string;
  workspaceData: PortalData;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const [start, setStart] = useState(false);
  const [history, setHistory] = useState(false),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<PortalRow | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID()),
    locked = useRef(false);
  const { data, error, denied, refresh } = usePortalQuery<Page>(
    `portal/memberships?child=${child}&history=${history}&offset=${offset}`.replace(
      "child=&",
      "",
    ),
  );
  const date = (s: unknown) =>
    new Date(`${s}T12:00:00+04:00`).toLocaleDateString(
      locale === "ar" ? "ar-AE" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" },
    );
  const close = () => {
    if (!locked.current) {
      setSelected(null);
      setNotice("");
    }
  };
  return (
    <section
      className="family-memberships"
      aria-label={t("Membership overview")}
    >
      <div className="family-section-header">
        <div>
          <h2>{t("Membership overview")}</h2>
          <p>{t("Your child’s package, sessions and next step.")}</p>
        </div>
        <div className="work-view-toggle">
          <button
            aria-pressed={!history}
            onClick={() => {
              setHistory(false);
              setOffset(0);
            }}
          >
            {t("Current")}
          </button>
          <button
            aria-pressed={history}
            onClick={() => {
              setHistory(true);
              setOffset(0);
            }}
          >
            {t("History")}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert">
          {t(error)} <button onClick={refresh}>{t("Retry")}</button>
        </p>
      ) : !data ? (
        <p className="member-loading" role="status">
          {t("Loading memberships…")}
        </p>
      ) : (
        <>
          {!data.items.length && (
            <div className="family-empty">
              <h3>
                {t(
                  history ? "No previous memberships" : "No current membership",
                )}
              </h3>
              <p>
                {t(
                  "Contact your branch to review suitable packages and availability.",
                )}
              </p>
              <a className="portal-link" href="/parent?view=Support">
                {t("Contact support")}
              </a>
            </div>
          )}
          <div className="family-membership-grid">
            {data.items.map((m) => {
              const status = value(m, "effective_status");
              const canRenew =
                !history &&
                m.status !== "cancelled" &&
                m.offer_enabled &&
                !m.renewal_id;
              return (
                <article
                  className="family-membership-card"
                  key={value(m, "id")}
                  data-membership-child={value(m, "child_id")}
                >
                  <header>
                    <div>
                      <p className="family-eyebrow">{value(m, "child_name")}</p>
                      <h3>
                        {locale === "ar" && m.package_name_ar
                          ? value(m, "package_name_ar")
                          : value(m, "package_name")}
                      </h3>
                      <p>
                        {t(value(m, "sport"))} ·{" "}
                        {value(m, "branch_name") ||
                          t("Branch details unavailable")}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </header>
                  <div className="family-membership-card-id" dir="ltr">
                    {t("Membership card")} · {value(m, "id").slice(0, 8).toUpperCase()}
                  </div>
                  <p className="family-validity">
                    {date(m.starts_on)} — {date(m.expires_on)}
                  </p>
                  <dl className="family-session-counts">
                    <div>
                      <dt>
                        {t(history ? "Unused at expiry" : "Available to book")}
                      </dt>
                      <dd>{Number(m.available)}</dd>
                    </div>
                    <div>
                      <dt>{t("Reserved")}</dt>
                      <dd>{Number(m.reserved)}</dd>
                    </div>
                    <div>
                      <dt>{t("Attended / used")}</dt>
                      <dd>{Number(m.consumed)}</dd>
                    </div>
                  </dl>
                  <p className="family-helper">
                    {t(
                      "Available sessions can be booked; reserved sessions are already allocated. Used sessions follow your attendance policy.",
                    )}
                  </p>
                  <div className="family-membership-balance">
                    <span>{t("Amount due")}</span>
                    <strong>
                      {m.due_minor === null
                        ? t("Invoice unavailable")
                        : money(Number(m.due_minor), locale)}
                    </strong>
                  </div>
                  {status === "suspended" && (
                    <p>
                      {t(
                        "Booking is unavailable while this membership is suspended. Contact your branch.",
                      )}
                    </p>
                  )}
                  {m.status === "pending" && (
                    <p>
                      {t(
                        "Awaiting payment — this membership is not active yet.",
                      )}
                    </p>
                  )}
                  <footer>
                    {Boolean(m.invoice_id) && (
                      <a
                        className="portal-link"
                        href={`/api/product/invoices/${m.invoice_id}?locale=${locale}`}
                      >
                        {t("View invoice")}
                      </a>
                    )}
                    {canRenew ? (
                      <button
                        className="portal-primary"
                        onClick={() => {
                          setSelected(m);
                          setNotice("");
                          key.current = crypto.randomUUID();
                        }}
                      >
                        {t("Renew membership")}
                      </button>
                    ) : m.renewal_id ? (
                      <span>{t("Renewal already requested")}</span>
                    ) : !history && !m.offer_enabled ? (
                      <span>
                        {t(
                          "This offer is unavailable for new sales or renewals. Contact your branch.",
                        )}
                      </span>
                    ) : null}
                  </footer>
                  <details className="family-contract">
                    <summary>{t("Purchased terms and details")}</summary>
                    <p>
                      {locale === "ar" && m.terms_ar
                        ? value(m, "terms_ar")
                        : value(m, "terms")}
                    </p>
                    <p>
                      {t("Purchased sessions")}: {Number(m.session_allowance)} ·{" "}
                      {money(Number(m.price_minor), locale)}
                    </p>
                    <p>
                      {t("Record reference")}: <code>{value(m, "id")}</code>
                    </p>
                  </details>
                </article>
              );
            })}
          </div>
          {data.total > 20 && (
            <nav
              className="family-pagination"
              aria-label={t("Membership pages")}
            >
              <button
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                {t("Previous")}
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 20, data.total)} / {data.total}
              </span>
              <button
                disabled={offset + 20 >= data.total}
                onClick={() => setOffset(offset + 20)}
              >
                {t("Next")}
              </button>
            </nav>
          )}
        </>
      )}
      <button className="portal-link" onClick={() => setStart(true)}>
        {t("Start a membership")}
      </button>
      <PortalDrawer
        open={start && !denied}
        onClose={() => setStart(false)}
        title={t("Start a membership")}
      >
        <ParentMembershipStart
          data={workspaceData}
          child={child}
          refresh={() => {
            refresh();
            refreshWorkspace();
          }}
        />
      </PortalDrawer>
      <PortalDrawer
        open={!!selected && !denied}
        onClose={close}
        title={t("Review renewal")}
      >
        {selected && (
          <form
            className="family-renewal"
            aria-busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              if (locked.current) return;
              locked.current = true;
              setBusy(true);
              setNotice("");
              try {
                const r = await productCommand(
                  "commercial.membership.renew",
                  {
                    id: selected.id,
                    accepted: true,
                    expected_expires_on: selected.expires_on,
                    expected_package_id: selected.package_id,
                  },
                  key.current,
                );
                if (r.ok) {
                  setNotice(
                    r.data.unchanged
                      ? "Renewal already requested — view the existing membership and invoice."
                      : "Invoice created — awaiting payment. Please contact your branch to arrange payment.",
                  );
                  refresh();
                  refreshWorkspace();
                } else setNotice(r.message);
              } finally {
                locked.current = false;
                setBusy(false);
              }
            }}
          >
            <h3>{value(selected, "child_name")}</h3>
            <p>
              {value(selected, "package_name")} ·{" "}
              {value(selected, "branch_name")}
            </p>
            <dl className="family-review">
              <div>
                <dt>{t("Next period")}</dt>
                <dd>
                  {date(selected.expires_on)} —{" "}
                  {date(selected.renewal_expires_on)}
                </dd>
              </div>
              <div>
                <dt>{t("Price")}</dt>
                <dd>{money(Number(selected.price_minor), locale)}</dd>
              </div>
              <div>
                <dt>{t("Sessions")}</dt>
                <dd>{Number(selected.session_allowance)}</dd>
              </div>
              {Boolean(selected.offer_revision) && (
                <div>
                  <dt>{t("Offer revision")}</dt>
                  <dd>{Number(selected.offer_revision)}</dd>
                </div>
              )}
            </dl>
            <h4>{t("Package terms")}</h4>
            <p>
              {locale === "ar" && selected.terms_ar
                ? value(selected, "terms_ar")
                : value(selected, "terms")}
            </p>
            <p>
              {t(
                "Availability and existing renewal records are checked when you confirm. Online payment is not active.",
              )}
            </p>
            <label className="management-check">
              <input type="checkbox" required />
              {t(
                "I accept this package and its terms for the next monthly period.",
              )}
            </label>
            {notice && <p role="status">{t(notice)}</p>}
            {!notice.startsWith("Invoice created") &&
              !notice.startsWith("Renewal already requested") && (
                <button className="portal-primary" disabled={busy}>
                  {t(busy ? "Saving…" : "Create renewal invoice")}
                </button>
              )}
          </form>
        )}
      </PortalDrawer>
    </section>
  );
}
