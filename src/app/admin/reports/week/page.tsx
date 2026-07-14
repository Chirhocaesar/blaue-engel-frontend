"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, MetricCard, Panel, PanelHead, Select, StatusBadge } from "@/components/ui";
import { isPlannedCountableStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  isActive?: boolean | null;
};

type Assignment = {
  id: string;
  startAt: string;
  endAt: string;
  status?: string | null;
  customer?: { name?: string | null; companyName?: string | null } | null;
  customerName?: string | null;
  employee?: { id?: string | null; fullName?: string | null; email?: string | null } | null;
  employeeId?: string | null;
  kilometers?: number | null;
  kmAdjusted?: number | null;
  kmFinal?: number | null;
  minutesRecorded?: number | null;
  minutesAdjusted?: number | null;
  minutesFinal?: number | null;
};

type ItemsResponse<T> = T[] | { items?: T[] };

function ymdLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getItems<T>(data: ItemsResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function hoursBetween(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3600000;
}

function minutesValue(a: Assignment) {
  if (typeof a.minutesFinal === "number") return a.minutesFinal;
  if (typeof a.minutesRecorded === "number") return a.minutesRecorded;
  return null;
}

function doneHours(a: Assignment) {
  const minutes = minutesValue(a);
  if (typeof minutes === "number" && Number.isFinite(minutes)) return minutes / 60;
  return hoursBetween(a.startAt, a.endAt);
}

function isDone(status?: string | null) {
  return String(status || "").toUpperCase() === "DONE";
}

function isCancelled(status?: string | null) {
  return String(status || "").toUpperCase() === "CANCELLED";
}

export default function AdminWeeklyReportPage() {
  const [weekStart, setWeekStart] = useState(() => ymdLocal(startOfWeek(new Date())));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users?includeInactive=1", { cache: "no-store" });
        const json = await res.json().catch(() => ([]));
        if (!res.ok) {
          console.warn("/api/admin/users failed", res.status, json);
          return;
        }
        const items = getItems<Employee>(json).filter((u) => !u.role || u.role === "EMPLOYEE");
        setEmployees(items);
      } catch {
        setEmployees([]);
      }
    })();
  }, []);

  useEffect(() => {
    const start = new Date(weekStart);
    if (Number.isNaN(start.getTime())) return;
    const end = addDays(start, 6);

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const assignmentsRes = await fetch(
          `/api/admin/assignments?from=${ymdLocal(start)}&to=${ymdLocal(end)}`,
          { cache: "no-store" }
        );
        const assignmentsJson = await assignmentsRes.json().catch(() => ({}));
        if (!assignmentsRes.ok) {
          console.warn("/api/admin/assignments failed", assignmentsRes.status, assignmentsJson);
          throw new Error(assignmentsJson?.message || `HTTP ${assignmentsRes.status}`);
        }
        setAssignments(getItems<Assignment>(assignmentsJson));
      } catch (e: any) {
        setError(e?.message || "Daten konnten nicht geladen werden.");
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [weekStart]);

  const weekRange = useMemo(() => {
    const start = new Date(weekStart);
    if (Number.isNaN(start.getTime())) return { start: new Date(), end: new Date() };
    const end = addDays(start, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [weekStart]);

  const weekAssignments = useMemo(() => {
    const startTs = weekRange.start.getTime();
    const endTs = weekRange.end.getTime();
    return assignments.filter((a) => {
      const ts = new Date(a.startAt).getTime();
      return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
    });
  }, [assignments, weekRange]);

  const filteredAssignments = useMemo(() => {
    if (!employeeFilter) return weekAssignments;
    return weekAssignments.filter((a) => (a.employeeId || a.employee?.id) === employeeFilter);
  }, [weekAssignments, employeeFilter]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => addDays(weekRange.start, idx));
  }, [weekRange]);

  const employeesById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const employeeRows = useMemo(() => {
    const ids = new Set<string>();
    if (employeeFilter) {
      ids.add(employeeFilter);
    } else {
      employees.forEach((e) => ids.add(e.id));
    }

    filteredAssignments.forEach((a) => {
      const id = a.employeeId || a.employee?.id;
      if (id) ids.add(id);
    });

    const rows = Array.from(ids)
      .map((id) => {
        const e = employeesById.get(id);
        const label = e?.fullName
          ? `${e.fullName}${e.email ? ` · ${e.email}` : ""}`
          : e?.email || id;
        return { id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));

    // Unassigned jobs get their own row so the matrix matches the totals.
    if (
      !employeeFilter &&
      filteredAssignments.some((a) => !(a.employeeId || a.employee?.id))
    ) {
      rows.push({ id: "__unassigned", label: "Nicht zugewiesen" });
    }

    return rows;
  }, [employeeFilter, employees, employeesById, filteredAssignments]);

  const assignmentsByEmployeeDay = useMemo(() => {
    const map = new Map<string, Map<string, Assignment[]>>();
    filteredAssignments.forEach((a) => {
      const empId = a.employeeId || a.employee?.id || "__unassigned";
      const day = ymdLocal(new Date(a.startAt));
      if (!map.has(empId)) map.set(empId, new Map());
      const dayMap = map.get(empId)!;
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(a);
    });

    map.forEach((dayMap) => {
      dayMap.forEach((list) => {
        list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      });
    });

    return map;
  }, [filteredAssignments]);

  const totalsByEmployee = useMemo(() => {
    const map = new Map<string, { planned: number; done: number; km: number }>();
    employees.forEach((e) => map.set(e.id, { planned: 0, done: 0, km: 0 }));
    weekAssignments.forEach((a) => {
      const empId = a.employeeId || a.employee?.id || "";
      if (!empId) return;
      const row = map.get(empId) ?? { planned: 0, done: 0, km: 0 };
      const hours = hoursBetween(a.startAt, a.endAt);
      if (isPlannedCountableStatus(a.status)) {
        row.planned += hours;
      }
      if (isDone(a.status) && !isCancelled(a.status)) {
        row.done += doneHours(a);
        const kmValue = typeof a.kmFinal === "number"
          ? a.kmFinal
          : typeof a.kilometers === "number"
            ? a.kilometers
            : 0;
        if (Number.isFinite(kmValue)) row.km += kmValue;
      }
      map.set(empId, row);
    });
    return map;
  }, [employees, weekAssignments]);

  const selectedTotals = useMemo(() => {
    let planned = 0;
    let done = 0;
    let km = 0;
    filteredAssignments.forEach((a) => {
      const hours = hoursBetween(a.startAt, a.endAt);
      if (isPlannedCountableStatus(a.status)) {
        planned += hours;
      }
      if (isDone(a.status) && !isCancelled(a.status)) {
        done += doneHours(a);
        const kmValue = typeof a.kmFinal === "number"
          ? a.kmFinal
          : typeof a.kilometers === "number"
            ? a.kilometers
            : 0;
        if (Number.isFinite(kmValue)) km += kmValue;
      }
    });
    return { planned, done, km };
  }, [filteredAssignments]);

  function formatTimeRange(a: Assignment) {
    const start = new Date(a.startAt);
    const end = new Date(a.endAt);
    return `${start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }

  const weekLabel = `${weekRange.start.toLocaleDateString("de-DE")} – ${weekRange.end.toLocaleDateString("de-DE")}`;

  const updatedLabel = useMemo(() => {
    return new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  }, []);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] text-ink">Wochenbericht</h1>
          <div className="mt-1 text-[13.5px] text-muted">
            Wöchentliche Auswertung je Mitarbeiter · Zeitraum: {weekLabel} · Stand: {updatedLabel}
          </div>
        </div>
      </div>

      <Panel className="flex flex-wrap items-end gap-4 px-4 py-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Wochenstart</span>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="min-h-[40px] rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Mitarbeiter</span>
          <Select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="min-h-[40px] w-auto min-w-[220px]"
          >
            <option value="">Alle Mitarbeiter</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName ? `${e.fullName} · ${e.email}` : e.email || e.id}
              </option>
            ))}
          </Select>
        </label>
      </Panel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard accent="accent" label="Geplant (Std.)" value={selectedTotals.planned.toFixed(2)} />
        <MetricCard accent="green" label="Erledigt (Std.)" value={selectedTotals.done.toFixed(2)} />
        <MetricCard accent="blue" label="KM (Erledigt)" value={selectedTotals.km.toFixed(1)} />
      </div>

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : null}

      {loading ? (
        <Alert variant="info">Lade…</Alert>
      ) : (
        <Panel>
          <PanelHead title="Wochenansicht nach Mitarbeiter" />
          {employeeRows.length === 0 ? (
            <div className="p-4">
              <Alert variant="info">Keine Mitarbeiter gefunden.</Alert>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-line bg-tint px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Mitarbeiter</th>
                    {weekDays.map((day) => (
                      <th key={day.toISOString()} className="border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">
                        {day.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.map((row) => (
                    <tr key={row.id} className="align-top last:[&>td]:border-b-0 hover:bg-tint-hover">
                      <td className={`border-b border-line px-4 py-3 font-semibold ${row.id === "__unassigned" ? "text-st-amber" : "text-ink"}`}>{row.label}</td>
                      {weekDays.map((day) => {
                        const dayKey = ymdLocal(day);
                        const list = assignmentsByEmployeeDay.get(row.id)?.get(dayKey) ?? [];
                        return (
                          <td key={`${row.id}-${dayKey}`} className="border-b border-line px-3 py-3 align-top">
                            {list.length === 0 ? (
                              <div className="text-xs text-faint">—</div>
                            ) : (
                              <div className="space-y-1.5">
                                {list.map((a) => {
                                  const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
                                  const timeLabel = isCancelled(a.status) ? "—" : formatTimeRange(a);
                                  return (
                                    <div key={a.id} className="rounded-field border border-line bg-card px-2 py-1.5">
                                      <div className="text-xs text-muted tabular-nums">{timeLabel}</div>
                                      <div className="truncate text-sm font-medium text-ink">{customerName}</div>
                                      <div className="mt-1">
                                        <StatusBadge status={a.status} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </main>
  );
}
