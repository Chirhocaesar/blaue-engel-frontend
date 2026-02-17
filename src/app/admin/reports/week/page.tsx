"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import StatusPill from "@/components/StatusPill";

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

function isDone(status?: string | null) {
  return String(status || "").toUpperCase() === "DONE";
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
          `/api/admin/assignments?start=${ymdLocal(start)}&end=${ymdLocal(end)}`,
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

    return Array.from(ids)
      .map((id) => {
        const e = employeesById.get(id);
        const label = e?.fullName
          ? `${e.fullName}${e.email ? ` · ${e.email}` : ""}`
          : e?.email || id;
        return { id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));
  }, [employeeFilter, employees, employeesById, filteredAssignments]);

  const assignmentsByEmployeeDay = useMemo(() => {
    const map = new Map<string, Map<string, Assignment[]>>();
    filteredAssignments.forEach((a) => {
      const empId = a.employeeId || a.employee?.id;
      if (!empId) return;
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
      row.planned += hours;
      if (isDone(a.status)) {
        row.done += hours;
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
      planned += hours;
      if (isDone(a.status)) {
        done += hours;
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

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Wochenübersicht (Admin)</h1>
          <p className="mt-1 text-sm text-gray-600">Wöchentliche Auswertung je Mitarbeiter.</p>
        </div>
        <Link href="/admin" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Admin-Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Wochenstart</span>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="min-h-[40px] rounded border px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Mitarbeiter</span>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="min-h-[40px] rounded border px-3 py-2"
          >
            <option value="">Alle Mitarbeiter</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName ? `${e.fullName} · ${e.email}` : e.email || e.id}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm text-gray-600">{weekLabel}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border p-3">
          <div className="text-gray-600">Geplant (Std.)</div>
          <div className="text-lg font-semibold">{selectedTotals.planned.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-gray-600">Erledigt (Std.)</div>
          <div className="text-lg font-semibold">{selectedTotals.done.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-gray-600">KM (Erledigt)</div>
          <div className="text-lg font-semibold">{selectedTotals.km.toFixed(1)}</div>
        </div>
      </div>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-600">Lade…</div>
      ) : (
        <Card className="p-4">
          <h2 className="text-base font-semibold">Wochenansicht nach Mitarbeiter</h2>
          {employeeRows.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">Keine Mitarbeiter gefunden.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[920px] overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="text-left p-2">Mitarbeiter</th>
                      {weekDays.map((day) => (
                        <th key={day.toISOString()} className="text-left p-2">
                          {day.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeRows.map((row) => (
                      <tr key={row.id} className="odd:bg-white even:bg-gray-50/60 align-top">
                        <td className="p-2 font-medium">{row.label}</td>
                        {weekDays.map((day) => {
                          const dayKey = ymdLocal(day);
                          const list = assignmentsByEmployeeDay.get(row.id)?.get(dayKey) ?? [];
                          return (
                            <td key={`${row.id}-${dayKey}`} className="p-2 align-top">
                              {list.length === 0 ? (
                                <div className="text-xs text-gray-400">—</div>
                              ) : (
                                <div className="space-y-1">
                                  {list.map((a) => {
                                    const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
                                    return (
                                      <div key={a.id} className="rounded border bg-white px-2 py-1">
                                        <div className="text-xs text-gray-600">{formatTimeRange(a)}</div>
                                        <div className="text-sm font-medium truncate">{customerName}</div>
                                        <div className="mt-1">
                                          <StatusPill status={a.status} />
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
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
