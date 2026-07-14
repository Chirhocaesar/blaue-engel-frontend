import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  CheckCheck,
  CheckCircle2,
  Clock,
  Plus,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import {
  formatDate,
  formatTime,
  formatWeekdayShort,
  formatDayMonth,
} from "@/lib/format";
import { normalizeStatus, statusLabelDe } from "@/lib/status";
import { getUpcomingHessenHolidays } from "@/lib/holidays-hessen";
import OpenAssignmentsQueue from "@/components/OpenAssignmentsQueue";
import {
  MetricCard,
  Panel,
  PanelHead,
  DataTable,
  StatusBadge,
  statusTone,
  type DataTableColumn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

type Assignment = {
  id: string;
  employeeId?: string | null;
  employee?: { id: string; fullName?: string | null; email?: string | null } | null;
  startAt: string;
  endAt: string;
  status?: string;
  customer?: {
    name?: string | null;
    companyName?: string | null;
    address?: string | null;
  } | null;
  customerName?: string | null;
};

type AssignmentsResponse = {
  items?: Assignment[];
  nextCursor?: string | null;
} | Assignment[];

type AdminUser = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  isActive?: boolean | null;
};

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortId(id?: string | null) {
  if (!id) return "—";
  return `…${id.slice(-6)}`;
}

function getItems(data: AssignmentsResponse): Assignment[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const tickColor: Record<string, string> = {
  amber: "bg-st-amber",
  blue: "bg-st-blue",
  green: "bg-st-green",
  gray: "bg-st-gray",
  violet: "bg-st-violet",
};

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  let userMap = new Map<string, { fullName?: string | null; email?: string | null }>();
  let queueEmployees: { id: string; label: string }[] = [];
  try {
    const usersJson = await apiGet<AdminUser[] | { items?: AdminUser[] }>(
      "/admin/users",
      token,
    );
    const users = Array.isArray(usersJson)
      ? usersJson
      : (usersJson?.items ?? []);
    userMap = new Map(users.map((u) => [u.id, { fullName: u.fullName, email: u.email }]));
    queueEmployees = users
      .filter((u) => (!u.role || u.role === "EMPLOYEE") && u.isActive !== false)
      .map((u) => ({ id: u.id, label: u.fullName || u.email || u.id }))
      .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));
  } catch {
    userMap = new Map();
  }

  const start = ymdLocal(new Date());
  const end = ymdLocal(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  let assignmentsData: AssignmentsResponse = { items: [] };
  let assignmentsWarning: string | null = null;
  try {
    assignmentsData = await apiGet<AssignmentsResponse>(
      `/assignments?from=${start}&to=${end}&limit=200`,
      token,
    );
  } catch (e) {
    const err = e as ApiError;
    assignmentsWarning = `Daten konnten nicht geladen werden (${err?.status ?? "?"}).`;
    assignmentsData = { items: [] };
  }

  const items = getItems(assignmentsData).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  const byStatus = (statuses: string[]) =>
    items.filter((a) => statuses.includes(normalizeStatus(a.status))).length;

  const totalCount = items.length;
  const openCount = byStatus(["ASSIGNED", "PLANNED", ""]);
  const confirmedCount = byStatus(["CONFIRMED"]);
  const doneCount = byStatus(["DONE"]);

  const employeeLabel = (a: Assignment) => {
    const mappedUser = a.employeeId ? userMap.get(a.employeeId) : null;
    return (
      a.employee?.fullName ??
      mappedUser?.fullName ??
      mappedUser?.email ??
      (a.employeeId ? shortId(a.employeeId) : "—")
    );
  };

  const customerLabel = (a: Assignment) =>
    a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";

  const openItems = items
    .filter(
      (a) =>
        !(a.employeeId || a.employee?.id) &&
        normalizeStatus(a.status) !== "CANCELLED",
    )
    .map((a) => ({
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      customerName: customerLabel(a),
      customerAddress: a.customer?.address ?? null,
    }));

  const weekAhead = items
    .filter(
      (a) =>
        new Date(a.startAt).getTime() <
          Date.now() + 7 * 24 * 60 * 60 * 1000 &&
        normalizeStatus(a.status) !== "CANCELLED",
    )
    .slice(0, 4);

  const holidays = getUpcomingHessenHolidays(new Date(), 3);

  const columns: DataTableColumn<Assignment>[] = [
    {
      key: "customer",
      header: "Kunde",
      render: (a) => (
        <>
          <div className="font-semibold text-ink">{customerLabel(a)}</div>
          {a.customer?.address ? (
            <div className="mt-0.5 hidden text-xs text-muted sm:block">
              {a.customer.address}
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "employee",
      header: "Mitarbeiter",
      className: "hidden md:table-cell",
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent-soft text-[11px] font-semibold text-accent-deep">
            {initials(employeeLabel(a))}
          </span>
          {employeeLabel(a)}
        </div>
      ),
    },
    {
      key: "time",
      header: "Zeit",
      render: (a) => (
        <span className="font-medium tabular-nums">
          {formatTime(a.startAt)}–{formatTime(a.endAt)}{" "}
          <span className="font-normal text-muted">
            · {formatWeekdayShort(a.startAt)} {formatDayMonth(a.startAt)}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (a) => (
        <div className="flex justify-end gap-1.5">
          <Link
            href={`/assignments/${a.id}`}
            className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
          >
            Details
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Topbar */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] text-ink">Dashboard</h1>
          <div className="mt-1 text-[13.5px] text-muted">
            Ihr Betrieb im Blick — die nächsten 14 Tage auf einen Blick.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-field border border-line bg-card px-3 py-2 text-[13px] font-medium shadow-card">
            <CalendarDays className="h-[15px] w-[15px] text-accent-deep" strokeWidth={1.8} />
            {formatDate(start)} – {formatDate(end)}
          </div>
          <Link
            href="/admin/assignments/new"
            className="inline-flex items-center gap-2 rounded-field bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(18,18,18,.5)] hover:bg-black"
          >
            <Plus className="h-4 w-4 text-accent" strokeWidth={2} />
            Neuer Einsatz
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <section className="mb-[22px] grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          accent="accent"
          icon={<CalendarRange strokeWidth={1.7} />}
          label="Termine (14 Tage)"
          value={totalCount}
        />
        <MetricCard
          accent="ink"
          icon={<Clock strokeWidth={1.7} />}
          label="Offen"
          value={openCount}
          foot="noch zuzuweisen oder zu bestätigen"
        />
        <MetricCard
          accent="blue"
          icon={<CheckCheck strokeWidth={1.7} />}
          label="Bestätigt"
          value={confirmedCount}
          foot="Team ist eingeplant"
        />
        <MetricCard
          accent="green"
          icon={<CheckCircle2 strokeWidth={1.7} />}
          label="Erledigt"
          value={doneCount}
          foot="unterschrieben & abgeschlossen"
        />
      </section>

      {assignmentsWarning ? (
        <div className="mb-4 rounded-field border border-st-amber/20 bg-st-amber-bg px-3 py-2 text-sm text-st-amber">
          {assignmentsWarning}
        </div>
      ) : null}

      {/* Dispatch queue */}
      <div className="mb-4">
        <OpenAssignmentsQueue items={openItems} employees={queueEmployees} />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_340px]">
        <Panel>
          <PanelHead
            title="Nächste Einsätze"
            action={{ label: "Alle anzeigen →", href: "/assignments" }}
          />
          <DataTable
            columns={columns}
            rows={items.slice(0, 8)}
            rowKey={(a) => a.id}
            empty="Keine Einsätze im Zeitraum gefunden."
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead
              title="Diese Woche"
              titleClassName="text-[15px]"
              action={{ label: "Kalender →", href: "/planner" }}
            />
            <div className="py-1.5">
              {weekAhead.length === 0 ? (
                <div className="px-5 py-4 text-sm text-muted">
                  Keine Einsätze in den nächsten 7 Tagen.
                </div>
              ) : (
                weekAhead.map((a, i) => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 px-5 py-[11px] ${i > 0 ? "border-t border-line" : ""}`}
                  >
                    <div className="w-11 flex-none text-center">
                      <div className="font-serif text-xl font-bold leading-none text-ink">
                        {new Date(a.startAt).toLocaleDateString("de-DE", {
                          day: "numeric",
                          timeZone: "Europe/Berlin",
                        })}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[.08em] text-faint">
                        {formatWeekdayShort(a.startAt)}
                      </div>
                    </div>
                    <div
                      className={`w-[3px] self-stretch rounded-full ${tickColor[statusTone(a.status)]}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink">
                        {customerLabel(a)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatTime(a.startAt)}–{formatTime(a.endAt)} · {employeeLabel(a)}
                      </div>
                    </div>
                    <span className="sr-only">{statusLabelDe(a.status)}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Feiertage · Hessen" titleClassName="text-[15px]" />
            <div className="py-1">
              {holidays.map((h, i) => (
                <div
                  key={h.date}
                  className={`flex items-center justify-between px-5 py-[9px] text-[12.5px] ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <span>{h.label}</span>
                  <span className="text-muted tabular-nums">{formatDate(h.date)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
