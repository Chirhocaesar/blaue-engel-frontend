"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, useEffect } from "react";
import { getUpcomingBwHolidays, getBwHolidayLabelByIsoDate } from "@/lib/holidays-bw";
import Link from "next/link";


function monthLabel(d: Date) {
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function addMonths(date: Date, delta: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addWeeks(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta * 7);
  return d;
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

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const jsDay = copy.getDay();
  const mondayIndex = (jsDay + 6) % 7;
  copy.setDate(copy.getDate() - mondayIndex);
  copy.setHours(0, 0, 0, 0);
  return copy;
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

function buildWeekGrid(weekStart: Date) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
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
  // status may be present in various shapes; handled defensively
  status?: any;
  state?: any;
};

const ROW_H = 28; // px per 30 minutes
const START_HOUR = 6;
const END_HOUR = 20;

export default function PlannerPage() {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const upcoming = useMemo(() => getUpcomingBwHolidays(new Date(), 6), []);
  const gridDays = useMemo(() => {
    return viewMode === "month" ? buildMonthGrid(viewMonth) : buildWeekGrid(weekStart);
  }, [viewMode, viewMonth, weekStart]);

  const [assignmentsByDate, setAssignmentsByDate] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // total assignments count for visible grid
  const assignmentsCount = useMemo(
    () => Object.values(assignmentsByDate).reduce((sum, arr) => sum + arr.length, 0),
    [assignmentsByDate]
  );

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

  // navigation handlers that respect viewMode
  function goPrev() {
    if (viewMode === "month") {
      setViewMonth((m) => addMonths(m, -1));
    } else {
      setWeekStart((w) => startOfWeek(addWeeks(w, -1)));
    }
  }
  function goNext() {
    if (viewMode === "month") {
      setViewMonth((m) => addMonths(m, 1));
    } else {
      setWeekStart((w) => startOfWeek(addWeeks(w, 1)));
    }
  }

  function switchToWeek() {
    // set weekStart to Monday of currently focused date (use first day of viewMonth for consistency)
    setWeekStart(startOfWeek(viewMode === "month" ? viewMonth : weekStart));
    setViewMode("week");
  }

  function switchToMonth() {
    setViewMode("month");
  }

  // helpers for time-raster
  const totalRows = (END_HOUR - START_HOUR) * 2;
  const totalHeight = totalRows * ROW_H; // px

  function minutesSinceStartOfDayLocal(d: Date) {
    return d.getHours() * 60 + d.getMinutes();
  }

  function getStatusString(a: Assignment) {
    const st = (a as any).status ?? (a as any).state;
    if (!st) return "ASSIGNED";
    if (typeof st === "string") return st;
    return st.type ?? st.status ?? "ASSIGNED";
  }

  function classesForStatus(status: string) {
    switch ((status || "").toUpperCase()) {
      case "CONFIRMED":
        return "bg-blue-200 border-blue-400 text-blue-800";
      case "COMPLETED":
        return "bg-green-200 border-green-400 text-green-800";
      case "ASSIGNED":
      default:
        return "bg-yellow-200 border-yellow-400 text-yellow-800";
    }
  }

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

          {/* view mode toggle */}
          <div className="ml-2 inline-flex rounded-md border bg-white">
            <button
              className={`px-3 py-1 text-sm ${viewMode === "month" ? "bg-gray-100 font-semibold" : ""}`}
              onClick={switchToMonth}
            >
              Monat
            </button>
            <button
              className={`px-3 py-1 text-sm ${viewMode === "week" ? "bg-gray-100 font-semibold" : ""}`}
              onClick={switchToWeek}
            >
              Woche
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={goPrev}
            aria-label="Vorheriger"
          >
            ←
          </button>

          <div className="min-w-[170px] text-center text-sm font-semibold">
            {viewMode === "month" ? monthLabel(viewMonth) : `${dayKeyLocal(gridDays[0])} – ${dayKeyLocal(gridDays[6])}`}
          </div>

          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={goNext}
            aria-label="Nächster"
          >
            →
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Monats-/Wochenansicht (MVP): Termine sind schreibgeschützt.
      </p>

      {/* Month or Week Grid */}
      <section className="mt-4 rounded-lg border p-3">
        {viewMode === "month" ? (
          <>
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
                              <Link
                                key={a.id}
                                href={`/assignments/${a.id}`}
                                className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-800 hover:bg-gray-200"
                                title={`${start}–${end} ${customerName}`}
                              >
                                {`${start}–${end} ${customerName}`}
                              </Link>
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
          </>
        ) : (
          // Week view: time-raster grid with labels on the left, scrollable vertically
          <div className="flex">
            {/* Time labels column */}
            <div className="w-16 shrink-0 pr-2">
              <div className="relative" style={{ height: totalHeight }}>
                {Array.from({ length: totalRows + 1 }).map((_, idx) => {
                  const minutes = START_HOUR * 60 + idx * 30;
                  const hour = Math.floor(minutes / 60);
                  const minute = minutes % 60;
                  const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                  return (
                    <div
                      key={idx}
                      className="absolute left-0 text-xs text-gray-600"
                      style={{ top: idx * ROW_H - 8, height: ROW_H }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable grid area */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 560 }}>
              <div className="grid grid-cols-7 gap-px bg-gray-200" style={{ height: totalHeight }}>
                {gridDays.map((d) => {
                  const iso = dayKeyLocal(d);
                  const holidayLabel = getBwHolidayLabelByIsoDate(iso);
                  const dayAssignments = assignmentsByDate[iso] || [];

                  return (
                    <div key={iso} className="relative bg-white">
                      {/* day header inside column */}
                      <div className="sticky top-0 z-10 bg-white border-b px-2 py-1 text-sm flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{d.toLocaleDateString("de-DE", { weekday: "short" })}</div>
                          <div className="text-xs text-gray-600">{d.getDate()}</div>
                        </div>
                        {holidayLabel ? (
                          <div className="text-[10px] rounded-full border px-2 py-0.5" title={holidayLabel}>
                            Feiertag
                          </div>
                        ) : null}
                      </div>

                      {/* timeline area */}
                      <div className="relative" style={{ height: totalHeight }}>
                        {/* horizontal grid lines */}
                        {Array.from({ length: totalRows + 1 }).map((_, ri) => (
                          <div
                            key={ri}
                            className="absolute left-0 right-0 bg-gray-100"
                            style={{ top: ri * ROW_H - 1, height: 1 }}
                          />
                        ))}

                        {/* assignments positioned absolutely */}
                        {dayAssignments.map((a) => {
                          const startDate = new Date(a.startAt);
                          const endDate = new Date(a.endAt);

                          const startMinutes = minutesSinceStartOfDayLocal(startDate);
                          const endMinutes = minutesSinceStartOfDayLocal(endDate);

                          const visibleStart = Math.max(startMinutes, START_HOUR * 60);
                          const visibleEnd = Math.min(endMinutes, END_HOUR * 60);
                          if (visibleEnd <= visibleStart) return null;

                          const topPx = ((visibleStart - START_HOUR * 60) / 30) * ROW_H;
                          const heightPx = ((visibleEnd - visibleStart) / 30) * ROW_H;

                          const status = getStatusString(a);
                          const colorCls = classesForStatus(status);

                          const customerName =
                            a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";

                          const startLabel = startDate.toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const endLabel = endDate.toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <Link
                              key={a.id}
                              href={`/assignments/${a.id}`}
                              className={`absolute left-1 right-1 rounded border px-1 text-xs overflow-hidden ${colorCls} hover:bg-gray-200`}
                              style={{
                                top: topPx,
                                height: Math.max(20, heightPx),
                              }}
                              title={`${startLabel}–${endLabel} ${customerName}`}
                            >
                              <div className="truncate">{`${startLabel}–${endLabel} ${customerName}`}</div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
