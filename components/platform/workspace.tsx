"use client";
import { StudentCheckIn } from "./student-check-in";
import { BranchManagement, BranchRegistration } from "./branch-management";
import { PackageManagement } from "./package-management";
import { CoachManagement } from "./coach-management";
import { BranchFinance } from "./branch-finance";
import { AutomationPolicies } from "./automation-policies";
import { CoachMessages } from "./coach-messages";
import { RegistrationLink } from "./registration-link";
import { administratorVerified } from "@/lib/platform/contracts";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Native navigation preserves the existing Vinext Worker routing workaround. */
import { useCallback, useEffect, useState, useRef } from "react";
import {
  LocaleProvider,
  useLocale,
  type Locale,
} from "@/components/kafou/locale";
import { api, familyService, staffService } from "@/lib/platform/client";
import type { AccountContext } from "@/lib/platform/contracts";
import { Operations, NewLead } from "./operations";
import { SecurityPanel } from "./security";
import { JobsStatus } from "./jobs-status";
import { PortalShell } from "./portal-shell";
import { PortalDashboard, LeadPipeline } from "./portal-dashboard";
import {
  PortalDrawer,
  Skeleton,
  StatusBadge,
  Avatar,
  announceSaved,
} from "./portal-ui";
import { childJourney } from "@/lib/platform/product-model";
import { ParentMemberships } from "./parent-memberships";
import { ParentFamily } from "./parent-family";
import { CommercialPanel } from "./commercial-panel";
import { DevelopmentPanel, DevelopmentSafetyPanel } from "./development-panel";
import { OperationalDirectory } from "./operational-directory";
import { CommunityPanel } from "./community-panel";
import { useUnsavedForms } from "./use-unsaved-forms";
import { EventsPanel } from "./events-panel";
import { AcademyPanel } from "./academy-panel";
import { ProductHome } from "./product-home";

import {
  DailyAccounts,
  DailyAccountsHome,
  DailyToday,
  StaffClock,
} from "./daily-workspace";
import { StudentWorkspace } from "./student-workspace";
import { ParentSectionHub } from "./parent-section-hub";
import { CommunicationsPanel } from "./communications-panel";
import { FilesPanel } from "./files-panel";
import { ProductAccess } from "./product-access";
import { ReportsPanel } from "./reports-panel";
import { EngagementPanel } from "./engagement-panel";
import {
  hydrateSearchRecord,
  type SearchKind,
  type SearchHydration,
} from "@/lib/platform/search";
import {
  mergeWorkspaceRecords,
  recordContext,
  recordAccessLost,
  clearRecordUrl,
} from "@/lib/platform/search-context";
type Row = Record<string, unknown>;
type Data = Record<string, Row[]>;
const text = (r: Row, k: string) => String(r[k] ?? "");
const sports = ["swimming", "football", "karate", "badminton"];
const labels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  parent: "Parent",
  sales: "Sales",
  branch: "Branch",
  coach: "Coach",
  swimming: "Swimming",
  football: "Football",
  karate: "Karate",
  badminton: "Badminton",
  new: "New",
  contacted: "Contacted",
  trial_booked: "Trial Booked",
  trial_attended: "Trial Attended",
  converted: "Converted",
  lost: "Lost",
};
type FormField = {
  key: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
};
function Editor({
  title,
  fields,
  action,
  extra = {},
  saved,
  submitLabel = "Save",
  endpoint,
}: {
  title: string;
  fields: FormField[];
  action: string;
  extra?: Row;
  saved: () => void;
  submitLabel?: string;
  endpoint?: string;
}) {
  const { t } = useLocale();
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="ops-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        const entries = Object.fromEntries(new FormData(form));
        if (typeof entries.follow_up_at === "string" && entries.follow_up_at)
          entries.follow_up_at = new Date(entries.follow_up_at).toISOString();
        setBusy(true);
        setNotice("");
        const result = endpoint
          ? await api(endpoint, { ...extra, ...entries })
          : await familyService.command(action, { ...extra, ...entries });
        setBusy(false);
        if (result.ok) {
          setNotice("Saved.");
          announceSaved(form);
          saved();
        } else setNotice(result.message);
      }}
    >
      <h3>{t(title)}</h3>
      <div className="ops-form-grid">
        {fields.map((f) => (
          <label key={f.key}>
            {t(f.label)}
            {f.options ? (
              <select
                name={f.key}
                defaultValue={f.value || ""}
                required={f.required}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.key}
                type={f.type || "text"}
                defaultValue={f.value || ""}
                required={f.required}
                maxLength={f.type === "date" ? undefined : 2000}
              />
            )}
          </label>
        ))}
      </div>
      <div className="ops-form-actions">
        <button className="button button-dark" disabled={busy}>
          {t(busy ? "Saving…" : submitLabel)}
        </button>
        {notice && <p role="status">{t(notice)}</p>}
      </div>
    </form>
  );
}
export function Workspace({
  locale,
  account,
  workspace,
}: {
  locale: Locale;
  account: AccountContext;
  workspace: string;
}) {
  return (
    <LocaleProvider locale={locale}>
      <WorkspaceContent account={account} workspace={workspace} />
    </LocaleProvider>
  );
}
function WorkspaceContent({
  account,
  workspace,
}: {
  account: AccountContext;
  workspace: string;
}) {
  const { t } = useLocale();
  const { hasChanges, allowLeave } = useUnsavedForms(
    t("Leave this page and discard unsaved changes?"),
  );
  const pageUrl = useRef("");
  const recordRef = useRef<ReturnType<typeof recordContext>>(null);
  const requestEpoch = useRef(0);
  const [recordPages, setRecordPages] = useState<SearchHydration["pagination"]>(
    {},
  );
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [selectedChild, setSelectedChild] = useState("");
  const [familyPanel, setFamilyPanel] = useState(false);
  const [focusRecord, setFocusRecord] = useState("");
  const [creatingLead, setCreatingLead] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rawData, setData] = useState<Data>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [section, setSection] = useState("Overview"),
    [selectedFamily, setSelectedFamily] = useState(""),
    [selectedLead, setSelectedLead] = useState("");
  const branchAware = [
    "Overview",
    "Enquiries",
    "Trials",
    "Classes / Sessions",
    "Branches",
    "Finance",
    "Packages",
    "Memberships",
    "Progress",
    "Reports",
    "Business Reports",
    "Certificates",
    "Schedule",
    "Attendance",
    "Makeups",
    "Handover",
    "Recognition",
    "Compensation",
  ].includes(section);
  const sourceData =
    workspace === "parent" && rawData.family_schedule
      ? { ...rawData, class_sessions: rawData.family_schedule }
      : rawData;
  const branchData = branchFilter
    ? { ...sourceData, display_branch_id: [{ id: branchFilter }] }
    : sourceData;
  const data =
    workspace === "parent" &&
    [
      "Overview",
      "Schedule",
      "Progress",
      "Makeups",
      "Reports",
      "Certificates",
    ].includes(section)
      ? childJourney(branchData, selectedChild)
      : branchData;
  const needsMfa =
    account.roles.includes("super_admin") && !administratorVerified(account);
  const head = workspace === "admin",
    parent = workspace === "parent",
    coach = workspace === "coach";
  const baseTabs = needsMfa
    ? ["Security"]
    : workspace === "accounts"
      ? [
          "Overview",
          "Finance",
          "Expenses",
          "Staff pay",
          "Business Reports",
          "Security",
        ]
      : workspace === "account"
        ? ["Overview", "Security"]
        : coach
          ? [
              "Overview",
              "Assigned sessions",
              "Students",
              "Coach messages",
              "Events",
              "Coaching",
              "Business Reports",
              "Progress",
              "Reports",
              "Recognition",
              "Engagement",
              "Notifications",
              "Security",
            ]
          : head
            ? [
                "Overview",
                "Enquiries",
                "Families",
                "Students",
                "Trials",
                "Sports / Levels",
                "Classes / Sessions",
                "Branches",
                "Coaches",
                ...(account.roles.includes("super_admin") ? ["Team"] : []),
                "Events",
                "Schedule",
                "Attendance",
                "Makeups",
                "Packages",
                "Memberships",
                "Finance",
                "Compensation",
                "Criteria",
                "Progress",
                "Reports",
                "Business Reports",
                "Certificates",
                "Recognition",
                "Engagement",
                "Support",
                "Coach messages",
                "Handover",
                "Documents",
                "Communications",
                "Notifications",
                "Audit",
                "Security",
              ]
            : parent
              ? [
                  "Overview",
                  "Schedule",
                  "Events",
                  "Progress",
                  "Family",
                  "Enquiries",
                  "Trials",
                  "Memberships",
                  "Finance",
                  "Makeups",
                  "Reports",
                  "Certificates",
                  "Recognition",
                  "Engagement",
                  "Support",
                  "Coach messages",
                  "Family access",
                  "Documents",
                  "Notifications",
                  "Security",
                ]
              : workspace === "sales"
                ? [
                    "Overview",
                    "Enquiries",
                    "Trials",
                    "Business Reports",
                    "Security",
                  ]
                : [
                    "Overview",
                    "Branches",
                    "Coaches",
                    "Packages",
                    "Enquiries",
                    "Trials",
                    "Classes / Sessions",
                    "Families",
                    "Students",
                    "Business Reports",
                    "Events",
                    "Schedule",
                    "Attendance",
                    "Makeups",
                    "Memberships",
                    "Finance",
                    "Support",
                    "Coach messages",
                    "Handover",
                    "Recognition",
                    "Engagement",
                    "Notifications",
                    "Security",
                  ];
  const dailyStaff = !parent && workspace !== "account" && !needsMfa;
  const payrollAccess =
    account.roles.includes("super_admin") ||
    (rawData.product_permissions || []).some(
      (p) =>
        p.user_id === account.userId &&
        !p.branch_id &&
        ["accounts.payroll", "accounts.timekeeping"].includes(
          String(p.permission),
        ),
    );
  const tabs = [
    ...new Set([
      ...baseTabs,
      ...(dailyStaff ? ["My work", "Staff attendance"] : []),
      ...(dailyStaff && ["admin", "branch", "coach"].includes(workspace)
        ? ["Student check-in", "Attendance"]
        : []),
      ...(dailyStaff && ["admin", "branch"].includes(workspace)
        ? ["Expenses"]
        : []),
      ...(dailyStaff && payrollAccess ? ["Staff pay"] : []),
    ]),
  ];
  const active = needsMfa
    ? "Security"
    : tabs.includes(section)
      ? section
      : "Overview";
  const setDestination = useCallback((target: string, record: string) => {
    setSection(target);
    setFamilyPanel(false);
    setFocusRecord(record);
    setSelectedLead(target === "Enquiries" && record !== "new" ? record : "");
    setCreatingLead(target === "Enquiries" && record === "new");
    setSelectedFamily(
      target === "Family" || target === "Families" ? record : "",
    );
  }, []);
  const navigate = (tab: string, record = "", searchKind?: SearchKind) => {
    const target = tab === "Families" && parent ? "Family" : tab;
    if (!tabs.includes(target) || !allowLeave()) return;
    if (head && branchFilter && ["Team", "Branches"].includes(target)) {
      openBranch("", target);
      return;
    }
    setError("");
    setLoading(true);
    setLoadingRecord(Boolean(searchKind));
    setRecordPages({});
    recordRef.current = searchKind
      ? { kind: searchKind, id: record, offset: 0 }
      : null;
    setDestination(target, record);
    const url = new URL(window.location.href);
    url.searchParams.set("view", target);
    if (searchKind) {
      url.searchParams.set("record", record);
      url.searchParams.set("recordKind", searchKind);
    } else {
      url.searchParams.delete("record");
      url.searchParams.delete("recordKind");
    }
    window.history.pushState({}, "", url);
    pageUrl.current = url.href;
    void load();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(".portal-main h1, .ops-main h1")
        ?.focus(),
    );
  };
  const load = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    const requested = recordRef.current;
    const selectedBranch =
      new URL(window.location.href).searchParams.get("branch") || "";
    const suffix = selectedBranch
      ? "?branch=" + encodeURIComponent(selectedBranch)
      : "";
    const [base, product] = await Promise.all([
      api<Data>("workspace" + suffix),
      needsMfa
        ? Promise.resolve({ ok: true as const, data: {} })
        : api<Data>("product" + suffix),
    ]);
    if (epoch !== requestEpoch.current) return;
    if (base.ok && product.ok) {
      const fresh = base.data.account as unknown as AccountContext | undefined;
      if (
        fresh &&
        (JSON.stringify([...fresh.roles].sort()) !==
          JSON.stringify([...account.roles].sort()) ||
          JSON.stringify([...fresh.branchIds].sort()) !==
            JSON.stringify([...account.branchIds].sort()))
      ) {
        setData({});
        window.location.assign("/account");
        return;
      }
      let next = { ...base.data, ...product.data };
      let failure = "";
      let pages: SearchHydration["pagination"] = {};
      if (requested && !needsMfa) {
        // Reauthorize every previously loaded detail page; stale detail rows are never retained.
        const details = await Promise.all(
          Array.from({ length: requested.offset / 100 + 1 }, (_, i) =>
            hydrateSearchRecord({ ...requested, offset: i * 100 }),
          ),
        );
        if (epoch !== requestEpoch.current) return;
        const denied = details.find((r) => !r.ok);
        if (denied && !denied.ok) {
          failure = denied.message;
          if (recordAccessLost(denied.code)) {
            recordRef.current = null;
            setSelectedFamily("");
            setSelectedLead("");
            setFocusRecord("");
            const url = clearRecordUrl(window.location.href);
            window.history.replaceState({}, "", url);
            pageUrl.current = url.href;
          }
        } else
          for (const detail of details)
            if (detail.ok) {
              next = mergeWorkspaceRecords(next, detail.data.data);
              pages = detail.data.pagination;
            }
      }
      setData(next);
      setRecordPages(pages);
      setError(failure);
    } else {
      const failure = !base.ok ? base : !product.ok ? product : null;
      setError(failure?.message || "");
      if (failure && ["unauthenticated", "forbidden"].includes(failure.code)) {
        setData({});
        setRecordPages({});
        recordRef.current = null;
      }
      if (failure?.code === "unauthenticated") window.location.href = "/auth";
    }
    setLoading(false);
    setLoadingRecord(false);
    return base.ok && product.ok;
  }, [needsMfa, account]);
  useEffect(() => {
    const sync = () => {
      if (pageUrl.current && !allowLeave()) {
        window.history.pushState({}, "", pageUrl.current);
        return;
      }
      pageUrl.current = window.location.href;
      const params = new URL(window.location.href).searchParams;
      recordRef.current = recordContext(params);
      setDestination(
        params.get("view") || "Overview",
        recordRef.current?.id || "",
      );
      let selectedBranch = params.get("branch") || "";
      if (
        workspace === "branch" &&
        !selectedBranch &&
        account.branchIds.length === 1
      ) {
        selectedBranch = account.branchIds[0];
        const url = new URL(window.location.href);
        url.searchParams.set("branch", selectedBranch);
        window.history.replaceState({}, "", url);
        pageUrl.current = url.href;
      }
      setBranchFilter(selectedBranch);
      setSelectedChild(params.get("child") || "");
      setRecordPages({});
      if (recordRef.current) setLoadingRecord(true);
      void load();
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [allowLeave, load, setDestination, workspace, account.branchIds]);
  useEffect(() => {
    let stopped = false,
      running = false,
      revision = "",
      authority = "";
    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      const r = await api<{
        revision: string;
        authority: string;
        account: AccountContext;
      }>(`portal/revision${branchFilter ? "?branch=" + branchFilter : ""}`);
      running = false;
      if (stopped) return;
      if (!r.ok) {
        if (["forbidden", "unauthenticated"].includes(r.code)) {
          setData({});
          setRecordPages({});
          setError(r.message);
          if (r.code === "unauthenticated") window.location.assign("/auth");
        }
        return;
      }
      if (
        (authority && authority !== r.data.authority) ||
        JSON.stringify([...r.data.account.roles].sort()) !==
          JSON.stringify([...account.roles].sort()) ||
        JSON.stringify([...r.data.account.branchIds].sort()) !==
          JSON.stringify([...account.branchIds].sort())
      ) {
        setData({});
        setRecordPages({});
        window.location.assign("/account");
        return;
      }
      authority = r.data.authority;
      if (revision && revision !== r.data.revision) {
        if (hasChanges() || document.querySelector("[aria-busy=true]")) return;
        if (await load()) revision = r.data.revision;
      } else revision = r.data.revision;
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1200);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("kafou:saved", focus);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("kafou:saved", focus);
    };
  }, [load, hasChanges, branchFilter, account.roles, account.branchIds]);
  const more = async () => {
    setLoadingMore(true);
    const offset = Number(data.pagination?.[0]?.offset || 0) + 200;
    const productOffset =
      Number(data.product_pagination?.[0]?.offset || 0) + 200;
    const [base, product] = await Promise.all([
      api<Data>(
        `workspace?offset=${offset}${branchFilter ? "&branch=" + branchFilter : ""}`,
      ),
      api<Data>(
        `product?offset=${productOffset}${branchFilter ? "&branch=" + branchFilter : ""}`,
      ),
    ]);
    const r =
      base.ok && product.ok
        ? { ok: true as const, data: { ...base.data, ...product.data } }
        : !base.ok
          ? base
          : !product.ok
            ? product
            : base;
    if (r.ok) setData((current) => mergeWorkspaceRecords(current, r.data));
    else setError(r.message);
    setLoadingMore(false);
  };
  const rows = (table: string) => data[table] || [];
  const family = rows("families").find(
    (f) => f.id === (selectedFamily || rows("families")[0]?.id),
  );
  const lead = rows("leads").find((l) => l.id === selectedLead);
  const branchOptions = [
    { value: "", label: "Unassigned" },
    ...rows("branches").map((b) => ({
      value: text(b, "id"),
      label: text(b, "name"),
    })),
  ];
  const openBranch = (id: string, target = "Overview") => {
    if (!allowLeave()) return;
    ++requestEpoch.current;
    recordRef.current = null;
    setRecordPages({});
    setData({});
    setLoading(true);
    setBranchFilter(id);
    setDestination(target, "");
    const url = clearRecordUrl(window.location.href);
    url.searchParams.set("view", target);
    if (id) url.searchParams.set("branch", id);
    else url.searchParams.delete("branch");
    window.history.pushState({}, "", url);
    pageUrl.current = url.href;
    void load();
  };
  const perform = async (action: string, payload: Row) => {
    const r = await familyService.command(action, payload);
    if (r.ok) {
      announceSaved();
      void load();
    } else setError(r.message);
  };
  return (
    <PortalShell
      account={account}
      workspace={workspace}
      tabs={tabs}
      active={active}
      navigate={navigate}
      data={data}
      branch={branchFilter}
      searchChild={parent ? selectedChild || undefined : undefined}
      allowBranch={workspace === "accounts"}
      exitBranch={
        head && branchFilter ? () => openBranch("", "Branches") : undefined
      }
      setBranch={(id) => {
        if (!allowLeave()) return;
        ++requestEpoch.current;
        recordRef.current = null;
        setRecordPages({});
        setLoadingRecord(false);
        setBranchFilter(id);
        setSelectedFamily("");
        setSelectedLead("");
        setFocusRecord("");
        const url = clearRecordUrl(window.location.href);
        if (id) url.searchParams.set("branch", id);
        else url.searchParams.delete("branch");
        window.history.replaceState({}, "", url);
        pageUrl.current = url.href;
        void load();
      }}
      loading={loading || loadingRecord}
      refresh={load}
      logout={async () => {
        if (!allowLeave()) return;
        const result = await api("auth/logout", {});
        if (result.ok) window.location.href = "/auth";
        else setError(result.message);
      }}
    >
      {!(
        active === "Overview" &&
        ["admin", "branch", "coach"].includes(workspace)
      ) &&
        ![
          "Business Reports",
          "Finance",
          "Packages",
          "Expenses",
          "Staff pay",
          "My work",
          "Staff attendance",
          "Student check-in",
        ].includes(active) &&
        !(parent && ["Family", "Memberships"].includes(active)) &&
        Boolean(
          data.pagination?.[0]?.more || data.product_pagination?.[0]?.more,
        ) && (
          <div className="portal-data-scope">
            <span>
              {t(
                active === "Overview"
                  ? "Queues reflect loaded records. Collections totals are complete."
                  : "Counts reflect loaded records. Load more for a fuller view.",
              )}
            </span>
            <button
              className="ops-text-button"
              disabled={loadingMore}
              onClick={more}
            >
              {t(loadingMore ? "Loading…" : "Load more records")}
            </button>
          </div>
        )}
      {loadingRecord && <p role="status">{t("Loading selected record…")}</p>}
      {Object.values(recordPages).some((page) => page.next_offset !== null) && (
        <div className="portal-data-scope">
          <span>
            {t("More related records are available for this selection.")}
          </span>
          <button
            className="ops-text-button"
            disabled={loadingRecord}
            onClick={async () => {
              if (!recordRef.current || !allowLeave()) return;
              recordRef.current = {
                ...recordRef.current,
                offset: recordRef.current.offset + 100,
              };
              setLoadingRecord(true);
              await load();
            }}
          >
            {t("Load more related records")}
          </button>
        </div>
      )}
      {error && (
        <p className="ops-notice" role="alert">
          {t(error)}{" "}
          {Object.keys(rawData).length > 0 &&
            t("Showing the last loaded records. Refresh before taking action.")}
        </p>
      )}
      {active === "Security" ? (
        <>
          <SecurityPanel required={needsMfa} />
          {account.roles.includes("super_admin") && !needsMfa && (
            <>
              <JobsStatus />
              <AutomationPolicies
                data={data}
                account={account}
                refresh={async () => {
                  await load();
                }}
              />
            </>
          )}
        </>
      ) : loading ? (
        <Skeleton />
      ) : error && Object.keys(rawData).length === 0 ? (
        <section className="portal-panel">
          <h2>{t("This page couldn’t load")}</h2>
          <p>
            {t(
              "No records have been loaded. Retry to see the current workspace.",
            )}
          </p>
          <button className="portal-primary" onClick={() => void load()}>
            {t("Retry")}
          </button>
        </section>
      ) : (
        <>
          {parent && active !== "Overview" && (
            <ParentSectionHub active={active} navigate={navigate} />
          )}
          {parent && (rawData.children || []).length > 0 && (
            <div className="product-child-selector">
              <label>
                {t("Choose child")}
                <select
                  value={selectedChild}
                  aria-label={t("Choose child")}
                  onChange={(e) => {
                    if (!allowLeave()) return;
                    setSelectedChild(e.target.value);
                    const url = new URL(window.location.href);
                    if (e.target.value)
                      url.searchParams.set("child", e.target.value);
                    else url.searchParams.delete("child");
                    window.history.replaceState({}, "", url);
                    pageUrl.current = url.href;
                  }}
                >
                  <option value="">{t("All children")}</option>
                  {rawData.children.map((c) => (
                    <option key={text(c, "id")} value={text(c, "id")}>
                      {text(c, "name")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {active === "Events" && (
            <EventsPanel
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {active === "Documents" && (
            <FilesPanel
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {active === "Communications" && (
            <CommunicationsPanel
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {active === "Team" && (
            <details className="management-disclosure">
              <summary>{t("Advanced permissions")}</summary>
              <ProductAccess
                account={account}
                data={data}
                section={active}
                refresh={load}
              />
            </details>
          )}
          {active === "Coach messages" && (
            <CoachMessages
              data={data}
              account={account}
              refresh={async () => {
                await load();
              }}
            />
          )}
          {active === "Business Reports" && (
            <ReportsPanel
              data={data}
              workspace={workspace}
              account={account}
              branch={branchFilter}
            />
          )}
          {active === "Engagement" && (
            <EngagementPanel
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {active === "Finance" && !parent && (
            <BranchFinance
              data={data}
              account={account}
              branch={branchFilter}
              refresh={load}
              openBranch={(id) => openBranch(id, "Finance")}
              moreRecords={more}
              loadingMore={loadingMore}
            />
          )}
          {active === "Packages" && !parent && (
            <PackageManagement
              data={data}
              branch={branchFilter}
              configure={head}
              refresh={load}
            />
          )}
          {active === "Coaches" && (
            <CoachManagement
              data={data}
              account={account}
              branch={branchFilter}
              refresh={load}
              navigate={navigate}
            />
          )}
          {parent && active === "Memberships" && (
            <ParentMemberships
              workspaceData={data}
              key={selectedChild}
              child={selectedChild}
              refresh={load}
            />
          )}
          {((["Memberships", "Compensation"].includes(active) &&
            !(parent && active === "Memberships")) ||
            (parent && ["Finance", "Packages"].includes(active))) && (
            <CommercialPanel
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {[
            "Progress",
            "Coaching",
            "Criteria",
            "Reports",
            "Certificates",
          ].includes(active) && (
            <DevelopmentPanel
              account={account}
              familyContext={parent}
              data={data}
              section={active.toLowerCase()}
              refresh={load}
            />
          )}
          {[
            "Notifications",
            "Support",
            "Coach messages",
            "Family access",
            "Handover",
            "Documents",
            "Recognition",
          ].includes(active) && (
            <CommunityPanel
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {["Schedule", "Attendance", "Makeups", "Assigned sessions"].includes(
            active,
          ) && (
            <AcademyPanel
              key={`${active}:${focusRecord}`}
              focusRecord={focusRecord}
              account={account}
              data={data}
              section={active}
              refresh={load}
            />
          )}
          {active === "Overview" && parent && (
            <ProductHome
              data={data}
              workspace={workspace}
              navigate={navigate}
            />
          )}
          {active === "Students" && (
            <StudentWorkspace
              data={data}
              workspace={workspace}
              account={account}
              navigate={navigate}
            />
          )}
          {workspace !== "account" &&
            ["Trials", "Classes / Sessions", "Sports / Levels"].includes(
              active,
            ) && (
              <Operations
                key={`${active}:${focusRecord}:${branchFilter}`}
                focusRecord={focusRecord}
                data={{
                  ...data,
                  branches: (data.branches || []).filter(
                    (b) =>
                      (!branchFilter ||
                        !branchAware ||
                        b.id === branchFilter) &&
                      (head ||
                        parent ||
                        account.branchIds.includes(String(b.id))),
                  ),
                }}
                section={active}
                workspace={workspace}
                refresh={load}
              />
            )}
          {active === "Overview" &&
            ["admin", "branch", "coach"].includes(workspace) && (
              <DailyToday
                branch={branchFilter}
                workspace={workspace}
                navigate={navigate}
              />
            )}
          {active === "Overview" && workspace === "accounts" && (
            <DailyAccountsHome branch={branchFilter} navigate={navigate} />
          )}
          {active === "Overview" && workspace === "sales" && (
            <StaffClock branch={branchFilter} />
          )}
          {active === "Student check-in" && (
            <StudentCheckIn
              key={branchFilter}
              branch={branchFilter}
              navigate={navigate}
            />
          )}
          {["Expenses", "Staff pay", "My work", "Staff attendance"].includes(
            active,
          ) && (
            <DailyAccounts
              key={`${active}:${branchFilter}`}
              branch={branchFilter}
              mode={
                active === "Staff attendance"
                  ? "timekeeping"
                  : active === "Expenses"
                    ? "expenses"
                    : active === "Staff pay"
                      ? "staff"
                      : "self"
              }
            />
          )}
          {active === "Overview" &&
            ["account", "sales"].includes(workspace) && (
              <PortalDashboard
                data={data}
                workspace={workspace}
                account={account}
                navigate={navigate}
                refresh={load}
              />
            )}
          {active === "Enquiries" &&
            (parent ? (
              <>
                <p>
                  {t(
                    "Your submitted enquiries. A reference is not a confirmed trial booking.",
                  )}
                </p>
                {!rows("trial_enquiries").length ? (
                  <Empty text="No enquiries yet." />
                ) : (
                  <div className="ops-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {["Reference", "Child", "Sport", "Status"].map(
                            (s) => (
                              <th key={s}>{t(s)}</th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {rows("trial_enquiries").map((e) => (
                          <tr key={text(e, "id")}>
                            <td>{text(e, "reference")}</td>
                            <td>{text(e, "child_name")}</td>
                            <td>{t(labels[text(e, "sport")])}</td>
                            <td>{t("Enquiry received")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <LeadPipeline
                  data={data}
                  onSelect={setSelectedLead}
                  onCreate={() => setCreatingLead(true)}
                />
                <PortalDrawer
                  open={creatingLead}
                  onClose={() => setCreatingLead(false)}
                  title={t("Start a conversation")}
                  description={t(
                    "Capture the essentials. Keep the next step clear.",
                  )}
                >
                  <NewLead
                    data={{
                      ...data,
                      branches: (data.branches || []).filter(
                        (b) =>
                          (head || account.branchIds.includes(String(b.id))) &&
                          (!branchFilter || b.id === branchFilter),
                      ),
                    }}
                    refresh={load}
                    expanded
                  />
                </PortalDrawer>
                {lead && (
                  <PortalDrawer
                    open={!!lead}
                    onClose={() => setSelectedLead("")}
                    title={text(lead, "parent_name")}
                    description={t("Lead profile and next actions")}
                  >
                    <div className="portal-next-actions">
                      <button
                        className="portal-primary"
                        onClick={() => {
                          setSelectedLead("");
                          navigate("Trials");
                        }}
                      >
                        {t("Review trial options")} ↗
                      </button>
                      <a
                        className="portal-link"
                        href={`tel:${text(lead, "mobile")}`}
                      >
                        {t("Call family")}
                      </a>
                    </div>
                    <RegistrationLink
                      key={String(lead.id)}
                      leadId={String(lead.id)}
                    />
                    <div className="portal-lead-profile">
                      <Avatar name={text(lead, "parent_name")} />
                      <div>
                        <StatusBadge status={text(lead, "stage")} />
                        <p>{t(text(lead, "source"))}</p>
                      </div>
                    </div>
                    <p dir="ltr">
                      {text(lead, "mobile")} · {text(lead, "email")}
                    </p>
                    {rows("trial_enquiries")
                      .filter((e) => e.lead_id === lead.id)
                      .map((e) => (
                        <p key={text(e, "id")}>
                          {text(e, "child_name")} · {text(e, "reported_age")}{" "}
                          {t("years")} · {t(labels[text(e, "sport")])} ·{" "}
                          {text(e, "reference")}
                        </p>
                      ))}
                    <Editor
                      key={text(lead, "id")}
                      title="Update enquiry"
                      action="lead.update"
                      extra={{ id: lead.id }}
                      saved={load}
                      fields={[
                        {
                          key: "branch_id",
                          label: "Branch",
                          value: text(lead, "branch_id"),
                          options: head
                            ? branchOptions
                            : branchOptions.filter(
                                (o) => o.value === text(lead, "branch_id"),
                              ),
                        },
                        {
                          key: "stage",
                          label: "Stage",
                          value: text(lead, "stage"),
                          options: ([
                            "trial_booked",
                            "trial_attended",
                            "converted",
                          ].includes(text(lead, "stage"))
                            ? [text(lead, "stage")]
                            : ["new", "contacted", "lost"]
                          ).map((s) => ({ value: s, label: labels[s] })),
                        },
                        {
                          key: "assigned_to",
                          label: "Assigned staff",
                          value: text(lead, "assigned_to"),
                          options: [
                            { value: "", label: "Unassigned" },
                            ...rows("staff_directory")
                              .filter((p) => p.branch_id === lead.branch_id)
                              .map((p) => ({
                                value: text(p, "id"),
                                label: text(p, "name"),
                              })),
                          ],
                        },
                        {
                          key: "follow_up_at",
                          label: "Follow-up",
                          type: "datetime-local",
                          value: text(lead, "follow_up_at")
                            ? new Date(
                                new Date(text(lead, "follow_up_at")).getTime() -
                                  new Date().getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : "",
                        },
                        {
                          key: "lost_reason",
                          label: "Lost reason",
                          value: text(lead, "lost_reason"),
                        },
                      ]}
                    />
                    <Editor
                      title="Add an interaction"
                      action="lead.note"
                      extra={{ id: lead.id }}
                      fields={[{ key: "note", label: "Note", required: true }]}
                      saved={load}
                    />
                    {(head || workspace === "branch") && !lead.family_id && (
                      <Editor
                        title="Create or link a family"
                        action="lead.convert"
                        extra={{ id: lead.id }}
                        fields={[
                          {
                            key: "family_id",
                            label: "Family",
                            options: [
                              { value: "", label: "Create a new family" },
                              ...rows("families").map((f) => ({
                                value: text(f, "id"),
                                label: text(f, "name"),
                              })),
                            ],
                          },
                        ]}
                        saved={load}
                        submitLabel="Link family and child"
                      />
                    )}
                    {Boolean(lead.family_id) && (
                      <p className="ops-notice">
                        {t(
                          "Family linked. No enrollment or sale has been created.",
                        )}
                      </p>
                    )}
                    <h3>{t("Interaction timeline")}</h3>
                    <ol className="ops-timeline">
                      {rows("lead_activities")
                        .filter((a) => a.lead_id === lead.id)
                        .map((a) => (
                          <li key={text(a, "id")}>
                            <time>
                              {new Date(text(a, "created_at")).toLocaleString()}
                            </time>
                            <p>{t(text(a, "note"))}</p>
                          </li>
                        ))}
                    </ol>
                  </PortalDrawer>
                )}
              </>
            ))}
          {active === "Families" && branchFilter && (
            <BranchRegistration
              data={data}
              branch={branchFilter}
              refresh={load}
            />
          )}
          {active === "Families" && !parent && (
            <OperationalDirectory
              title="Customer directory"
              rows={rows("families")}
              searchText={(f) =>
                [
                  f.name,
                  f.mobile,
                  f.email,
                  ...rows("children")
                    .filter((c) => c.family_id === f.id)
                    .map((c) => c.name),
                ].join(" ")
              }
              columns={[
                {
                  label: "Family",
                  render: (f) => <strong>{text(f, "name")}</strong>,
                },
                {
                  label: "Contact",
                  render: (f) => (
                    <div className="work-cell-stack">
                      <span dir="ltr">{text(f, "mobile") || "—"}</span>
                      <small>{text(f, "email")}</small>
                    </div>
                  ),
                },
                {
                  label: "Children",
                  render: (f) => (
                    <span>
                      {
                        rows("children").filter((c) => c.family_id === f.id)
                          .length
                      }{" "}
                      {t("loaded")}
                    </span>
                  ),
                },
                {
                  label: "Students",
                  render: (f) => (
                    <div className="work-cell-stack">
                      {rows("children")
                        .filter((c) => c.family_id === f.id)
                        .slice(0, 2)
                        .map((c) => (
                          <span key={text(c, "id")}>{text(c, "name")}</span>
                        ))}
                      {rows("children").filter((c) => c.family_id === f.id)
                        .length > 2 && (
                        <small>
                          +
                          {rows("children").filter((c) => c.family_id === f.id)
                            .length - 2}{" "}
                          {t("more")}
                        </small>
                      )}
                    </div>
                  ),
                },
              ]}
              onOpen={(id) => {
                setSelectedFamily(id);
                setFamilyPanel(true);
              }}
              action="Manage family"
            />
          )}
          {parent && active === "Family" && family && (
            <ParentFamily
              key={selectedChild}
              data={data}
              child={selectedChild}
              refresh={load}
            />
          )}
          {(active === "Family" || active === "Families") &&
            (!parent || !family) && (
              <FamilyPanelFrame
                parent={parent}
                open={familyPanel || !!focusRecord}
                onClose={() => {
                  setFamilyPanel(false);
                  setFocusRecord("");
                }}
                title={family ? text(family, "name") : t("Family")}
              >
                {!family ? (
                  parent ? (
                    <Editor
                      title="Create your family profile"
                      action="family.create"
                      fields={[
                        { key: "name", label: "Family name", required: true },
                        {
                          key: "mobile",
                          label: "Mobile number",
                          type: "tel",
                          required: true,
                        },
                        { key: "email", label: "Email", type: "email" },
                      ]}
                      saved={load}
                    />
                  ) : (
                    <Empty text="No families are linked to your permitted branches." />
                  )
                ) : (
                  <>
                    {parent && rows("families").length > 1 && (
                      <label className="ops-select">
                        {t("Select family")}
                        <select
                          value={text(family, "id")}
                          onChange={(e) => setSelectedFamily(e.target.value)}
                        >
                          {rows("families").map((f) => (
                            <option key={text(f, "id")} value={text(f, "id")}>
                              {text(f, "name")}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <details className="portal-disclosure">
                      <summary>
                        {t("Family contact information")}{" "}
                        <span>{text(family, "name")}</span>
                      </summary>
                      <Editor
                        key={text(family, "id")}
                        title="Family contact information"
                        action="family.update"
                        extra={{ id: family.id }}
                        fields={[
                          {
                            key: "name",
                            label: "Family name",
                            value: text(family, "name"),
                            required: true,
                          },
                          {
                            key: "mobile",
                            label: "Mobile number",
                            type: "tel",
                            value: text(family, "mobile"),
                            required: true,
                          },
                          {
                            key: "email",
                            label: "Email",
                            type: "email",
                            value: text(family, "email"),
                          },
                        ]}
                        saved={load}
                      />
                    </details>
                    <h2>{t("Children")}</h2>
                    {rows("children")
                      .filter((c) => c.family_id === family.id)
                      .map((c) => (
                        <details className="ops-child" key={text(c, "id")}>
                          <summary>
                            <strong>{text(c, "name")}</strong>
                            <span>
                              {text(c, "reported_age")
                                ? `${text(c, "reported_age")} ${t("years")}`
                                : t("Age not recorded")}{" "}
                              · {t("View profile")}
                            </span>
                          </summary>
                          <div>
                            <Editor
                              title="Child profile"
                              action="child.save"
                              extra={{ id: c.id, family_id: family.id }}
                              fields={[
                                {
                                  key: "name",
                                  label: "Child name",
                                  value: text(c, "name"),
                                  required: true,
                                },
                                {
                                  key: "reported_age",
                                  label: "Age",
                                  type: "number",
                                  value: text(c, "reported_age"),
                                  required: true,
                                },
                                {
                                  key: "dob",
                                  label: "Date of birth (optional)",
                                  type: "date",
                                  value: text(c, "dob"),
                                },
                              ]}
                              saved={load}
                            />
                            <div className="ops-sports">
                              {rows("child_sports")
                                .filter((s) => s.child_id === c.id)
                                .map((s) => (
                                  <span key={text(s, "id")}>
                                    {t(labels[text(s, "sport")])} ·{" "}
                                    {text(s, "level") ||
                                      t("Level to be assessed")}
                                  </span>
                                ))}
                            </div>
                            <Editor
                              title="Add a sport interest"
                              action="child.sport"
                              extra={{ child_id: c.id }}
                              fields={[
                                {
                                  key: "sport",
                                  label: "Sport",
                                  options: sports.map((s) => ({
                                    value: s,
                                    label: labels[s],
                                  })),
                                },
                                ...(head
                                  ? [
                                      {
                                        key: "level",
                                        label:
                                          "Reviewed starting level (optional)",
                                      },
                                    ]
                                  : []),
                              ]}
                              saved={load}
                            />
                            <a
                              className="ops-text-button"
                              href={`/trial?child=${text(c, "id")}`}
                            >
                              {t("Send a trial enquiry")}
                            </a>
                          </div>
                        </details>
                      ))}
                    <details className="portal-disclosure portal-create-disclosure">
                      <summary>{t("Add a child")}</summary>
                      <Editor
                        title="Add a child"
                        action="child.save"
                        extra={{ family_id: family.id }}
                        fields={[
                          { key: "name", label: "Child name", required: true },
                          {
                            key: "reported_age",
                            label: "Age",
                            type: "number",
                            required: true,
                          },
                          {
                            key: "dob",
                            label: "Date of birth (optional)",
                            type: "date",
                          },
                        ]}
                        saved={load}
                      />
                    </details>
                    {parent && (
                      <div className="ops-editor">
                        <h3>{t("Consent preferences")}</h3>
                        <p>
                          {t(
                            "Staging consent examples only. Approved academy policies are required before live intake.",
                          )}
                        </p>
                        {["contact", "media"].map((kind) => {
                          const latest = rows("consent_records")
                            .filter(
                              (c) =>
                                c.family_id === family.id && c.kind === kind,
                            )
                            .sort((a, b) =>
                              text(b, "created_at").localeCompare(
                                text(a, "created_at"),
                              ),
                            )[0];
                          return (
                            <div className="ops-consent" key={kind}>
                              <span>
                                {t(
                                  kind === "contact"
                                    ? "Contact updates"
                                    : "Photo and media use",
                                )}
                              </span>
                              <span>
                                {t(latest?.granted ? "Allowed" : "Not allowed")}
                              </span>
                              <button
                                onClick={() =>
                                  perform("consent.record", {
                                    family_id: family.id,
                                    kind,
                                    granted: !latest?.granted,
                                  })
                                }
                              >
                                {t(latest?.granted ? "Withdraw" : "Allow")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                {
                  <DevelopmentSafetyPanel
                    account={account}
                    data={data}
                    section={active}
                    refresh={load}
                  />
                }
              </FamilyPanelFrame>
            )}

          {parent && active === "Family" && family && (
            <details className="portal-disclosure">
              <summary>{t("Safety and consent")}</summary>
              <DevelopmentSafetyPanel
                account={account}
                data={data}
                section={active}
                refresh={load}
              />
              {["contact", "media"].map((kind) => {
                const latest = rows("consent_records")
                  .filter((c) => c.family_id === family.id && c.kind === kind)
                  .sort((a, b) =>
                    text(b, "created_at").localeCompare(text(a, "created_at")),
                  )[0];
                return (
                  <div className="ops-consent" key={kind}>
                    <span>
                      {t(
                        kind === "contact"
                          ? "Contact updates"
                          : "Photo and media use",
                      )}
                    </span>
                    <span>
                      {t(latest?.granted ? "Allowed" : "Not allowed")}
                    </span>
                    <button
                      onClick={() =>
                        perform("consent.record", {
                          family_id: family.id,
                          kind,
                          granted: !latest?.granted,
                        })
                      }
                    >
                      {t(latest?.granted ? "Withdraw" : "Allow")}
                    </button>
                  </div>
                );
              })}
            </details>
          )}

          {active === "Branches" && (
            <BranchManagement
              data={data}
              refresh={load}
              openBranch={openBranch}
              configure={head}
            />
          )}
          {active === "Team" && (
            <Team rows={rows} account={account} save={perform} reload={load} />
          )}
          {active === "Audit" && (
            <>
              <p>
                {t(
                  "Protected change history. Contact details and passwords are excluded.",
                )}
              </p>
              <div className="ops-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Time", "Action", "Record", "Reason", "Actor"].map(
                        (s) => (
                          <th key={s}>{t(s)}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows("audit_events")].reverse().map((a) => (
                      <tr key={text(a, "id")}>
                        <td>
                          {new Date(text(a, "created_at")).toLocaleString()}
                        </td>
                        <td>{text(a, "action")}</td>
                        <td>
                          {text(a, "entity")}
                          <details>
                            <summary>{t("Change details")}</summary>
                            <pre dir="ltr">
                              {JSON.stringify(
                                {
                                  before: a.previous_value,
                                  after: a.new_value,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        </td>
                        <td>{text(a, "reason") || "—"}</td>
                        <td>{text(a, "actor_id") || t("System")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </PortalShell>
  );
}
function Empty({ text }: { text: string }) {
  const { t } = useLocale();
  return (
    <div className="ops-empty">
      <p>{t(text)}</p>
    </div>
  );
}
function Team({
  rows,
  account,
  save,
  reload,
}: {
  rows: (t: string) => Row[];
  account: AccountContext;
  save: (a: string, d: Row) => void;
  reload: () => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <p>
        {t(
          "Staff accounts are invitation-only. Permission changes require administrator verification.",
        )}
      </p>
      <details className="management-disclosure">
        <summary>{t("Invite staff or coach")}</summary>
        <form
          className="ops-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const r = await staffService.invite({
              email: f.get("email"),
              role: f.get("role"),
              branch_ids: f.getAll("branches"),
            });
            setNotice(r.ok ? "Invitation sent." : r.message);
            setBusy(false);
            if (r.ok) reload();
          }}
        >
          <h3>{t("Invite staff")}</h3>
          <div className="ops-form-grid">
            <label>
              {t("Email")}
              <input name="email" type="email" required />
            </label>
            <label>
              {t("Role")}
              <select name="role">
                {["admin", "sales", "branch", "coach", "super_admin"].map(
                  (r) => (
                    <option key={r} value={r}>
                      {t(labels[r])}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <BranchChecks branches={rows("branches")} />
          <button className="button button-dark" disabled={busy}>
            {t("Send invitation")}
          </button>
          {notice && <p role="status">{t(notice)}</p>}
        </form>
      </details>
      <label>
        {t("Search users")}
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {rows("profiles")
        .filter(
          (p) =>
            p.id !== account.userId &&
            text(p, "name").toLowerCase().includes(query.toLowerCase()),
        )
        .map((p) => (
          <details className="ops-child" key={text(p, "id")}>
            <summary>
              <strong>{text(p, "name")}</strong>
              <span>
                {rows("role_assignments")
                  .filter((a) => a.user_id === p.id)
                  .map((a) => t(text(a, "role")))
                  .join(" · ")}
              </span>
              <span>
                {rows("branch_permissions")
                  .filter((a) => a.user_id === p.id)
                  .map((a) =>
                    text(
                      rows("branches").find((b) => b.id === a.branch_id) || {},
                      "name",
                    ),
                  )
                  .join(" · ")}
              </span>
              <span>{t(p.active ? "Active" : "Suspended")}</span>
            </summary>
            <form
              className="ops-editor"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save("staff.access", {
                  user_id: p.id,
                  roles: f.getAll("roles"),
                  branch_ids: f.getAll("branches"),
                  active: f.get("active") === "on",
                });
              }}
            >
              <div className="ops-checks">
                {Object.keys(labels)
                  .filter((r) =>
                    [
                      "super_admin",
                      "admin",
                      "sales",
                      "branch",
                      "coach",
                      "parent",
                    ].includes(r),
                  )
                  .map((r) => (
                    <label key={r}>
                      <input
                        name="roles"
                        type="checkbox"
                        value={r}
                        defaultChecked={rows("role_assignments").some(
                          (a) => a.user_id === p.id && a.role === r,
                        )}
                      />
                      {t(labels[r])}
                    </label>
                  ))}
              </div>
              <BranchChecks
                branches={rows("branches")}
                selected={rows("branch_permissions")
                  .filter((b) => b.user_id === p.id)
                  .map((b) => text(b, "branch_id"))}
              />
              <label className="ops-checkbox">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={Boolean(p.active)}
                />
                {t("Account active")}
              </label>
              <button className="button button-dark">{t("Save access")}</button>
            </form>
          </details>
        ))}
      <h3>{t("Invitations")}</h3>
      {rows("staff_invitations").map((i) => (
        <p key={text(i, "id")}>
          {text(i, "email")} ·{" "}
          {t(i.accepted_at ? "Accepted" : i.revoked_at ? "Revoked" : "Pending")}{" "}
          · {new Date(text(i, "expires_at")).toLocaleString()}
        </p>
      ))}
    </>
  );
}
function BranchChecks({
  branches,
  selected = [],
}: {
  branches: Row[];
  selected?: string[];
}) {
  const { t } = useLocale();
  return (
    <fieldset className="ops-checks">
      <legend>{t("Permitted branches")}</legend>
      {branches.map((b) => (
        <label key={text(b, "id")}>
          <input
            type="checkbox"
            name="branches"
            value={text(b, "id")}
            defaultChecked={selected.includes(text(b, "id"))}
          />
          {text(b, "name")}
        </label>
      ))}
    </fieldset>
  );
}

function FamilyPanelFrame({
  parent,
  open,
  onClose,
  title,
  children,
}: {
  parent: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return parent ? (
    <>{children}</>
  ) : (
    <PortalDrawer open={open} onClose={onClose} title={title}>
      {children}
    </PortalDrawer>
  );
}
