"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { isPlannedCountableStatus } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import StatusPill from "@/components/StatusPill";

export const dynamic = "force-dynamic";

type Assignment = {
  id: string;
  startAt: string;
  endAt: string;
  status?: string | null;
  customer?: { name?: string | null; companyName?: string | null } | null;
  customerName?: string | null;
  employee?: { fullName?: string | null; email?: string | null } | null;
  employeeId?: string | null;
  kilometers?: number | null;
  kmAdjusted?: number | null;
  kmFinal?: number | null;
  minutesRecorded?: number | null;
  minutesAdjusted?: number | null;
  minutesFinal?: number | null;
};

type AssignmentsResponse = { items?: Assignment[] } | Assignment[];

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

function getItems(data: AssignmentsResponse): Assignment[] {
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

export default function MonthlyPage() {
  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error(assignmentsJson?.message || `HTTP ${assignmentsRes.status}`);
        }
        setAssignments(getItems(assignmentsJson));
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

  const monthLabel = useMemo(() => {
    const base = parseMonth(month);
    return base.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }, [month]);

  const monthAssignments = useMemo(() => {
    const startTs = monthRange.start.getTime();
    const endTs = monthRange.end.getTime();
    return assignments.filter((a) => {
      const ts = new Date(a.startAt).getTime();
      return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
    });
  }, [assignments, monthRange]);

  const totals = useMemo(() => {
    let planned = 0;
    let done = 0;
    let km = 0;
    monthAssignments.forEach((a) => {
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
  }, [monthAssignments]);

  const rows = useMemo(() => {
    return monthAssignments
      .slice()
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map((a) => {
        const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
        const start = new Date(a.startAt);
        const end = new Date(a.endAt);
        const dateLabel = start.toLocaleDateString("de-DE");
        const timeLabel = `${start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
        const plannedHours = isCancelled(a.status) ? null : hoursBetween(a.startAt, a.endAt);
        const doneMinutes = minutesValue(a);
        const doneHoursValue = typeof doneMinutes === "number" && Number.isFinite(doneMinutes)
          ? doneMinutes / 60
          : null;
        const doneHours = isDone(a.status) && !isCancelled(a.status) ? doneHoursValue : null;
        const km = isCancelled(a.status)
          ? null
          : typeof a.kmFinal === "number"
            ? a.kmFinal
            : typeof a.kilometers === "number"
              ? a.kilometers
              : null;
        return {
          id: a.id,
          dateLabel,
          timeLabel,
          customerName,
          status: a.status || "—",
          plannedHours,
          doneHours,
          km,
        };
      });
  }, [monthAssignments]);

  return (
    <main className="space-y-4">
      <PageHeader
        title="Monatsübersicht"
        subtitle="Ihre Monatswerte."
        actions={
          <Link href="/dashboard" className="rounded-field border border-line-strong bg-card px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-accent-soft hover:text-accent-deep">
            Dashboard
          </Link>
        }
      />

      <div className="text-sm text-muted">
        Zeitraum: {monthLabel} · Mitarbeiter: Sie
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Monat</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-[40px] rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="relative overflow-hidden rounded-card border border-line bg-card p-3 shadow-card">
          <div className="text-muted">Geplant (Std.)</div>
          <div className="font-serif text-lg font-bold text-ink">{totals.planned.toFixed(2)}</div>
        </div>
        <div className="relative overflow-hidden rounded-card border border-line bg-card p-3 shadow-card">
          <div className="text-muted">Erledigt (Std.)</div>
          <div className="font-serif text-lg font-bold text-ink">{totals.done.toFixed(2)}</div>
        </div>
        <div className="relative overflow-hidden rounded-card border border-line bg-card p-3 shadow-card">
          <div className="text-muted">KM (Erledigt)</div>
          <div className="font-serif text-lg font-bold text-ink">{totals.km.toFixed(1)}</div>
        </div>
      </div>

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : null}

      {loading ? (
        <Alert variant="info">Lade…</Alert>
      ) : (
        <Card className="p-4">
          <h2 className="text-base font-semibold">Einsätze</h2>
          {rows.length === 0 ? (
            <div className="mt-2">
              <Alert variant="info">Keine Einsätze im Zeitraum.</Alert>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Datum</th>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Zeit</th>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Kunde</th>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Status</th>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Geplant (Std.)</th>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Erledigt (Std.)</th>
                    <th className="border-b border-line bg-tint px-3 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">KM (eingetragen)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="last:[&>td]:border-b-0 hover:bg-tint-hover">
                      <td className="border-b border-line px-3 py-2.5">{row.dateLabel}</td>
                      <td className="border-b border-line px-3 py-2.5">{row.timeLabel}</td>
                      <td className="border-b border-line px-3 py-2.5">{row.customerName}</td>
                      <td className="border-b border-line px-3 py-2.5">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-right tabular-nums">
                        {row.plannedHours == null ? "—" : row.plannedHours.toFixed(2)}
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-right tabular-nums">
                        {row.doneHours == null ? "—" : row.doneHours.toFixed(2)}
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-right tabular-nums">{row.km == null ? "—" : row.km.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
