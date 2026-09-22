"use client";
import { useLocale } from "@/components/kafou/locale";
import {
  entitlementBalance,
  invoiceBalance,
  money,
} from "@/lib/platform/commercial";
import type { ProductData } from "@/lib/platform/product";
import { val } from "./product-shared";
import {
  ArrowUpRight,
  CalendarCheck,
  MessageSquare,
  ClipboardCheck,
  Wallet,
} from "lucide-react";
export function ProductHome({
  data,
  workspace,
  navigate,
}: {
  data: ProductData;
  workspace: string;
  navigate: (s: string) => void;
}) {
  const { t, locale } = useLocale();
  const r = (k: string) => data[k] || [];
  const parent = workspace === "parent";
  const staff = ["admin", "branch"].includes(workspace);
  const next = r("family_schedule")
    .filter(
      (s) =>
        s.status === "scheduled" && new Date(String(s.starts_at)) > new Date(),
    )
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))[0];
  const latest = r("development_assessments")
    .filter((a) => a.status === "published")
    .sort((a, b) =>
      String(b.published_at).localeCompare(String(a.published_at)),
    )[0];
  const unread = r("notifications").filter((x) => !x.read_at);
  const reviews = r("development_assessments").filter(
    (x) => x.status === "submitted",
  );
  const tickets = r("support_tickets").filter((x) => x.status !== "resolved");
  const credits = r("makeup_credits").filter(
    (x) =>
      x.status === "available" && new Date(String(x.expires_at)) > new Date(),
  );
  const invoices = r("commercial_invoices");
  const balances = invoices
    .map((x) => ({
      id: x.id,
      amount: invoiceBalance(
        val(x, "id"),
        r("commercial_invoice_lines"),
        r("commercial_allocations"),
        r("commercial_adjustments"),
      ),
    }))
    .filter((x) => x.amount > 0);
  const cards = [
    ...(unread.length
      ? [
          {
            title: "Unread updates",
            count: unread.length,
            view: "Notifications",
            icon: MessageSquare,
          },
        ]
      : []),
    ...(credits.length && parent
      ? [
          {
            title: "Makeup credits",
            count: credits.length,
            view: "Makeups",
            icon: CalendarCheck,
          },
        ]
      : []),
    ...(reviews.length && staff
      ? [
          {
            title: "Assessments awaiting review",
            count: reviews.length,
            view: "Progress",
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(tickets.length
      ? [
          {
            title: "Open support conversations",
            count: tickets.length,
            view: "Support",
            icon: MessageSquare,
          },
        ]
      : []),
    ...(balances.length
      ? [
          {
            title: "Invoices with a balance",
            count: balances.length,
            view: "Finance",
            icon: Wallet,
          },
        ]
      : []),
  ];
  return (
    <section
      className="product-home"
      aria-label={t("Connected family actions")}
    >
      {parent && (
        <div className="product-next-session">
          <div>
            <span className="portal-eyebrow">{t("Next session")}</span>
            <h2>{next ? val(next, "name") : t("No upcoming session")}</h2>
            {next ? (
              <>
                <p>
                  <CalendarCheck size={18} />
                  {new Intl.DateTimeFormat(
                    locale === "ar" ? "ar-AE" : "en-GB",
                    {
                      timeZone: "Asia/Dubai",
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  ).format(new Date(val(next, "starts_at")))}{" "}
                  · {t("UAE time")}
                </p>
                <p>
                  {val(next, "venue_name")} · {val(next, "coach_name")}
                </p>
              </>
            ) : (
              <p>
                {t("New availability appears here after a confirmed booking.")}
              </p>
            )}
            <button
              className="portal-link"
              onClick={() => navigate("Schedule")}
            >
              {t("View schedule")}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <svg viewBox="0 0 240 130" aria-hidden="true">
            <rect x="30" y="20" width="180" height="90" rx="3" />
            <path d="M120 20v90M30 65h180M45 35h150v60H45z" />
            <circle cx="120" cy="65" r="24" />
          </svg>
        </div>
      )}
      {parent && latest && (
        <button
          className="product-feedback"
          onClick={() => navigate("Progress")}
        >
          <span>
            <small>{t("Latest published feedback")}</small>
            <strong>
              {val(latest, "parent_feedback") || t("Read progress")}
            </strong>
          </span>
          <ArrowUpRight size={18} />
        </button>
      )}
      {cards.length > 0 && (
        <div className="product-action-rail">
          {cards.map((c) => (
            <button key={c.title} onClick={() => navigate(c.view)}>
              <c.icon size={20} />
              <span>
                <strong>{c.count}</strong>
                {t(c.title)}
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
      )}
      {parent && r("commercial_memberships").length > 0 && (
        <div className="product-membership-strip">
          {r("commercial_memberships").map((m) => {
            const b = entitlementBalance(val(m, "id"), r("entitlement_ledger"));
            const kid = r("children").find((x) => x.id === m.child_id);
            return (
              <button
                key={val(m, "id")}
                onClick={() => navigate("Memberships")}
              >
                <div>
                  <small>{val(kid, "name")}</small>
                  <strong>
                    {t(val(m, "sport"))} · {t(val(m, "status"))}
                  </strong>
                  <span>
                    {t("Valid until")} {val(m, "expires_on")}
                  </span>
                </div>
                <span>
                  <strong>{b.available}</strong>
                  {t("sessions available")}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {staff && balances.length > 0 && (
        <p className="product-summary">
          {t("Outstanding in loaded records")}:{" "}
          <button
            className="ops-text-button"
            onClick={() => navigate("Finance")}
          >
            {money(
              balances.reduce((n, x) => n + x.amount, 0),
              locale,
            )}
          </button>
        </p>
      )}
    </section>
  );
}
