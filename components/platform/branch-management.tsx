"use client";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import {
  type PortalData,
  type PortalRow,
  records,
  value,
} from "@/lib/platform/portal-model";
import { PortalDrawer, StatusBadge } from "./portal-ui";
import { Field, ManagementForm, string } from "./management-ui";
const sports = ["swimming", "football", "karate", "badminton"];
export function BranchManagement({
  data,
  refresh,
  openBranch,
  configure = true,
}: {
  data: PortalData;
  refresh: () => void;
  openBranch: (id: string) => void;
  configure?: boolean;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState(""),
    [edit, setEdit] = useState<PortalRow | null>(null),
    [venue, setVenue] = useState<PortalRow | null>(null);
  const branches = records(data, "branches").filter((b) =>
    value(b, "name").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="management-workspace">
      <div className="management-toolbar">
        <label>
          {t("Find a branch")}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Branch name")}
          />
        </label>
        {configure && (
          <button className="portal-primary" onClick={() => setEdit({})}>
            {t("Add branch")}
          </button>
        )}
      </div>
      <p>
        {t(
          "Open a branch to manage its customers, classes, collections and team.",
        )}
      </p>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th>{t("Branch")}</th>
              <th>{t("Activities")}</th>
              <th>{t("Venues")}</th>
              <th>{t("Status")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={value(b, "id")}>
                <td>
                  <strong>{value(b, "name")}</strong>
                  <small>{value(b, "area")}</small>
                </td>
                <td>
                  {records(data, "branch_sports")
                    .filter((x) => x.branch_id === b.id)
                    .map((x) => t(value(x, "sport")))
                    .join(" · ") || "—"}
                </td>
                <td>
                  {
                    records(data, "venues").filter((v) => v.branch_id === b.id)
                      .length
                  }
                </td>
                <td>
                  <StatusBadge status={b.active ? "active" : "inactive"} />
                  {Boolean(b.provisional) && <small>{t("Provisional")}</small>}
                </td>
                <td>
                  <button
                    className="portal-primary"
                    onClick={() => openBranch(value(b, "id"))}
                  >
                    {t("Open branch")}
                  </button>
                  {configure && (
                    <button className="portal-link" onClick={() => setEdit(b)}>
                      {t("Edit")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!branches.length && <p>{t("No matching records")}</p>}
      </div>
      <PortalDrawer
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={t(edit?.id ? "Manage branch" : "Add branch")}
      >
        {edit && (
          <>
            <ManagementForm
              key={value(edit, "id") || "new"}
              title="Branch details"
              action="branch.save"
              foundation
              refresh={refresh}
              build={(f) => ({
                ...(edit.id ? { id: edit.id } : {}),
                slug: value(edit, "slug") || string(f, "slug"),
                name: string(f, "name"),
                name_ar: string(f, "name_ar"),
                area: string(f, "area"),
                active: f.get("active") === "on",
                provisional: f.get("provisional") === "on",
              })}
            >
              <Field
                label="Branch name"
                name="name"
                value={value(edit, "name")}
                required
              />
              <Field
                label="Arabic name"
                name="name_ar"
                value={value(edit, "name_ar")}
              />
              {!edit.id && <Field label="Branch code" name="slug" required />}
              <Field label="Area" name="area" value={value(edit, "area")} />
              <label className="management-check">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={edit.active !== false}
                />
                {t("Active")}
              </label>
              <label className="management-check">
                <input
                  name="provisional"
                  type="checkbox"
                  defaultChecked={edit.provisional !== false}
                />
                {t("Details pending confirmation")}
              </label>
              <p className="ops-muted">
                {t(
                  "New branches start provisional. Confirm details before offering classes.",
                )}
              </p>
            </ManagementForm>
            {edit.id && (
              <>
                <ManagementForm
                  title="Branch activities"
                  action="branch.sports"
                  foundation
                  refresh={refresh}
                  build={(f) => ({
                    branch_id: edit.id,
                    sports: f.getAll("sports"),
                  })}
                >
                  {sports.map((s) => (
                    <label className="management-check" key={s}>
                      <input
                        name="sports"
                        type="checkbox"
                        value={s}
                        defaultChecked={records(data, "branch_sports").some(
                          (x) => x.branch_id === edit.id && x.sport === s,
                        )}
                      />
                      {t(s)}
                    </label>
                  ))}
                </ManagementForm>
                <h3>{t("Venues and operating hours")}</h3>
                {records(data, "venues")
                  .filter((v) => v.branch_id === edit.id)
                  .map((v) => (
                    <div className="management-row" key={value(v, "id")}>
                      <span>
                        <strong>{value(v, "name")}</strong>
                        <small>
                          {value(v, "address")} ·{" "}
                          {value(v, "operating_information")}
                        </small>
                      </span>
                      <button
                        className="portal-link"
                        onClick={() => setVenue(v)}
                      >
                        {t("Edit venue")}
                      </button>
                    </div>
                  ))}
                <ManagementForm
                  title="Add a venue"
                  action="venue.save"
                  foundation
                  refresh={refresh}
                  build={(f) => ({
                    branch_id: edit.id,
                    name: string(f, "name"),
                    address: string(f, "address"),
                    operating_information: string(f, "hours"),
                  })}
                >
                  <Field label="Venue name" name="name" required />
                  <Field label="Address" name="address" required />
                  <Field
                    label="Facilities and operating hours"
                    name="hours"
                    type="textarea"
                  />
                </ManagementForm>
              </>
            )}
          </>
        )}
      </PortalDrawer>
      <PortalDrawer
        open={Boolean(venue)}
        onClose={() => setVenue(null)}
        title={t("Edit venue")}
        compact
      >
        {venue && (
          <ManagementForm
            key={value(venue, "id")}
            title="Venue details"
            action="commercial.venue.update"
            refresh={refresh}
            build={(f) => ({
              id: venue.id,
              name: string(f, "name"),
              address: string(f, "address"),
              operating_information: string(f, "hours"),
            })}
          >
            <Field
              label="Venue name"
              name="name"
              value={value(venue, "name")}
              required
            />
            <Field
              label="Address"
              name="address"
              value={value(venue, "address")}
              required
            />
            <Field
              label="Facilities and operating hours"
              name="hours"
              type="textarea"
              value={value(venue, "operating_information")}
            />
          </ManagementForm>
        )}
      </PortalDrawer>
    </section>
  );
}

export function BranchRegistration({
  data,
  branch,
  refresh,
}: {
  data: PortalData;
  branch: string;
  refresh: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false),
    [sport, setSport] = useState(() =>
      value(
        records(data, "branch_sports").find((s) => s.branch_id === branch) ||
          {},
        "sport",
      ),
    );
  return (
    <>
      <button className="portal-primary" onClick={() => setOpen(true)}>
        {t("Register customer")}
      </button>
      <PortalDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("Register customer")}
      >
        <ManagementForm
          title="Parent and child"
          action="commercial.customer.create"
          refresh={refresh}
          submit="Register in this branch"
          build={(f) => ({
            branch_id: branch,
            name: string(f, "name"),
            mobile: string(f, "mobile"),
            email: string(f, "email"),
            child_name: string(f, "child"),
            age: Number(f.get("age")),
            dob: string(f, "dob") || undefined,
            sport,
            level_id: string(f, "level") || undefined,
          })}
        >
          <Field label="Family name" name="name" required />
          <Field label="Mobile number" name="mobile" required />
          <Field label="Email" name="email" type="email" />
          <Field label="Child name" name="child" required />
          <Field
            label="Age"
            name="age"
            type="number"
            min={1}
            max={17}
            required
          />
          <Field label="Date of birth (optional)" name="dob" type="date" />
          <label>
            {t("Sport")}
            <select value={sport} onChange={(e) => setSport(e.target.value)}>
              {records(data, "branch_sports")
                .filter((s) => s.branch_id === branch)
                .map((s) => (
                  <option key={value(s, "sport")}>{value(s, "sport")}</option>
                ))}
            </select>
          </label>
          <Field label="Level (optional)" name="level">
            <option value="">{t("Assessment pending")}</option>
            {records(data, "sport_levels")
              .filter((l) => l.sport === sport && l.active)
              .map((l) => (
                <option value={value(l, "id")} key={value(l, "id")}>
                  {value(l, "name")}
                </option>
              ))}
          </Field>
        </ManagementForm>
      </PortalDrawer>
    </>
  );
}
