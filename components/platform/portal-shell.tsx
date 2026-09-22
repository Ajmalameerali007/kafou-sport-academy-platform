"use client";
import { useEffect, useState, useRef, Fragment, type ReactNode } from "react";
import {
  Search,
  ClipboardCheck,
  GraduationCap,
  Wallet,
  Award,
  MessageSquare,
  FileText,
  Repeat2,
  Bell,
  Plus,
  Menu,
  LayoutDashboard,
  Users,
  CalendarDays,
  Inbox,
  ShieldCheck,
  Building2,
  Activity,
  History,
  ArrowUpRight,
  LogOut,
  ChevronDown,
  Check,
  RefreshCw,
  X,
  ChevronRight,
} from "lucide-react";
import { LanguageSwitch, useLocale } from "@/components/kafou/locale";
import Link from "@/components/kafou/site-link";
import type { AccountContext } from "@/lib/platform/contracts";
import {
  records,
  value,
  portalSnapshot,
  type PortalData,
} from "@/lib/platform/portal-model";
import {
  workspaceSearch,
  type SearchKind,
  type SearchPage,
} from "@/lib/platform/search";
import { PortalDrawer, Avatar, EmptyState } from "./portal-ui";
import { parentArea } from "./parent-section-hub";
import {
  operationalNavigation,
  operationalLabel,
  overviewTitle,
  primaryTask,
} from "@/lib/platform/portal-ux";
export type Navigate = (
  section: string,
  record?: string,
  searchKind?: SearchKind,
) => void;
const icons: Record<string, typeof Search> = {
  Overview: LayoutDashboard,
  Enquiries: Inbox,
  Families: Users,
  Family: Users,
  Students: GraduationCap,
  Coaches: Users,
  Trials: Activity,
  "Classes / Sessions": CalendarDays,
  "Assigned sessions": CalendarDays,
  "Sports / Levels": Activity,
  Branches: Building2,
  Team: Users,
  Audit: History,
  Security: ShieldCheck,
  Schedule: CalendarDays,
  Events: CalendarDays,
  Attendance: ClipboardCheck,
  "Student check-in": ClipboardCheck,
  "Staff attendance": Users,
  Makeups: Repeat2,
  Progress: GraduationCap,
  Coaching: ClipboardCheck,
  Criteria: ClipboardCheck,
  Finance: Wallet,
  Packages: Wallet,
  Memberships: Wallet,
  Compensation: Wallet,
  Reports: FileText,
  "Business Reports": FileText,
  Certificates: Award,
  Recognition: Award,
  Engagement: Award,
  Support: MessageSquare,
  "Coach messages": MessageSquare,
  Communications: MessageSquare,
  Notifications: Bell,
  Handover: ClipboardCheck,
  Documents: FileText,
  "Family access": ShieldCheck,
};
export function roleTitle(workspace: string, account: AccountContext) {
  return workspace === "accounts"
    ? "Accounts workspace"
    : workspace === "admin"
      ? account.roles.includes("super_admin")
        ? "Owner (Super Admin)"
        : "Head Office"
      : workspace === "branch"
        ? "Branch / Reception"
        : workspace === "parent"
          ? "Family workspace"
          : workspace === "sales"
            ? "Sales workspace"
            : workspace === "coach"
              ? "Coach workspace"
              : "Your workspaces";
}
export function PortalShell({
  account,
  workspace,
  tabs,
  active,
  navigate,
  data,
  branch,
  searchChild,
  allowBranch,
  exitBranch,
  setBranch,
  loading,
  refresh,
  logout,
  children,
}: {
  account: AccountContext;
  workspace: string;
  tabs: string[];
  active: string;
  navigate: Navigate;
  data: PortalData;
  branch: string;
  searchChild?: string;
  allowBranch: boolean;
  exitBranch?: () => void;
  setBranch: (id: string) => void;
  loading: boolean;
  refresh: () => void;
  logout: () => void;
  children: ReactNode;
}) {
  const { t, locale } = useLocale();
  const [panel, setPanel] = useState(""),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState(false);
  const snap = portalSnapshot(data),
    admin = workspace === "admin",
    staff = ["admin", "sales", "branch"].includes(workspace);
  const permitted = (section: string) =>
    tabs.includes(
      section === "Families" && workspace === "parent" ? "Family" : section,
    );
  const searchEpoch = useRef(0);
  const [searchState, setSearchState] = useState<{
    key: string;
    page: SearchPage | null;
    busy: boolean;
    error: string;
    after?: string;
  }>({ key: "", page: null, busy: false, error: "" });
  const screenTitle =
    workspace === "parent" && active === "Memberships"
      ? "Membership"
      : active === "Families" && workspace !== "parent"
        ? "Customers"
        : active === "Trials" && workspace !== "parent"
          ? "Trials & admissions"
          : active === "Classes / Sessions"
            ? "Classes"
            : active === "Team"
              ? "Users"
              : workspace !== "parent"
                ? operationalLabel(active, workspace)
                : active;
  const childSection = tabs.includes("Students") ? "Students" : "Families";
  const kindSections: [SearchKind, string][] = [
    ["family", "Families"],
    ["child", childSection],
    ["lead", "Enquiries"],
    ["class", "Classes / Sessions"],
    ["trial", "Trials"],
    ["session", "Assigned sessions"],
  ];
  const kinds = kindSections
    .filter(([, section]) => permitted(section))
    .map(([kind]) => kind);
  const kindsKey = kinds.join(",");
  const searchKey = JSON.stringify([
    query.trim(),
    kindsKey,
    branch,
    searchChild,
  ]);
  const currentSearch = searchState.key === searchKey ? searchState : null;
  const results = currentSearch?.page?.items || [];
  const validQuery = query.trim().length >= 2 && kinds.length > 0;
  useEffect(() => {
    const epoch = ++searchEpoch.current;
    if (panel !== "search" || query.trim().length < 2 || !kindsKey) return;
    const timer = setTimeout(() => {
      setSearchState({ key: searchKey, page: null, busy: true, error: "" });
      void workspaceSearch({
        query,
        kinds: kindsKey.split(",") as SearchKind[],
        branch: branch || undefined,
        child: searchChild || undefined,
      }).then((result) => {
        if (searchEpoch.current !== epoch) return;
        setSearchState({
          key: searchKey,
          page: result.ok ? result.data : null,
          busy: false,
          error: result.ok ? "" : result.message,
        });
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      if (searchEpoch.current === epoch) searchEpoch.current = epoch + 1;
    };
  }, [panel, query, kindsKey, branch, searchChild, searchKey, data]);
  const nextSearchPage = async (after?: string) => {
    if (currentSearch?.busy) return;
    const epoch = ++searchEpoch.current;
    setSearchState({
      key: searchKey,
      page: null,
      busy: true,
      error: "",
      after,
    });
    const result = await workspaceSearch({
      query,
      kinds,
      branch: branch || undefined,
      child: searchChild || undefined,
      after,
    });
    if (searchEpoch.current !== epoch) return;
    // Each page replaces the prior projection. Never retain earlier snippets
    // after a fresh authorization check or append onto a revoked snapshot.
    setSearchState({
      key: searchKey,
      page: result.ok ? result.data : null,
      busy: false,
      error: result.ok ? "" : result.message,
      after,
    });
  };
  const go: Navigate = (s, id, searchKind) => {
    navigate(
      s === "Families" && workspace === "parent" ? "Family" : s,
      id,
      searchKind,
    );
    setPanel("");
    setQuery("");
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPanel((p) => (p === "search" ? "" : "search"));
      }
    };
    const saved = (event: Event) => {
      if (!(event instanceof CustomEvent && event.detail?.inlineFeedback))
        setToast(true);
    };
    const search = () => setPanel("search");
    window.addEventListener("kafou:search", search);
    window.addEventListener("keydown", key);
    window.addEventListener("kafou:saved", saved);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("kafou:search", search);
      window.removeEventListener("kafou:saved", saved);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const count =
    records(data, "notifications").filter((n) => !n.read_at).length +
    (staff ? snap.followups.length : 0) +
    (["admin", "branch"].includes(workspace)
      ? snap.pendingAttendance.length + snap.conversionReady.length
      : 0);
  const primaryTabs =
    workspace === "parent"
      ? ["Overview", "Schedule", "Progress", "Family", "Memberships", "Support"]
      : workspace === "admin" && !branch
        ? tabs.filter((tab) =>
            [
              "Overview",
              "Branches",
              "Coaches",
              "Team",
              "Packages",
              "Finance",
              "Business Reports",
              "Communications",
              "Audit",
              "Security",
            ].includes(tab),
          )
        : tabs;
  const groups = operationalNavigation(workspace, !!branch, tabs);
  const selectedGroup = groups.find((g) => g.tabs.includes(active));
  const activeDestination =
    workspace === "parent" ? parentArea(active) : active;
  const nav = (
    <nav aria-label={t("Workspace navigation")}>
      {workspace === "parent"
        ? primaryTabs.map((tab) => {
            const Icon = icons[tab] || Activity;
            return (
              <button
                key={tab}
                aria-current={activeDestination === tab ? "page" : undefined}
                onClick={() => go(tab)}
              >
                <Icon size={18} />
                <span>
                  {t(
                    tab === "Overview"
                      ? "Home"
                      : tab === "Memberships"
                        ? "Membership"
                        : tab,
                  )}
                </span>
              </button>
            );
          })
        : groups.map((group) => {
            const Icon = icons[group.tabs[0]] || Activity;
            return (
              <button
                key={group.label}
                aria-current={group.tabs.includes(active) ? "page" : undefined}
                onClick={() => go(group.tabs[0])}
              >
                <Icon size={18} />
                <span>{t(group.label)}</span>
              </button>
            );
          })}
    </nav>
  );
  const quick =
    workspace === "parent"
      ? [
          ["Family", "Manage your family"],
          ["Trials", "View trial status"],
        ]
      : workspace === "coach"
        ? [["Assigned sessions", "View schedule"]]
        : [
            ["Enquiries", "New lead"],
            ["Trials", "Book a trial"],
            ...(workspace !== "sales"
              ? [
                  ["Student check-in", "Open student check-in"],
                  ["Attendance", "Review attendance"],
                  ["Families", "Find a family"],
                  ["Makeups", "Book makeup"],
                  ["Schedule", "Manage waitlist"],
                  ["Handover", "Open shift handover"],
                ]
              : []),
          ];
  const primary =
    admin && !branch
      ? { section: "Branches", label: "Open branches", record: "" }
      : primaryTask(workspace);
  const PrimaryIcon = icons[primary.section] || Plus;
  return (
    <div className={`ops-shell portal-shell portal-${workspace}`}>
      <aside className="portal-sidebar">
        <Link className="portal-wordmark" href="/">
          KAFOU<span>SPORT ACADEMY</span>
        </Link>
        <div className="portal-workspace-label">
          <span className="portal-live-dot" />
          {branch && ["admin", "branch"].includes(workspace)
            ? value(
                records(data, "branches").find((b) => b.id === branch) || {},
                "name",
              ) || t("Branch workspace")
            : t(roleTitle(workspace, account))}
        </div>
        {nav}
        <div className="portal-sidebar-bottom">
          {(account.roles.includes("super_admin") ||
            records(data, "product_permissions").some(
              (p) =>
                p.user_id === account.userId &&
                !p.branch_id &&
                String(p.permission).startsWith("accounts."),
            )) &&
            workspace !== "accounts" && (
              <a href="/accounts">
                <LayoutDashboard size={17} />
                {t("Open Accounts")}
              </a>
            )}
          <a href="/account">
            <LayoutDashboard size={17} />
            {t("Switch workspace")}
            <ArrowUpRight size={15} />
          </a>
          <Link href="/">
            <ArrowUpRight size={17} />
            {t("Academy website")}
          </Link>
          <p>{t("Built around every child.")}</p>
        </div>
      </aside>
      <div className="portal-body">
        <header className="portal-command-bar">
          <button
            className="portal-icon-button portal-mobile-menu"
            aria-label={t("Open navigation")}
            onClick={() => setPanel("nav")}
          >
            <Menu size={21} />
          </button>
          <div className="portal-breadcrumb">
            <span>{t(roleTitle(workspace, account))}</span>
            <ChevronRight size={14} />
            <strong>{t(screenTitle)}</strong>
          </div>
          <div className="portal-command-actions">
            <button
              className="portal-search-trigger"
              aria-label={t("Search workspace")}
              onClick={() => setPanel("search")}
            >
              <Search size={18} />
              <span>{t("Search workspace")}</span>
              <kbd>⌘ K</kbd>
            </button>
            <LanguageSwitch />
            <button
              className="portal-icon-button"
              aria-label={t("Action center")}
              onClick={() => setPanel("alerts")}
            >
              <Bell size={19} />
              {count > 0 && <i className="portal-notification-dot" />}
            </button>
            <button
              className="portal-profile-button"
              aria-label={t("Profile and security")}
              onClick={() => setPanel("profile")}
            >
              <Avatar name={account.name} small />
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <div className="portal-staging">
          <span className="portal-live-dot" />
          {t("Staging workspace · synthetic academy records only")}
        </div>
        <main id="main-content" className="ops-main">
          {branch && ["admin", "branch"].includes(workspace) && (
            <div className="management-branch-context">
              <span>
                KAFOU <ChevronRight size={14} /> {t("Branches")}{" "}
                <ChevronRight size={14} />{" "}
                <strong>
                  {value(
                    records(data, "branches").find((b) => b.id === branch) ||
                      {},
                    "name",
                  )}
                </strong>
              </span>
              {exitBranch && (
                <button className="portal-link" onClick={exitBranch}>
                  {t("Back to central administration")}
                </button>
              )}
            </div>
          )}
          <div
            className={`portal-page-heading${active !== "Overview" ? " portal-working-heading" : ""}`}
          >
            <div>
              {active === "Overview" && (
                <p className="portal-date">
                  {new Intl.DateTimeFormat(
                    locale === "ar" ? "ar-AE" : "en-GB",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "Asia/Dubai",
                    },
                  ).format(new Date())}{" "}
                  <span>· {t("UAE time")}</span>
                </p>
              )}
              <h1>
                {t(
                  active === "Overview"
                    ? overviewTitle(workspace)
                    : screenTitle,
                )}
              </h1>
            </div>
            <div className="portal-heading-actions">
              {(admin || workspace === "accounts") &&
                allowBranch &&
                tabs.length > 1 && (
                  <label className="portal-branch">
                    <Building2 size={16} />
                    <span className="sr-only">{t("Filter branch")}</span>
                    <select
                      aria-label={t("Filter branch")}
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    >
                      <option value="">{t("All permitted branches")}</option>
                      {records(data, "branches").map((b) => (
                        <option key={value(b, "id")} value={value(b, "id")}>
                          {value(
                            b,
                            locale === "ar" && b.name_ar ? "name_ar" : "name",
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              <button
                className="portal-icon-button"
                disabled={loading}
                aria-label={t("Refresh")}
                onClick={refresh}
              >
                <RefreshCw
                  size={17}
                  className={loading ? "portal-spinning" : ""}
                />
              </button>
              {workspace !== "account" &&
                active === "Overview" &&
                tabs.length > 1 && (
                  <button
                    className="portal-primary"
                    onClick={() =>
                      go(primary.section, primary.record || undefined)
                    }
                  >
                    <PrimaryIcon size={18} />
                    {t(primary.label)}
                  </button>
                )}
            </div>
          </div>
          {workspace !== "parent" &&
            selectedGroup &&
            selectedGroup.tabs.length > 1 && (
              <nav
                className="daily-section-tabs"
                aria-label={t(selectedGroup.label)}
              >
                {selectedGroup.tabs.map((tab) => (
                  <button
                    type="button"
                    className={active === tab ? "is-active" : ""}
                    aria-current={active === tab ? "page" : undefined}
                    onClick={() => go(tab)}
                    key={tab}
                  >
                    {t(operationalLabel(tab, workspace))}
                  </button>
                ))}
              </nav>
            )}
          {children}
        </main>
        <footer className="ops-footer">
          <span>KAFOU · {t("Staging workspace")}</span>
          <span>{t("Secure access. Shared purpose.")}</span>
        </footer>
      </div>
      {["parent", "coach"].includes(workspace) && (
        <nav
          className="product-mobile-bar"
          aria-label={t("Primary navigation")}
        >
          {(workspace === "parent"
            ? ["Overview", "Schedule", "Progress", "Family"]
            : ["Overview", "Assigned sessions", "Students", "Coaching"]
          )
            .filter((tab) => tabs.includes(tab))
            .map((tab) => {
              const Icon = icons[tab] || Activity;
              return (
                <button
                  key={tab}
                  aria-current={activeDestination === tab ? "page" : undefined}
                  onClick={() => go(tab)}
                >
                  <Icon size={20} />
                  <span>
                    {t(
                      tab === "Overview"
                        ? "Home"
                        : tab === "Assigned sessions"
                          ? "Today"
                          : tab,
                    )}
                  </span>
                </button>
              );
            })}
          <button onClick={() => setPanel("nav")}>
            <Menu size={20} />
            <span>{t("More")}</span>
          </button>
        </nav>
      )}
      <PortalDrawer
        open={panel === "nav"}
        onClose={() => setPanel("")}
        title={t(roleTitle(workspace, account))}
      >
        <div className="portal-mobile-nav">{nav}</div>
      </PortalDrawer>
      <PortalDrawer
        open={panel === "search"}
        onClose={() => setPanel("")}
        title={t("Search workspace")}
        description={t(
          locale === "ar"
            ? "ابحث في جميع السجلات المسموح لك بعرضها."
            : "Search all records you are currently permitted to view.",
        )}
        compact
      >
        <label className="portal-command-input">
          <Search size={20} />
          <input
            data-autofocus="true"
            value={query}
            maxLength={80}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search children, families, leads or classes")}
            aria-label={t("Search records")}
          />
        </label>
        {validQuery ? (
          <>
            {currentSearch?.error ? (
              <p role="alert">{currentSearch.error}</p>
            ) : null}
            {(currentSearch?.busy || !currentSearch) && (
              <p role="status">
                {locale === "ar" ? "جارٍ البحث…" : "Searching…"}
              </p>
            )}
            {currentSearch?.page && (
              <p role="status">
                {locale === "ar" ? "النتائج المطابقة" : "Matching records"}:{" "}
                {currentSearch.page.total}
              </p>
            )}
            {results.length ? (
              <div className="portal-search-results">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() =>
                      go(
                        r.section,
                        r.record,
                        r.kind.toLowerCase() as SearchKind,
                      )
                    }
                  >
                    <Avatar name={r.title} small />
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {t(r.kind)} · {t(r.detail)}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
            ) : currentSearch?.page && !currentSearch.busy ? (
              <EmptyState
                title="No matching records"
                copy={
                  locale === "ar"
                    ? "جرّب اسماً أو مرجعاً آخر."
                    : "Try another name or reference."
                }
              />
            ) : null}
            {currentSearch?.after && (
              <button
                className="portal-btn portal-btn-secondary"
                disabled={currentSearch.busy}
                onClick={() => void nextSearchPage()}
              >
                {locale === "ar"
                  ? "العودة إلى النتائج الأولى"
                  : "Back to first results"}
              </button>
            )}
            {currentSearch?.page?.next_cursor && (
              <button
                className="portal-btn portal-btn-secondary"
                disabled={currentSearch.busy}
                onClick={() =>
                  void nextSearchPage(
                    currentSearch.page?.next_cursor || undefined,
                  )
                }
              >
                {locale === "ar"
                  ? "تحميل المزيد من النتائج"
                  : "Load more results"}
              </button>
            )}
          </>
        ) : (
          <div className="portal-search-hint">
            {locale === "ar"
              ? "اكتب حرفين على الأقل للبحث بالاسم أو الرياضة أو المرجع."
              : "Type at least two characters of a name, sport or reference."}
          </div>
        )}
      </PortalDrawer>
      <PortalDrawer
        open={panel === "alerts"}
        onClose={() => setPanel("")}
        title={t("Action center")}
        description={t("Operational reminders from your loaded records.")}
      >
        {count === 0 ? (
          <EmptyState
            title="You’re all caught up"
            copy="No pending actions in the records currently loaded."
          />
        ) : (
          <div className="portal-alert-list">
            {records(data, "notifications").filter((n) => !n.read_at).length >
              0 && (
              <button onClick={() => go("Notifications")}>
                <Bell size={20} />
                <span>
                  <strong>
                    {
                      records(data, "notifications").filter((n) => !n.read_at)
                        .length
                    }{" "}
                    {t("Unread updates")}
                  </strong>
                  <small>{t("Open notifications")}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            )}
            {staff && snap.followups.length > 0 && (
              <button onClick={() => go("Enquiries")}>
                <span className="portal-alert-icon amber">
                  <Inbox size={20} />
                </span>
                <span>
                  <strong>
                    {snap.followups.length} {t("Follow-ups due")}
                  </strong>
                  <small>
                    {t("Reconnect with families awaiting their next step.")}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            )}
            {["admin", "branch"].includes(workspace) &&
              snap.pendingAttendance.length > 0 && (
                <button
                  onClick={() =>
                    go(
                      "Classes / Sessions",
                      value(snap.pendingAttendance[0], "id"),
                    )
                  }
                >
                  <span className="portal-alert-icon blue">
                    <CalendarDays size={20} />
                  </span>
                  <span>
                    <strong>
                      {snap.pendingAttendance.length} {t("Attendance pending")}
                    </strong>
                    <small>
                      {t("Review started sessions and finalize the roster.")}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              )}
            {["admin", "branch"].includes(workspace) &&
              snap.conversionReady.length > 0 && (
                <button onClick={() => go("Trials")}>
                  <span className="portal-alert-icon green">
                    <Activity size={20} />
                  </span>
                  <span>
                    <strong>
                      {snap.conversionReady.length} {t("Ready for conversion")}
                    </strong>
                    <small>
                      {t("Help an attended trial become the next chapter.")}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              )}
          </div>
        )}
      </PortalDrawer>
      <PortalDrawer
        open={panel === "quick"}
        onClose={() => setPanel("")}
        title={t("Take the next step")}
        compact
      >
        <div className="portal-quick-grid">
          {quick
            .filter(([s]) => permitted(s))
            .map(([s, label]) => (
              <button
                key={label}
                onClick={() => go(s, label === "New lead" ? "new" : undefined)}
              >
                <Plus size={20} />
                <strong>{t(label)}</strong>
                <ArrowUpRight size={18} />
              </button>
            ))}
          {workspace === "parent" && (
            <a href="/trial">
              <Plus size={20} />
              <strong>{t("Send a trial enquiry")}</strong>
              <ArrowUpRight size={18} />
            </a>
          )}
        </div>
      </PortalDrawer>
      <PortalDrawer
        open={panel === "profile"}
        onClose={() => setPanel("")}
        title={t("Your account")}
        compact
      >
        <div className="portal-account-card">
          <Avatar name={account.name} />
          <div>
            <h3>{account.name}</h3>
            <p>{t(roleTitle(workspace, account))}</p>
          </div>
        </div>
        <div className="portal-profile-links">
          {workspace === "parent" && (
            <>
              <button onClick={() => go("Memberships")}>
                <Wallet size={18} />
                {t("Membership")}
                <ArrowUpRight size={16} />
              </button>
              <button onClick={() => go("Support")}>
                <MessageSquare size={18} />
                {t("Support")}
                <ArrowUpRight size={16} />
              </button>
            </>
          )}
          <button onClick={() => go("Security")}>
            <ShieldCheck size={18} />
            {t(workspace === "parent" ? "Settings" : "Security")}
            <ArrowUpRight size={16} />
          </button>
          <a href="/account">
            <LayoutDashboard size={18} />
            {t("Switch workspace")}
            <ArrowUpRight size={16} />
          </a>
          <button onClick={logout}>
            <LogOut size={18} />
            {t("Sign out")}
          </button>
        </div>
      </PortalDrawer>
      {toast && (
        <div className="portal-toast" role="status">
          <Check size={18} />
          {t("Changes saved")}
          <button
            aria-label={t("Dismiss notification")}
            onClick={() => setToast(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
