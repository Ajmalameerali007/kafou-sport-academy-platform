"use client";

import {
  Award,
  Bell,
  CalendarDays,
  FileText,
  GraduationCap,
  MessageSquare,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useLocale } from "@/components/kafou/locale";
import type { Navigate } from "./portal-shell";

const areas: Record<
  string,
  Array<{
    section: string;
    label: string;
    copy: string;
    icon: typeof CalendarDays;
  }>
> = {
  Schedule: [
    {
      section: "Schedule",
      label: "Upcoming classes",
      copy: "Confirmed classes for every child.",
      icon: CalendarDays,
    },
    {
      section: "Trials",
      label: "Trials",
      copy: "Follow trial requests and confirmed bookings.",
      icon: Sparkles,
    },
    {
      section: "Events",
      label: "Events",
      copy: "Academy events and competitions.",
      icon: Award,
    },
    {
      section: "Makeups",
      label: "Make-up and rescheduling",
      copy: "Use an available credit for a valid replacement slot.",
      icon: Repeat2,
    },
  ],
  Progress: [
    {
      section: "Progress",
      label: "Assessments",
      copy: "Published feedback and level history.",
      icon: GraduationCap,
    },
    {
      section: "Reports",
      label: "Progress reports",
      copy: "Open approved development reports.",
      icon: FileText,
    },
    {
      section: "Certificates",
      label: "Certificates",
      copy: "Download issued certificates.",
      icon: Award,
    },
    {
      section: "Recognition",
      label: "Achievements",
      copy: "Recognition shared by the academy.",
      icon: Sparkles,
    },
  ],
  Family: [
    {
      section: "Family",
      label: "Children and family profile",
      copy: "Manage child and guardian details.",
      icon: Users,
    },
    {
      section: "Enquiries",
      label: "Registration history",
      copy: "View submitted enquiries and references.",
      icon: FileText,
    },
    {
      section: "Family access",
      label: "Guardian access",
      copy: "Review family account access.",
      icon: ShieldCheck,
    },
    {
      section: "Documents",
      label: "Family documents",
      copy: "Open files shared with your family.",
      icon: FileText,
    },
  ],
  Memberships: [
    {
      section: "Memberships",
      label: "Current package",
      copy: "Package status, validity and remaining sessions.",
      icon: Wallet,
    },
    {
      section: "Finance",
      label: "Invoices and receipts",
      copy: "Review balances and recorded offline payments.",
      icon: ReceiptText,
    },
  ],
  Support: [
    {
      section: "Support",
      label: "Support tickets",
      copy: "Ask the academy operations team for help.",
      icon: MessageSquare,
    },
    {
      section: "Coach messages",
      label: "Coach communication",
      copy: "Child-linked conversations with assigned staff.",
      icon: MessageSquare,
    },
    {
      section: "Notifications",
      label: "Notifications and preferences",
      copy: "Review academy updates and notification status.",
      icon: Bell,
    },
    {
      section: "Security",
      label: "Account settings",
      copy: "Manage sign-in and account security.",
      icon: ShieldCheck,
    },
  ],
};

const sectionArea: Record<string, string> = Object.fromEntries(
  Object.entries(areas).flatMap(([area, items]) =>
    items.map((item) => [item.section, area]),
  ),
);

export function parentArea(section: string) {
  return sectionArea[section] || section;
}

export function ParentSectionHub({
  active,
  navigate,
}: {
  active: string;
  navigate: Navigate;
}) {
  const { t } = useLocale();
  const area = parentArea(active);
  const items = areas[area];
  if (!items) return null;
  return (
    <nav className="parent-section-hub" aria-label={t(`${area} tools`)}>
      <div className="parent-section-tabs">
        {items.map((item) => (
          <button
            key={item.section}
            title={t(item.copy)}
            aria-current={active === item.section ? "page" : undefined}
            onClick={() => navigate(item.section)}
          >
            <item.icon size={19} />
            <span>
              <strong>{t(item.label)}</strong>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
