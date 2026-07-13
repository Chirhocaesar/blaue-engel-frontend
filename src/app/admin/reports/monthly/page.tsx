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

function monthValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonth(value: string) {
  const [y, m] = value.split("-").map((v) => parseInt(v, 10));
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
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

export default function AdminMonthlyReportPage() {
  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users?includeInactive=1&limit=1000", { cache: "no-store" });
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
    const base = parseMonth(month);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const assignmentsRes = await fetch(
          `/api/planner/assignments?start=${ymdLocal(start)}&end=${ymdLocal(end)}`,
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
  }, [month]);

  const monthRange = useMemo(() => {
    const base = parseMonth(month);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [month]);

  const monthAssignments = useMemo(() => {
    const startTs = monthRange.start.getTime();
    const endTs = monthRange.end.getTime();
    return assignments.filter((a) => {
      const ts = new Date(a.startAt).getTime();
      return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
    });
  }, [assignments, monthRange]);

  const filteredAssignments = useMemo(() => {
    if (!employeeFilter) return monthAssignments;
    return monthAssignments.filter((a) => (a.employeeId || a.employee?.id) === employeeFilter);
  }, [monthAssignments, employeeFilter]);

  const monthLabel = useMemo(() => {
    const base = parseMonth(month);
    return base.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }, [month]);

  const employeeLabel = useMemo(() => {
    if (!employeeFilter) return "Alle Mitarbeiter";
    const match = employees.find((e) => e.id === employeeFilter);
    if (!match) return "Ausgewählt";
    return match.fullName ? `${match.fullName} · ${match.email ?? ""}`.trim() : match.email || "Ausgewählt";
  }, [employeeFilter, employees]);

  const updatedLabel = useMemo(() => {
    return new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  }, []);

  const totalsByEmployee = useMemo(() => {
    const map = new Map<string, { planned: number; done: number; km: number }>();
    employees.forEach((e) => map.set(e.id, { planned: 0, done: 0, km: 0 }));
    monthAssignments.forEach((a) => {
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
  }, [employees, monthAssignments]);

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

  const rows = useMemo(() => {
    return filteredAssignments
      .slice()
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map((a) => {
        const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
        const start = new Date(a.startAt);
        const end = new Date(a.endAt);
        const dateLabel = start.toLocaleDateString("de-DE");
        const timeLabel = `${start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
        const durationMinutes = minutesValue(a);
        const duration = isCancelled(a.status)
          ? null
          : typeof durationMinutes === "number" && Number.isFinite(durationMinutes)
            ? durationMinutes / 60
            : hoursBetween(a.startAt, a.endAt);
        const km = isCancelled(a.status)
          ? null
          : typeof a.kmFinal === "number"
            ? a.kmFinal
            : typeof a.kilometers === "number"
              ? a.kilometers
              : null;
        const employeeLabel = a.employee?.fullName || a.employee?.email || "—";
        return {
          id: a.id,
          dateLabel,
          timeLabel,
          customerName,
          employeeLabel,
          status: a.status || "",
          duration,
          km,
        };
      });
  }, [filteredAssignments]);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] text-ink">Monatsbericht</h1>
          <div className="mt-1 text-[13.5px] text-muted">
            Monatliche Auswertung je Mitarbeiter · Zeitraum: {monthLabel} · Mitarbeiter: {employeeLabel} · Stand: {updatedLabel}
          </div>
        </div>
      </div>

      <Panel className="flex flex-wrap items-end gap-4 px-4 py-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Monat</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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
      ) : employeeFilter ? (
        <Panel>
          <PanelHead title="Einsätze" />
          {rows.length === 0 ? (
            <div className="p-4">
              <Alert variant="info">Keine Einsätze im Zeitraum.</Alert>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    {["Datum", "Zeit", "Kunde", "Mitarbeiter", "Status"].map((h) => (
                      <th key={h} className="border-b border-line bg-tint px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">{h}</th>
                    ))}
                    <th className="border-b border-line bg-tint px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Dauer (Std.)</th>
                    <th className="border-b border-line bg-tint px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">KM (eingetragen)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="last:[&>td]:border-b-0 hover:bg-tint-hover">
                      <td className="border-b border-line px-4 py-3 align-top tabular-nums">{row.dateLabel}</td>
                      <td className="border-b border-line px-4 py-3 align-top tabular-nums">{row.timeLabel}</td>
                      <td className="border-b border-line px-4 py-3 align-top font-semibold text-ink">{row.customerName}</td>
                      <td className="border-b border-line px-4 py-3 align-top">{row.employeeLabel}</td>
                      <td className="border-b border-line px-4 py-3 align-top">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-line px-4 py-3 align-top text-right tabular-nums">{row.duration == null ? "—" : row.duration.toFixed(2)}</td>
                      <td className="border-b border-line px-4 py-3 align-top text-right tabular-nums">{row.km == null ? "—" : row.km.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <PanelHead title="Mitarbeiterübersicht" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-line bg-tint px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Mitarbeiter</th>
                  <th className="border-b border-line bg-tint px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Geplant (Std.)</th>
                  <th className="border-b border-line bg-tint px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Erledigt (Std.)</th>
                  <th className="border-b border-line bg-tint px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">KM (eingetragen)</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-muted" colSpan={4}>
                      Keine Mitarbeiter gefunden.
                    </td>
                  </tr>
                ) : (
                  employees.map((e) => {
                    const totals = totalsByEmployee.get(e.id) ?? { planned: 0, done: 0, km: 0 };
                    return (
                      <tr key={e.id} className="last:[&>td]:border-b-0 hover:bg-tint-hover">
                        <td className="border-b border-line px-4 py-3 font-semibold text-ink">
                          {e.fullName ? `${e.fullName} · ${e.email}` : e.email || e.id}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-right tabular-nums">{totals.planned.toFixed(2)}</td>
                        <td className="border-b border-line px-4 py-3 text-right tabular-nums">{totals.done.toFixed(2)}</td>
                        <td className="border-b border-line px-4 py-3 text-right tabular-nums">{totals.km.toFixed(1)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
