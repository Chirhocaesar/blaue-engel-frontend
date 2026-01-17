"use client";

import { useMemo, useState } from "react";
import { getUpcomingBwHolidays } from "@/lib/holidays-bw";

function monthLabel(d: Date) {
  // de-DE to match the app language
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function addMonths(date: Date, delta: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

export default function PlannerPage() {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const upcoming = useMemo(() => getUpcomingBwHolidays(new Date(), 6), []);

  return (
    <main className="min-h-screen p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Einsatzplanung</h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
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
          >
            →
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Monat/Woche Ansicht kommt als nächstes. Aktuell: Monatsnavigation + Feiertage (BW).
      </p>

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
