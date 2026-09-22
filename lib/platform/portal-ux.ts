export type PortalNavGroup = {
  label: string;
  tabs: string[];
};

const groupOrder = [
  "Today",
  "Branches",
  "People",
  "Programmes",
  "Accounts",
  "Communication",
  "Settings",
];

const tabGroup: Record<string, string> = {
  Overview: "Today",
  Branches: "Branches",
  Coaches: "People",
  Team: "People",
  Enquiries: "People",
  Families: "People",
  Family: "People",
  Students: "People",
  Trials: "People",
  "Assigned sessions": "People",
  "Classes / Sessions": "Programmes",
  Schedule: "Programmes",
  "Student check-in": "Programmes",
  Attendance: "Programmes",
  "Staff attendance": "People",
  Makeups: "Programmes",
  Events: "Programmes",
  Coaching: "Programmes",
  Criteria: "Programmes",
  "Sports / Levels": "Programmes",
  Packages: "Programmes",
  Memberships: "Accounts",
  Finance: "Accounts",
  Compensation: "Accounts",
  Support: "Communication",
  "Coach messages": "Communication",
  Communications: "Communication",
  Notifications: "Communication",
  Handover: "Communication",
};

export function navigationGroups(tabs: string[]): PortalNavGroup[] {
  const grouped = new Map(groupOrder.map((label) => [label, [] as string[]]));
  for (const tab of tabs) {
    const label = tabGroup[tab] || "Settings";
    grouped.get(label)?.push(tab);
  }
  return groupOrder
    .map((label) => ({ label, tabs: grouped.get(label) || [] }))
    .filter((group) => group.tabs.length > 0);
}

export function overviewTitle(workspace: string) {
  if (workspace === "parent") return "Parent Home";
  if (workspace === "coach") return "Coach Today";
  if (workspace === "branch") return "Front desk today";
  if (workspace === "sales") return "Sales today";
  if (workspace === "admin") return "Today at KAFOU";
  return "Choose your workspace";
}

export function primaryTask(workspace: string) {
  if (workspace === "parent")
    return { section: "Family", label: "Manage family" };
  if (workspace === "coach")
    return { section: "Assigned sessions", label: "Open next roster" };
  if (workspace === "sales")
    return { section: "Enquiries", label: "Add enquiry", record: "new" };
  return { section: "Student check-in", label: "Open student check-in" };
}

export function operationalNavigation(
  workspace: string,
  branch: boolean,
  tabs: string[],
): PortalNavGroup[] {
  const groups: [string, string[]][] =
    workspace === "accounts"
      ? [
          ["Accounts overview", ["Overview"]],
          ["Collections", ["Finance"]],
          ["Expenses", ["Expenses"]],
          ["Staff attendance", ["Staff attendance"]],
          ["Staff pay", ["Staff pay", "My work"]],
          ["Reports", ["Business Reports", "Security"]],
        ]
      : workspace === "coach"
        ? [
            ["Today", ["Overview"]],
            ["My sessions", ["Assigned sessions", "Events"]],
            ["Student check-in", ["Student check-in"]],
            ["Attendance", ["Attendance"]],
            ["Staff attendance", ["Staff attendance"]],
            ["My students", ["Students"]],
            [
              "Progress",
              [
                "Coaching",
                "Progress",
                "Reports",
                "Recognition",
                "Business Reports",
              ],
            ],
            [
              "My work",
              [
                "My work",
                "Coach messages",
                "Engagement",
                "Notifications",
                "Security",
              ],
            ],
          ]
        : workspace === "admin" && !branch
          ? [
              ["Overview", ["Overview"]],
              ["Branches", ["Branches"]],
              ["Student check-in", ["Student check-in"]],
              ["Attendance", ["Attendance", "Makeups"]],
              ["Staff attendance", ["Staff attendance"]],
              ["People", ["Coaches", "Team", "My work"]],
              [
                "Programmes",
                [
                  "Sports / Levels",
                  "Classes / Sessions",
                  "Packages",
                  "Criteria",
                  "Events",
                ],
              ],
              [
                "Accounts",
                ["Finance", "Expenses", "Staff pay", "Compensation"],
              ],
              [
                "Reports",
                [
                  "Business Reports",
                  "Reports",
                  "Progress",
                  "Certificates",
                  "Recognition",
                ],
              ],
              [
                "Settings",
                [
                  "Communications",
                  "Support",
                  "Coach messages",
                  "Handover",
                  "Documents",
                  "Engagement",
                  "Notifications",
                  "Audit",
                  "Security",
                ],
              ],
            ]
          : [
              [
                "Today",
                [
                  "Overview",
                  "My work",
                  "Handover",
                  "Support",
                  "Coach messages",
                  "Notifications",
                  "Security",
                ],
              ],
              ["Customers", ["Families", "Students"]],
              ["Admissions", ["Enquiries", "Trials"]],
              [
                "Schedule",
                ["Schedule", "Classes / Sessions", "Coaches", "Events"],
              ],
              ["Student check-in", ["Student check-in"]],
              ["Attendance", ["Attendance", "Makeups"]],
              ["Staff attendance", ["Staff attendance"]],
              ["Memberships", ["Memberships", "Packages"]],
              [
                "Accounts",
                [
                  "Finance",
                  "Expenses",
                  "Business Reports",
                  "Recognition",
                  "Engagement",
                ],
              ],
            ];
  return groups
    .map(([label, items]) => ({
      label,
      tabs: items.filter((x) => tabs.includes(x)),
    }))
    .filter((x) => x.tabs.length > 0);
}
export function operationalLabel(tab: string, workspace: string) {
  const names: Record<string, string> = {
    Overview: workspace === "admin" ? "Overview" : "Today",
    Finance: "Collections",
    "Business Reports": "Reports",
    "Assigned sessions": "My sessions",
    Students: workspace === "coach" ? "My students" : "Students",
    Families: "Customers",
    Trials: "Trials",
    Team: "Users",
    "Classes / Sessions": "Classes",
    Coaching: "Assess students",
    Compensation: "Coach payouts",
  };
  return names[tab] || tab;
}
