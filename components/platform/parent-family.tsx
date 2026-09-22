"use client";
import { AttendanceReference } from "./attendance-photos";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import {
  type PortalRow,
  type PortalData,
  records,
  value,
} from "@/lib/platform/portal-model";
import { PortalDrawer, StatusBadge } from "./portal-ui";
import { ManagementForm, Field, string } from "./management-ui";
import { usePortalQuery } from "./use-portal-query";
type Page = { items: PortalRow[]; next_cursor: number | null };
export function ParentFamily({
  data,
  child,
  refresh: workspaceRefresh,
}: {
  data: PortalData;
  child: string;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const [offset, setOffset] = useState(0),
    [profile, setProfile] = useState<PortalRow | null>(null),
    [add, setAdd] = useState(false),
    [contact, setContact] = useState(false);
  const {
    data: page,
    error,
    denied,
    refresh,
  } = usePortalQuery<Page>(
    `portal/children?offset=${offset}${child ? "&child=" + child : ""}`,
  );
  const families = records(data, "families");
  const saved = () => {
    refresh();
    workspaceRefresh();
  };
  const fields = (p: PortalRow) => (
    <>
      <Field
        label="Child name"
        name="name"
        value={value(p, "title")}
        required
      />
      <Field
        label="Age"
        name="reported_age"
        type="number"
        value={p.age == null ? "" : Number(p.age)}
        min={1}
        max={17}
        required
      />
      <Field
        label="Date of birth (optional)"
        name="dob"
        type="date"
        value={value(p, "date")}
      />
    </>
  );
  return (
    <section aria-label={t("Your children")} className="family-workspace">
      <div className="family-section-header">
        <div>
          <h2>{t("Your children")}</h2>
          <p>{t("Profiles, activities and membership status in one place.")}</p>
        </div>
        <button className="portal-primary" onClick={() => setAdd(true)}>
          {t("Add a child")}
        </button>
      </div>
      {error ? (
        <p role="alert">
          {t(error)} <button onClick={refresh}>{t("Retry")}</button>
        </p>
      ) : !page ? (
        <p role="status">{t("Loading children…")}</p>
      ) : (
        <>
          {!page.items.length && (
            <p>{t("No child profiles in this selection.")}</p>
          )}
          <div className="family-children-grid">
            {page.items.map((c) => {
              const sports = (c.sports || []) as PortalRow[],
                members = (c.memberships || []) as PortalRow[];
              return (
                <article className="family-child-card" key={value(c, "id")}>
                  <div className="family-child-identity">
                    <span className="family-avatar" aria-hidden="true">
                      {value(c, "title").slice(0, 1)}
                    </span>
                    <div>
                      <h3 title={value(c, "title")}>{value(c, "title")}</h3>
                      <p>
                        {c.age == null
                          ? t("Age not recorded")
                          : `${c.age} ${t("years")}`}
                      </p>
                    </div>
                  </div>
                  <div className="family-child-activities">
                    {sports.length ? (
                      sports.map((s, i) => (
                        <p key={i}>
                          <strong>{t(value(s, "sport"))}</strong>
                          <span>
                            {locale === "ar" && s.level_ar
                              ? value(s, "level_ar")
                              : value(s, "level") || t("Level to be assessed")}
                          </span>
                        </p>
                      ))
                    ) : (
                      <p>{t("Activity not recorded")}</p>
                    )}
                  </div>
                  <div className="family-child-memberships">
                    {members.length ? (
                      members.map((m) => (
                        <span key={value(m, "id")}>
                          {t(value(m, "sport"))}{" "}
                          <StatusBadge status={value(m, "status")} />
                        </span>
                      ))
                    ) : (
                      <span>{t("No current membership")}</span>
                    )}
                  </div>
                  <footer>
                    <button
                      className="portal-link"
                      onClick={() => setProfile(c)}
                    >
                      {t("View profile")}
                    </button>
                    <a href={`/parent?view=Memberships&child=${c.id}`}>
                      {t("Membership")}
                    </a>
                  </footer>
                </article>
              );
            })}
          </div>
          {(offset > 0 || page.next_cursor !== null) && (
            <nav className="family-pagination" aria-label={t("Child pages")}>
              <button
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                {t("Previous")}
              </button>
              <button
                disabled={page.next_cursor === null}
                onClick={() => setOffset(page.next_cursor!)}
              >
                {t("Next")}
              </button>
            </nav>
          )}
        </>
      )}
      <div className="family-secondary">
        <button onClick={() => setContact(true)}>
          {t("Family contact information")}
        </button>
        <a href="/parent?view=Family%20access">{t("Family access")}</a>
        <a href="/parent?view=Documents">{t("Documents")}</a>
      </div>
      {child && (
        <details className="product-panel">
          <summary>{t("Attendance photo reference")}</summary>
          <AttendanceReference key={child} child={child} />
        </details>
      )}
      <PortalDrawer
        open={!!profile && !denied}
        onClose={() => setProfile(null)}
        title={t("Child profile")}
      >
        {profile && (
          <>
            <h3 className="family-full-name">{value(profile, "title")}</h3>
            <ManagementForm
              title="Edit child details"
              action="child.save"
              foundation
              refresh={saved}
              build={(f) => ({
                id: profile.id,
                family_id: profile.family_id,
                name: string(f, "name"),
                reported_age: Number(f.get("reported_age")),
                dob: string(f, "dob") || undefined,
              })}
            >
              {fields(profile)}
            </ManagementForm>
            <ManagementForm
              title="Add a sport interest"
              action="child.sport"
              foundation
              refresh={saved}
              build={(f) => ({
                child_id: profile.id,
                sport: string(f, "sport"),
              })}
            >
              <Field label="Sport" name="sport" required>
                <option value="">{t("Choose")}</option>
                {["swimming", "football", "karate", "badminton"].map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </Field>
            </ManagementForm>
            <details>
              <summary>{t("Record reference")}</summary>
              <code>{value(profile, "id")}</code>
            </details>
          </>
        )}
      </PortalDrawer>
      <PortalDrawer
        open={add}
        onClose={() => setAdd(false)}
        title={t("Add a child")}
      >
        {families.length ? (
          <ManagementForm
            title="Add a child"
            action="child.save"
            foundation
            refresh={saved}
            build={(f) => ({
              family_id: string(f, "family"),
              name: string(f, "name"),
              reported_age: Number(f.get("reported_age")),
              dob: string(f, "dob") || undefined,
            })}
          >
            <Field
              label="Family"
              name="family"
              value={families.length === 1 ? value(families[0], "id") : ""}
              required
            >
              <option value="">{t("Choose")}</option>
              {families.map((f) => (
                <option key={value(f, "id")} value={value(f, "id")}>
                  {value(f, "name")}
                </option>
              ))}
            </Field>
            {fields({})}
          </ManagementForm>
        ) : (
          <p>{t("Create your family profile first.")}</p>
        )}
      </PortalDrawer>
      <PortalDrawer
        open={contact}
        onClose={() => setContact(false)}
        title={t("Family contact information")}
      >
        {families.map((f) => (
          <ManagementForm
            key={value(f, "id")}
            title={value(f, "name")}
            action="family.update"
            foundation
            refresh={saved}
            build={(fd) => ({
              id: f.id,
              name: string(fd, "name"),
              mobile: string(fd, "mobile"),
              email: string(fd, "email"),
            })}
          >
            <Field
              label="Family name"
              name="name"
              value={value(f, "name")}
              required
            />
            <Field
              label="Mobile number"
              name="mobile"
              type="tel"
              value={value(f, "mobile")}
              required
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={value(f, "email")}
            />
          </ManagementForm>
        ))}
      </PortalDrawer>
    </section>
  );
}
