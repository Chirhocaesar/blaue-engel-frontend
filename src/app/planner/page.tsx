"use client";

import { useMemo, useState } from "react";
import { getUpcomingBwHolidays, getBwHolidayLabelByIsoDate } from "@/lib/holidays-bw";

function monthLabel(d: Date) {
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function addMonths(date: Date, delta: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isoDateLocal(d: Date) {
  // Build YYYY-MM-DD in local time (avoid timezone shifting)
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

export default function PlannerPage() {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const upcoming = useMemo(() => getUpcomingBwHolidays(new Date(), 6), []);
  const gridDays = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  return (
    <main className="min-h-screen p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Einsatzplanung</h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            aria-label="Vorheriger Monat"
          >
            ←
          </button>

          <div className="min-w-[170px] text-center text-sm font-semibold">
            {monthLabel(viewMonth)}
          </div>

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
        Monatsansicht (MVP): Kalender-Raster + Feiertage. Termine kommen als nächstes.
      </p>

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

            const iso = isoDateLocal(d);
            const holidayLabel = getBwHolidayLabelByIsoDate(iso);

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

                {holidayLabel ? (
                  <div className="mt-1 text-[11px] text-gray-700" title={holidayLabel}>
                    {holidayLabel}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-gray-400">—</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Holiday list (kept for now) */}
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-base font-semibold">Feiertage (Baden-Württemberg)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Nur visuelle Markierung (MVP). Später direkt im Kalender.
        </p>

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
