"use client";

import { useMemo, useState, useEffect } from "react";
import { getUpcomingBwHolidays, getBwHolidayLabelByIsoDate } from "@/lib/holidays-bw";

function monthLabel(d: Date) {
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function addMonths(date: Date, delta: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfCalendarGrid(monthStart: Date) {
  // Monday-start grid (Mo–So)
  const d = new Date(monthStart);
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const mondayIndex = (jsDay + 6) % 7; // 0=Mon..6=Sun
  d.setDate(d.getDate() - mondayIndex);
  return d;
}

function buildMonthGrid(monthStart: Date) {
  const start = startOfCalendarGrid(monthStart);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

type Assignment = {
  id: string;
  startAt: string;
  endAt: string;
  customer?: {
    name?: string;
    companyName?: string;
  };
  customerName?: string;
};

export default function PlannerPage() {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const upcoming = useMemo(() => getUpcomingBwHolidays(new Date(), 6), []);
  const gridDays = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const [assignmentsByDate, setAssignmentsByDate] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // total assignments count for visible grid
  const assignmentsCount = useMemo(
    () => Object.values(assignmentsByDate).reduce((sum, arr) => sum + arr.length, 0),
    [assignmentsByDate]
  );

  const loadedKeys = useMemo(() => Object.keys(assignmentsByDate), [assignmentsByDate]);

  useEffect(() => {
    let cancelled = false;
    if (!gridDays || gridDays.length === 0) return;
    const start = dayKeyLocal(gridDays[0]);
    const end = dayKeyLocal(gridDays[gridDays.length - 1]);

    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/planner/assignments?start=${start}&end=${end}`, {
          signal: controller.signal,
        });
        const raw = res.ok ? await res.json() : [];
        // support both array responses and object { items, nextCursor }
        const data: Assignment[] = Array.isArray(raw) ? raw : raw?.items ?? [];

        if (cancelled) return;
        const map: Record<string, Assignment[]> = {};
        (data || []).forEach((a) => {
          // group by local date of startAt using local day key (matches calendar cells)
          const d = new Date(a.startAt);
          const key = dayKeyLocal(d);
          if (!map[key]) map[key] = [];
          map[key].push(a);
        });
        // sort assignments by start time per day
        Object.values(map).forEach((arr) =>
          arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        );
        setAssignmentsByDate(map);
      } catch (err: any) {
        if (err.name !== "AbortError" && !cancelled) {
          setAssignmentsByDate({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gridDays, reloadKey]);

  return (
    <main className="min-h-screen p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Einsatzplanung</h1>

          <div className="text-sm text-gray-600">
            <span className="font-medium">Termine:</span> <span>{assignmentsCount}</span>
          </div>

          <button
            type="button"
            className="ml-2 rounded-md border px-2 py-1 text-sm text-gray-700"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Termine laden"
          >
            {loading ? "Lade..." : "Termine laden"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            aria-label="Vorheriger Monat"
          >
            ←
          </button>

          <div className="min-w-[170px] text-center text-sm font-semibold">{monthLabel(viewMonth)}</div>

          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="Nächster Monat"
          >
            →
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Monatsansicht (MVP): Kalender-Raster + Feiertage. Termine sind schreibgeschützt.
      </p>

      {/* Temporary debug: show loaded assignment keys */}
      <div className="mt-2 text-sm text-gray-700">
        <div>Assignments loaded: {assignmentsCount}</div>
        <div>
          Example keys: {loadedKeys.length > 0 ? loadedKeys.slice(0, 3).join(", ") : "—"}
        </div>
      </div>

      {/* Month Grid */}
      <section className="mt-4 rounded-lg border p-3">
        <div className="grid grid-cols-7 text-xs font-semibold text-gray-600">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <div key={d} className="p-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {gridDays.map((d) => {
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const jsDay = d.getDay(); // 0 Sun, 6 Sat
            const isWeekend = jsDay === 0 || jsDay === 6;

            const iso = dayKeyLocal(d);
            const holidayLabel = getBwHolidayLabelByIsoDate(iso);

            const dayAssignments = assignmentsByDate[iso] || [];

            return (
              <div
                key={iso}
                className={[
                  "min-h-[72px] bg-white p-2",
                  !inMonth ? "opacity-50" : "",
                  isWeekend ? "bg-gray-50" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold">{d.getDate()}</div>
                  {holidayLabel ? (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                      title={holidayLabel}
                    >
                      Feiertag
                    </span>
                  ) : null}
                </div>

                <div className="mt-1">
                  {dayAssignments.length > 0 ? (
                    <div className="space-y-1">
                      {dayAssignments.slice(0, 3).map((a) => {
                        const start = new Date(a.startAt).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const end = new Date(a.endAt).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const customerName =
                          a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
                        return (
                          <div
                            key={a.id}
                            className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-800"
                            title={`${start}–${end} ${customerName}`}
                          >
                            {`${start}–${end} ${customerName}`}
                          </div>
                        );
                      })}

                      {dayAssignments.length > 3 && (
                        <div className="text-[11px] text-gray-600">+{dayAssignments.length - 3} mehr</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400">—</div>
                  )}

                  {holidayLabel ? (
                    <div className="mt-1 text-[11px] text-gray-700" title={holidayLabel}>
                      {holidayLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Holiday list (kept for now) */}
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-base font-semibold">Feiertage (Baden-Württemberg)</h2>
        <p className="mt-1 text-sm text-gray-600">Nur visuelle Markierung (MVP). Später direkt im Kalender.</p>

        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm">Keine weiteren Feiertage gefunden.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {upcoming.map((h) => (
              <li key={h.date} className="flex items-center justify-between">
                <span>{h.label}</span>
                <span className="text-gray-600">{h.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
