"use client";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import {
  type PortalData,
  type PortalRow,
  records,
  value,
} from "@/lib/platform/portal-model";
import { usePortalQuery } from "./use-portal-query";
import { money } from "@/lib/platform/commercial";
import { PortalDrawer } from "./portal-ui";
import { Field, ManagementForm, string } from "./management-ui";
export function PackageManagement({
  data,
  refresh,
  configure,
  branch,
}: {
  data: PortalData;
  refresh: () => void;
  configure: boolean;
  branch: string;
}) {
  const { t, locale } = useLocale();
  const [q, setQ] = useState(""),
    [edit, setEdit] = useState<PortalRow | null>(null),
    [sport, setSport] = useState("swimming");
  const [offset, setOffset] = useState(0),
    [branchQuery, setBranchQuery] = useState(""),
    [branchOffset, setBranchOffset] = useState(0),
    [changed, setChanged] = useState(false);
  const catalogue = usePortalQuery<{ items: PortalRow[]; total: number }>(
    `portal/packages?q=${encodeURIComponent(q)}&offset=${offset}${branch ? "&branch=" + branch : ""}`,
  );
  const matrix = usePortalQuery<{
    items: PortalRow[];
    total: number;
    base: PortalRow | null;
  }>(
    `portal/package-branches?sport=${sport}&offset=${branchOffset}&q=${encodeURIComponent(branchQuery)}${edit?.id ? "&id=" + edit.id : ""}`,
    !!edit && configure,
  );
  const entries = catalogue.data?.items || [];
  const open = (c: PortalRow) => {
    setEdit(c);
    setSport(value(c, "sport") || "swimming");
    setBranchQuery("");
    setBranchOffset(0);
    setChanged(false);
  };
  const base = matrix.data?.base || {};
  const branches = matrix.data?.items || [];
  const offers = branches.map((b) => b.offer).filter(Boolean) as PortalRow[];
  const saved = () => {
    setChanged(false);
    catalogue.refresh();
    matrix.refresh();
    refresh();
    setEdit(null);
  };
  const range = (
    low: unknown,
    high: unknown,
    format: (n: number) => string = String,
  ) =>
    low == null
      ? t("Not configured")
      : low === high
        ? format(Number(low))
        : `${format(Number(low))}–${format(Number(high))}`;
  return (
    <section className="management-workspace">
      <div className="management-toolbar">
        <label>
          {t("Search packages")}
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        {configure && (
          <button className="portal-primary" onClick={() => open({})}>
            {t("Create package")}
          </button>
        )}
      </div>
      <p>
        {t(
          "Branch availability controls new sales and renewals. Purchased memberships keep their agreed benefits.",
        )}
      </p>
      {catalogue.error && (
        <p role="alert">
          {t(catalogue.error)}{" "}
          <button onClick={catalogue.refresh}>{t("Retry")}</button>
        </p>
      )}
      {!catalogue.data && !catalogue.error && (
        <p role="status">{t("Loading packages…")}</p>
      )}
      <div className="management-table-wrap package-catalogue">
        <table className="management-table">
          <thead>
            <tr>
              <th>{t("Package")}</th>
              <th>{t("Branch availability")}</th>
              <th>{t("Price (AED)")}</th>
              <th>{t("Allowance")}</th>
              {configure && <th>{t("Actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((c) => (
              <tr key={value(c, "id")}>
                <td data-label={t("Package")}>
                  <strong title={value(c, "name")}>
                    {value(c, "name") || t("Package name missing")}
                  </strong>
                  <small>{t(value(c, "sport"))}</small>
                </td>
                <td data-label={t("Branch availability")}>
                  <strong>
                    {Number(c.enabled_count)} / {Number(c.assigned_count)}
                  </strong>
                  <small>{t("Enabled / assigned branches")}</small>
                </td>
                <td data-label={t("Price (AED)")}>
                  {range(c.min_price, c.max_price, (n) => money(n, locale))}
                </td>
                <td data-label={t("Allowance")}>
                  <span>
                    {range(c.min_sessions, c.max_sessions)} {t("sessions")}
                  </span>
                  <small>
                    {range(c.min_months, c.max_months)} {t("months")}
                  </small>
                </td>
                {configure && (
                  <td>
                    <button className="portal-link" onClick={() => open(c)}>
                      {t("Manage package")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {catalogue.data?.total === 0 && <p>{t("No matching packages")}</p>}
      {catalogue.data && catalogue.data.total > 20 && (
        <nav className="family-pagination" aria-label={t("Package pages")}>
          <button
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            {t("Previous")}
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 20, catalogue.data.total)} /{" "}
            {catalogue.data.total}
          </span>
          <button
            disabled={offset + 20 >= catalogue.data.total}
            onClick={() => setOffset(offset + 20)}
          >
            {t("Next")}
          </button>
        </nav>
      )}
      <PortalDrawer
        open={Boolean(edit)}
        onClose={() => {
          if (!changed || window.confirm(t("Discard unsaved changes?")))
            setEdit(null);
        }}
        title={t(edit?.id ? "Edit package" : "Create package")}
      >
        {edit && !edit.legacy && (
          <label>
            {t("Search branches")}
            <input
              type="search"
              value={branchQuery}
              disabled={changed}
              onChange={(e) => {
                setBranchQuery(e.target.value);
                setBranchOffset(0);
              }}
            />
          </label>
        )}
        {matrix.error && (
          <p role="alert">
            {t(matrix.error)}{" "}
            <button onClick={matrix.refresh}>{t("Retry")}</button>
          </p>
        )}
        {edit && !matrix.data && !matrix.error && (
          <p role="status">{t("Loading branch availability…")}</p>
        )}
        {edit && matrix.data && (
          <div
            onChange={(e) => {
              if ((e.target as HTMLInputElement).name) setChanged(true);
            }}
          >
            <fieldset disabled={!!matrix.error} className="package-edit-fields">
              <h3 className="family-full-name">
                {value(edit, "name") || t("Create package")}
              </h3>
              {edit?.legacy ? (
                <>
                  <p>
                    {t(
                      "This existing contract is preserved. Create a catalogue package to configure multiple branches.",
                    )}
                  </p>
                  {offers.map((p) => (
                    <ManagementForm
                      key={value(p, "id")}
                      title={value(p, "name")}
                      action="commercial.package.status"
                      refresh={saved}
                      build={(f) => ({
                        id: p.id,
                        active: f.get("active") === "on",
                      })}
                    >
                      <label className="management-check">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={Boolean(p.active)}
                        />
                        {t("Available for new sales and renewals")}
                      </label>
                    </ManagementForm>
                  ))}
                </>
              ) : (
                edit && (
                  <ManagementForm
                    key={value(edit, "id") || "new"}
                    title="Package configuration"
                    action="commercial.catalogue.save"
                    refresh={saved}
                    submit="Save shown branch offers"
                    build={(f) => ({
                      ...(edit.id ? { id: edit.id } : {}),
                      name: string(f, "name"),
                      name_ar: string(f, "name_ar"),
                      sport,
                      level_id: string(f, "level_id") || undefined,
                      price_minor: Math.round(Number(f.get("price")) * 100),
                      duration_months: Number(f.get("duration")),
                      session_allowance: Number(f.get("sessions")),
                      min_age: Number(f.get("min_age")),
                      max_age: Number(f.get("max_age")),
                      terms: string(f, "terms"),
                      offers: branches
                        .filter(
                          (b) => b.offer || f.get("assigned_" + b.id) === "on",
                        )
                        .map((b) => ({
                          branch_id: b.id,
                          enabled: f.get("enabled_" + b.id) === "on",
                          price_minor: string(f, "price_" + b.id)
                            ? Math.round(Number(f.get("price_" + b.id)) * 100)
                            : undefined,
                        })),
                    })}
                  >
                    <Field
                      label="Package name"
                      name="name"
                      value={value(edit, "name")}
                      required
                    />
                    <Field
                      label="Arabic package name"
                      name="name_ar"
                      value={value(edit, "name_ar")}
                    />
                    <label>
                      {t("Sport")}
                      <select
                        name="sport"
                        value={sport}
                        disabled={Boolean(edit.id)}
                        onChange={(e) => setSport(e.target.value)}
                      >
                        {["swimming", "football", "karate", "badminton"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <Field
                      label="Level (optional)"
                      name="level_id"
                      value={value(base, "level_id")}
                    >
                      <option value="">{t("All levels")}</option>
                      {records(data, "sport_levels")
                        .filter((l) => l.sport === sport)
                        .map((l) => (
                          <option key={value(l, "id")} value={value(l, "id")}>
                            {value(l, "name")}
                          </option>
                        ))}
                    </Field>
                    <div className="ops-form-grid">
                      <Field
                        label="Default price (AED)"
                        name="price"
                        type="number"
                        min={0.01}
                        value={
                          base.price_minor == null
                            ? ""
                            : Number(base.price_minor) / 100
                        }
                        required
                      />
                      <Field
                        label="Duration (months)"
                        name="duration"
                        type="number"
                        min={1}
                        max={12}
                        value={
                          base.duration_months == null
                            ? ""
                            : Number(base.duration_months)
                        }
                        required
                      />
                      <Field
                        label="Sessions"
                        name="sessions"
                        type="number"
                        min={1}
                        max={100}
                        value={
                          base.session_allowance == null
                            ? ""
                            : Number(base.session_allowance)
                        }
                        required
                      />
                      <Field
                        label="Minimum age"
                        name="min_age"
                        type="number"
                        min={1}
                        max={17}
                        value={base.min_age == null ? "" : Number(base.min_age)}
                        required
                      />
                      <Field
                        label="Maximum age"
                        name="max_age"
                        type="number"
                        min={1}
                        max={17}
                        value={base.max_age == null ? "" : Number(base.max_age)}
                        required
                      />
                    </div>
                    <Field
                      label="Package terms"
                      name="terms"
                      type="textarea"
                      value={value(base, "terms")}
                      required
                    />
                    <h4>{t("Branch availability")}</h4>
                    <p>
                      {t(
                        "Only branches shown below are saved. Other branch offers keep their existing terms.",
                      )}
                    </p>
                    {changed && (
                      <p>
                        {t(
                          "Save or close your edits before changing the branch page.",
                        )}
                      </p>
                    )}

                    {branches.map((b) => {
                      const p = offers.find((p) => p.branch_id === b.id);
                      return (
                        <div
                          className="package-branch-row"
                          key={value(b, "id")}
                        >
                          <strong>{value(b, "name")}</strong>
                          <label className="management-check">
                            <input
                              name={"assigned_" + b.id}
                              type="checkbox"
                              defaultChecked={!!p}
                              disabled={!!p}
                            />
                            {t(p ? "Assigned" : "Assign to this branch")}
                          </label>
                          <label className="management-check">
                            <input
                              name={"enabled_" + b.id}
                              type="checkbox"
                              defaultChecked={Boolean(p?.active)}
                            />
                            {t("Enabled for new sales and renewals")}
                          </label>
                          <Field
                            label="Branch price (AED)"
                            name={"price_" + b.id}
                            type="number"
                            min={0.01}
                            value={p ? Number(p.price_minor) / 100 : ""}
                          />
                        </div>
                      );
                    })}
                    {matrix.data && matrix.data.total > 20 && (
                      <nav
                        className="family-pagination"
                        aria-label={t("Branch pages")}
                      >
                        <button
                          type="button"
                          disabled={changed || !branchOffset}
                          onClick={() =>
                            setBranchOffset(Math.max(0, branchOffset - 20))
                          }
                        >
                          {t("Previous")}
                        </button>
                        <span>
                          {branchOffset + 1}–
                          {Math.min(branchOffset + 20, matrix.data.total)} /{" "}
                          {matrix.data.total}
                        </span>
                        <button
                          type="button"
                          disabled={
                            changed || branchOffset + 20 >= matrix.data.total
                          }
                          onClick={() => setBranchOffset(branchOffset + 20)}
                        >
                          {t("Next")}
                        </button>
                      </nav>
                    )}
                    <p className="ops-muted">
                      {t(
                        "Saving creates a new offer version. Existing memberships and invoices are unchanged.",
                      )}
                    </p>
                  </ManagementForm>
                )
              )}
            </fieldset>
          </div>
        )}
      </PortalDrawer>
    </section>
  );
}
