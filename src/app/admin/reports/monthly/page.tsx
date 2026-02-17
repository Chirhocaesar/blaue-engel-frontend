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

function isDone(status?: string | null) {
  return String(status || "").toUpperCase() === "DONE";
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

  const totalsByEmployee = useMemo(() => {
    const map = new Map<string, { planned: number; done: number; km: number }>();
    employees.forEach((e) => map.set(e.id, { planned: 0, done: 0, km: 0 }));
    monthAssignments.forEach((a) => {
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
  }, [employees, monthAssignments]);

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
        const duration = hoursBetween(a.startAt, a.endAt);
        const km = typeof a.kmFinal === "number"
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
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Monatsübersicht (Admin)</h1>
          <p className="mt-1 text-sm text-gray-600">Monatliche Auswertung je Mitarbeiter.</p>
        </div>
        <Link href="/admin" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Admin-Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Monat</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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
      ) : employeeFilter ? (
        <Card className="p-4">
          <h2 className="text-base font-semibold">Einsätze</h2>
          {rows.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">Keine Einsätze im Zeitraum.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[720px] overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="text-left p-2">Datum</th>
                      <th className="text-left p-2">Zeit</th>
                      <th className="text-left p-2">Kunde</th>
                      <th className="text-left p-2">Mitarbeiter</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Dauer (Std.)</th>
                      <th className="text-left p-2">KM (eingetragen)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="odd:bg-white even:bg-gray-50/60 hover:bg-gray-100">
                        <td className="p-2 align-top">{row.dateLabel}</td>
                        <td className="p-2 align-top">{row.timeLabel}</td>
                        <td className="p-2 align-top">{row.customerName}</td>
                        <td className="p-2 align-top">{row.employeeLabel}</td>
                        <td className="p-2 align-top">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="p-2 align-top">{row.duration.toFixed(2)}</td>
                        <td className="p-2 align-top">{row.km == null ? "—" : row.km.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4">
          <h2 className="text-base font-semibold">Mitarbeiterübersicht</h2>
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[520px] overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="text-left p-2">Mitarbeiter</th>
                    <th className="text-left p-2">Geplant (Std.)</th>
                    <th className="text-left p-2">Erledigt (Std.)</th>
                    <th className="text-left p-2">KM (eingetragen)</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={4}>
                        Keine Mitarbeiter gefunden.
                      </td>
                    </tr>
                  ) : (
                    employees.map((e) => {
                      const totals = totalsByEmployee.get(e.id) ?? { planned: 0, done: 0, km: 0 };
                      return (
                        <tr key={e.id} className="odd:bg-white even:bg-gray-50/60 hover:bg-gray-100">
                          <td className="p-2">
                            {e.fullName ? `${e.fullName} · ${e.email}` : e.email || e.id}
                          </td>
                          <td className="p-2">{totals.planned.toFixed(2)}</td>
                          <td className="p-2">{totals.done.toFixed(2)}</td>
                          <td className="p-2">{totals.km.toFixed(1)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </main>
  );
}
