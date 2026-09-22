"use client";
import { administratorVerified } from "@/lib/platform/contracts";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { developmentSchema } from "@/lib/platform/development";
import { productCommand } from "@/lib/platform/product";
import { ProductNotice, val, type ProductProps } from "./product-shared";
import { announceSaved } from "./portal-ui";

export function DevelopmentEmergencyPanel({
  account,
  data,
  refresh,
  section,
}: ProductProps) {
  const { t, locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const attempt = useRef({ key: crypto.randomUUID(), fingerprint: "" });
  const rows = (name: string) => data[name] ?? [];
  const branches = rows("branches").filter(
    (branch) =>
      branch.active === true &&
      ((account.roles.includes("super_admin") &&
        administratorVerified(account)) ||
        (account.roles.includes("admin") &&
          rows("product_permissions").some(
            (grant) =>
              grant.user_id === account.userId &&
              grant.permission === "development.configure" &&
              (!grant.branch_id || grant.branch_id === branch.id),
          ))),
  );
  const formatTime = (value: unknown) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(new Date(String(value)));
  const contacts = rows("development_coach_emergency_contacts");
  return (
    <>
      {section === "coaching" && account.roles.includes("coach") && (
        <section className="portal-card">
          <h3>{t("Session emergency contacts")}</h3>
          <p>
            {t(
              "Use these current contacts only for the assigned session. Details are available within the academy's configured window and close when the session ends.",
            )}
          </p>
          {!contacts.length && (
            <ProductNotice>
              {t(
                "No emergency contacts are available in your current session window.",
              )}
            </ProductNotice>
          )}
          {contacts.map((contact) => {
            const session = rows("development_sessions").find(
              (item) => item.id === contact.session_id,
            );
            const students = Array.isArray(session?.students)
              ? session.students
              : [];
            const athlete = students.find(
              (student) => student.id === contact.child_id,
            );
            return (
              <article className="ops-editor" key={val(contact, "id")}>
                <h4>{athlete?.name || t("Athlete")}</h4>
                {session && (
                  <p>
                    {val(session, "name")} · {formatTime(session.starts_at)}
                  </p>
                )}
                <p>
                  {val(contact, "contact_name")} ·{" "}
                  {val(contact, "relationship")}
                </p>
                <a
                  className="portal-link"
                  dir="ltr"
                  href={"tel:" + val(contact, "mobile").replace(/[^+0-9]/g, "")}
                >
                  {val(contact, "mobile")}
                </a>
              </article>
            );
          })}
        </section>
      )}
      {section === "criteria" && branches.length > 0 && (
        <section className="portal-card">
          <h3>{t("Emergency contact visibility policy")}</h3>
          <p>
            {t(
              "Disabled until explicitly configured. A policy shares only the current emergency contact with assigned coaches for rostered children, from the configured lead time until the session ends.",
            )}
          </p>
          {branches.map((branch) => {
            const versions = rows("development_emergency_policies")
              .filter((policy) => policy.branch_id === branch.id)
              .sort((a, b) => Number(b.version) - Number(a.version));
            const current = versions[0];
            return (
              <details key={val(branch, "id")} className="ops-editor">
                <summary>
                  {locale === "ar" && branch.name_ar
                    ? val(branch, "name_ar")
                    : val(branch, "name")}{" "}
                  · {t(current?.enabled ? "Enabled" : "Disabled")}
                </summary>
                {versions.length ? (
                  <ul>
                    {versions.map((policy) => (
                      <li key={val(policy, "id")}>
                        {t("Version")} {val(policy, "version")} ·{" "}
                        {t(policy.enabled ? "Enabled" : "Disabled")} ·{" "}
                        {val(policy, "minutes_before")}{" "}
                        {t("minutes before the session")} ·{" "}
                        {formatTime(policy.created_at)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {t(
                      "No policy configured. Coach emergency contact access is disabled.",
                    )}
                  </p>
                )}
              </details>
            );
          })}
          <form
            className="ops-editor product-form"
            aria-busy={busy}
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const form = event.currentTarget;
              const fields = new FormData(form);
              const parsed = developmentSchema.safeParse({
                action: "development.emergency.policy",
                data: {
                  branch_id: fields.get("branch_id"),
                  enabled: fields.get("enabled") === "on",
                  minutes_before: Number(fields.get("minutes_before")),
                  synthetic_acknowledged:
                    fields.get("synthetic_acknowledged") === "on",
                },
              });
              if (!parsed.success) {
                setNotice(
                  t(
                    "Check the branch, time window and synthetic policy acknowledgement.",
                  ),
                );
                return;
              }
              const fingerprint = JSON.stringify(parsed.data);
              if (attempt.current.fingerprint !== fingerprint)
                attempt.current = { fingerprint, key: crypto.randomUUID() };
              setBusy(true);
              setNotice("");
              try {
                const result = await productCommand(
                  parsed.data.action,
                  parsed.data.data,
                  attempt.current.key,
                );
                setNotice(t(result.ok ? "Saved" : result.message));
                if (result.ok) {
                  attempt.current = {
                    fingerprint: "",
                    key: crypto.randomUUID(),
                  };
                  announceSaved(form);
                  refresh();
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <h4>{t("Create safety policy version")}</h4>
            <div className="ops-form-grid">
              <label>
                {t("Branch")}
                <select name="branch_id" required>
                  <option value="">{t("Choose")}</option>
                  {branches.map((branch) => (
                    <option key={val(branch, "id")} value={val(branch, "id")}>
                      {locale === "ar" && branch.name_ar
                        ? val(branch, "name_ar")
                        : val(branch, "name")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Minutes before session (0–360)")}
                <input
                  name="minutes_before"
                  type="number"
                  min={0}
                  max={360}
                  step={1}
                  defaultValue={60}
                  required
                />
              </label>
            </div>
            <label className="ops-check">
              <input name="enabled" type="checkbox" />
              {t("Allow assigned coaches to view emergency contacts")}
            </label>
            <label className="ops-check">
              <input name="synthetic_acknowledged" type="checkbox" required />
              {t(
                "I acknowledge this synthetic safety policy needs academy approval before use with real families.",
              )}
            </label>
            {notice && <ProductNotice>{notice}</ProductNotice>}
            <button className="button button-green" disabled={busy}>
              {t(busy ? "Saving…" : "Save policy version")}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
