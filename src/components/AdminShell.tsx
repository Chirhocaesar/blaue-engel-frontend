"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  Users,
  Contact,
  BarChart3,
  PencilLine,
  Database,
  LogOut,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Active on exact match only (e.g. /admin) instead of prefix match. */
  exact?: boolean;
};

type NavSection = { label: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    label: "Übersicht",
    items: [
      { href: "/admin", label: "Dashboard", icon: Home, exact: true },
      { href: "/planner", label: "Einsatzplanung", icon: CalendarDays },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/admin/customers", label: "Kunden", icon: Users },
      { href: "/admin/employees", label: "Mitarbeiter", icon: Contact },
      { href: "/admin/masterdata", label: "Stammdaten", icon: Database },
      { href: "/admin/reports/week", label: "Berichte", icon: BarChart3 },
      { href: "/admin/corrections", label: "Korrekturen", icon: PencilLine },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminShell({
  userName,
  userRole = "Verwaltung",
  children,
}: {
  userName: string;
  userRole?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/") ||
        (item.href === "/admin/reports/week" && pathname.startsWith("/admin/reports"));

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_1fr] bg-canvas">
      {/* Sidebar */}
      <aside className="flex flex-row flex-wrap items-center gap-2 bg-ink-rail px-4 py-3 text-rail-fg lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-0 lg:px-4 lg:py-[22px]">
        {/* Brand */}
        <div className="flex items-center gap-[11px] px-2 lg:pb-[22px] lg:pt-1">
          <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] bg-gradient-to-br from-accent to-accent-deep font-serif text-[19px] font-bold text-ink shadow-[0_6px_16px_-6px_rgba(217,159,108,.6)]">
            B
          </div>
          <div>
            <div className="font-serif text-lg font-bold tracking-[.2px] text-white">
              DigitBoost
            </div>
            <div className="mt-px text-[11px] uppercase tracking-[.14em] text-faint">
              Betriebssystem
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-row flex-wrap gap-1 lg:block">
          {NAV.map((section) => (
            <div key={section.label} className="contents lg:block">
              <div className="hidden px-[10px] pb-2 pt-[14px] text-[10.5px] uppercase tracking-[.16em] text-rail-label lg:block">
                {section.label}
              </div>
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[10px] px-[11px] py-2 text-[13.5px] font-medium transition-colors lg:py-[10px]",
                      active
                        ? "bg-gradient-to-r from-accent/[.18] to-accent/[.06] text-white shadow-[inset_3px_0_0_var(--color-accent)]"
                        : "text-rail-muted hover:bg-ink-lift hover:text-white"
                    )}
                  >
                    <Icon
                      className={cn("h-[18px] w-[18px] flex-none", active && "text-accent")}
                      strokeWidth={1.7}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="ml-auto lg:ml-0 lg:mt-auto lg:border-t lg:border-ink-line lg:pt-4">
          <div className="flex items-center gap-[11px] px-1.5 py-2">
            <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-accent-soft text-[13px] font-semibold text-accent-deep">
              {initials(userName)}
            </div>
            <div className="hidden lg:block">
              <div className="text-[13px] font-medium leading-[1.25] text-rail-fg">
                {userName}
              </div>
              <div className="text-[11px] text-faint">{userRole}</div>
            </div>
            <a
              href="/logout"
              title="Abmelden"
              className="ml-auto grid place-items-center rounded-lg p-1.5 text-muted hover:bg-ink-lift hover:text-white"
            >
              <LogOut className="h-[17px] w-[17px]" strokeWidth={1.7} />
            </a>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-[34px] lg:pb-10 lg:pt-[26px]">
        {children}
      </main>
    </div>
  );
}
