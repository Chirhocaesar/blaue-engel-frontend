import { getUpcomingBwHolidays } from "@/lib/holidays-bw";

export default function PlannerPage() {
  const upcoming = getUpcomingBwHolidays(new Date(), 6);

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-semibold">Einsatzplanung</h1>
      <p className="mt-2 text-sm text-gray-600">
        Planungsansicht (Monat / Woche) – in Vorbereitung
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
