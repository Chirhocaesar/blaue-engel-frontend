"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, useEffect } from "react";
import { getUpcomingBwHolidays, getBwHolidayLabelByIsoDate } from "@/lib/holidays-bw";
import Link from "next/link";
import { formatDate, formatDayMonth, formatMonthYear, formatTime, formatWeekdayShort } from "@/lib/format";
import { deDateToIso, isoToDeDate } from "@/lib/datetime-de";
import { useNativePickers } from "@/lib/useNativePickers";
import { statusPillClass } from "@/lib/status";
import StatusPill from "@/components/StatusPill";

function monthLabel(d: Date) {
  return formatMonthYear(d);
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

function addDays(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function startOfDayLocal(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoTodayLocal() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const day = String(t.getDate()).padStart(2, "0");
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
    address?: string;
    phone?: string;
  };
  customerName?: string;
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

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dayStart, setDayStart] = useState<Date>(() => startOfDayLocal(new Date()));

  const upcoming = useMemo(() => getUpcomingBwHolidays(new Date(), 6), []);
  const gridDays = useMemo(() => {
    if (viewMode === "month") return buildMonthGrid(viewMonth);
    if (viewMode === "day") return [dayStart];
    return buildWeekGrid(weekStart);
  }, [viewMode, viewMonth, weekStart, dayStart]);

  const [assignmentsByDate, setAssignmentsByDate] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const showNativeInputs = useNativePickers();

  // km today mini-form state
  const [kmDate, setKmDate] = useState<string>(() => isoTodayLocal());
  const [kmDateDe, setKmDateDe] = useState<string>(() => isoToDeDate(isoTodayLocal()) || "");
  const [kmValue, setKmValue] = useState<string>("");
  const [kmSaving, setKmSaving] = useState<boolean>(false);
  const [kmSavedAt, setKmSavedAt] = useState<number | null>(null);
  const [kmError, setKmError] = useState<string | null>(null);

  const assignmentsCount = useMemo(
    () => Object.values(assignmentsByDate).reduce((sum, arr) => sum + arr.length, 0),
    [assignmentsByDate]
  );

  useEffect(() => {
    const next = isoToDeDate(kmDate);
    if (next && next !== kmDateDe) setKmDateDe(next);
    if (!next && kmDateDe) setKmDateDe("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmDate]);

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
        const data: Assignment[] = Array.isArray(raw) ? raw : raw?.items ?? [];

        if (cancelled) return;
        const map: Record<string, Assignment[]> = {};
        (data || []).forEach((a) => {
          const d = new Date(a.startAt);
          const key = dayKeyLocal(d);
          if (!map[key]) map[key] = [];
          map[key].push(a);
        });
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (!cancelled) setIsAdmin(json?.role === "ADMIN");
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch km entry for kmDate on mount and when kmDate changes
  useEffect(() => {
    let cancelled = false;
    setKmError(null);
    (async () => {
      try {
        const res = await fetch(`/api/me/km-entries?from=${kmDate}&to=${kmDate}&limit=1`, {
          cache: "no-store",
        });
        const raw = await res.json().catch(() => ({}));
        const items = Array.isArray(raw) ? raw : raw?.items ?? [];
        if (cancelled) return;
        if (items && items.length > 0) {
          const item = items[0];
          const km = item?.km ?? null;
          setKmValue(km == null ? "" : String(km));
        } else {
          setKmValue("");
        }
      } catch (e) {
        if (!cancelled) setKmValue("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kmDate]);

  const hasDoneAssignmentForKmDate = useMemo(() => {
    const arr = assignmentsByDate[kmDate] || [];
    return arr.some((a) => String(a.status || a.state || "").toUpperCase() === "DONE");
  }, [assignmentsByDate, kmDate]);

  function goPrev() {
    if (viewMode === "month") setViewMonth((m) => addMonths(m, -1));
    else if (viewMode === "day") setDayStart((d) => startOfDayLocal(addDays(d, -1)));
    else setWeekStart((w) => startOfWeek(addWeeks(w, -1)));
  }

  function goNext() {
    if (viewMode === "month") setViewMonth((m) => addMonths(m, 1));
    else if (viewMode === "day") setDayStart((d) => startOfDayLocal(addDays(d, 1)));
    else setWeekStart((w) => startOfWeek(addWeeks(w, 1)));
  }

  function switchToWeek() {
    setWeekStart(startOfWeek(viewMode === "month" ? viewMonth : weekStart));
    setViewMode("week");
  }

  function switchToMonth() {
    setViewMode("month");
  }

  function switchToDay() {
    if (viewMode === "week") setDayStart(startOfDayLocal(weekStart));
    else if (viewMode === "month") setDayStart(startOfDayLocal(new Date()));
    setViewMode("day");
  }

  const totalRows = (END_HOUR - START_HOUR) * 2;
  const totalHeight = totalRows * ROW_H;

  function minutesSinceStartOfDayLocal(d: Date) {
    return d.getHours() * 60 + d.getMinutes();
  }

  function getStatusString(a: Assignment) {
    const st = (a as any).status ?? (a as any).state;
    if (!st) return "ASSIGNED";
    if (typeof st === "string") return st;
    return st.type ?? st.status ?? "ASSIGNED";
  }

  async function handleKmSave() {
    setKmError(null);
    setKmSavedAt(null);

    if (!kmValue || kmValue.trim() === "") {
      setKmError("Bitte Kilometer eingeben");
      return;
    }
    const n = Number(kmValue);
    if (Number.isNaN(n) || n < 0) {
      setKmError("Ungültige Kilometerzahl");
      return;
    }

    setKmSaving(true);
    try {
      const res = await fetch(`/api/me/km-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: kmDate, km: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setKmError(json?.message || "Fehler beim Speichern");
      else {
        setKmSavedAt(Date.now());
        setKmError(null);
      }
    } catch (e) {
      setKmError("Fehler beim Speichern");
    } finally {
      setKmSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto flex flex-col gap-3 max-w-4xl">
        <h1 className="text-2xl font-semibold">Einsatzplanung</h1>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <Link
                href="/admin/assignments/new"
                className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Neuen Termin erstellen
              </Link>
            ) : null}

            <div className="text-sm text-gray-600">
              <span className="font-medium">Termine:</span> <span>{assignmentsCount}</span>
            </div>

            <div className="inline-flex rounded-lg border bg-gray-50 p-0.5">
              <button
                type="button"
                className={`h-8 px-3 text-sm rounded-md ${viewMode === "month" ? "bg-white font-semibold shadow-sm" : "text-gray-700"}`}
                onClick={switchToMonth}
              >
                Monat
              </button>
              <button
                type="button"
                className={`h-8 px-3 text-sm rounded-md ${viewMode === "week" ? "bg-white font-semibold shadow-sm" : "text-gray-700"}`}
                onClick={switchToWeek}
              >
                Woche
              </button>
              <button
                type="button"
                className={`h-8 px-3 text-sm rounded-md ${viewMode === "day" ? "bg-white font-semibold shadow-sm" : "text-gray-700"}`}
                onClick={switchToDay}
              >
                Tag
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="font-medium">Status:</span>
              <StatusPill status="ASSIGNED" />
              <StatusPill status="CONFIRMED" />
              <StatusPill status="DONE" />
            </div>
          </div>

          <div className="flex items-center justify-center self-start sm:self-auto w-full sm:w-auto">
            <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-1 shadow-sm">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={goPrev}
                aria-label="Vorheriger"
              >
                ←
              </button>

              <div className="min-w-[170px] text-center text-sm font-semibold">
                {viewMode === "month"
                  ? monthLabel(viewMonth)
                  : viewMode === "day"
                    ? `${formatWeekdayShort(gridDays[0])}, ${formatDate(gridDays[0])}`
                    : `${formatDate(gridDays[0])} – ${formatDate(gridDays[6])}`}
              </div>

              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={goNext}
                aria-label="Nächster"
              >
                →
              </button>
            </div>
          </div>
        </div>

      </div>

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
                const jsDay = d.getDay();
                const isWeekend = jsDay === 0 || jsDay === 6;

                const iso = dayKeyLocal(d);
                const holidayLabel = getBwHolidayLabelByIsoDate(iso);
                const dayAssignments = assignmentsByDate[iso] || [];

                return (
                  <div
                    key={iso}
                    className={[
                      "relative overflow-hidden min-h-[64px] bg-white p-1.5",
                      !inMonth ? "opacity-50" : "",
                      isWeekend ? "bg-gray-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-base font-semibold leading-none">{d.getDate()}</div>
                      {holidayLabel ? (
                        <span
                          className="rounded-full border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500"
                          title={holidayLabel}
                        >
                          Feiertag
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1">
                      {dayAssignments.length > 0 ? (
                        <div className="min-w-0 space-y-1">
                          {dayAssignments.slice(0, 3).map((a) => {
                            const start = formatTime(a.startAt);
                            const end = formatTime(a.endAt);
                            const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";

                            const customerAddress = (a as any).customerAddress || (a as any).address || (a.customer as any)?.address || "";
                            const status = getStatusString(a);
                            const colorCls = statusPillClass(status);
                            return (
                              <Link
                                key={a.id}
                                href={`/assignments/${a.id}`}
                                className={`w-full min-w-0 truncate rounded-md border-l-4 px-2 py-1 text-[11px] leading-tight hover:bg-gray-200 ${colorCls}`}
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
                        <div className="mt-1 text-[11px] text-gray-500" title={holidayLabel}>
                          {holidayLabel}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : viewMode === "week" ? (
          <div className="flex overflow-y-auto" style={{ maxHeight: 560 }}>
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
                      className="absolute left-0 text-[10px] text-gray-500"
                      style={{ top: idx * ROW_H - 8, height: ROW_H }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-7 gap-px bg-gray-200" style={{ height: totalHeight }}>
                {gridDays.map((d) => {
                  const iso = dayKeyLocal(d);
                  const holidayLabel = getBwHolidayLabelByIsoDate(iso);
                  const dayAssignments = assignmentsByDate[iso] || [];

                  return (
                    <div key={iso} className="relative bg-white">
                      <div className="sticky top-0 z-10 bg-white border-b px-2 py-1 text-sm flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{formatWeekdayShort(d)}</div>
                          <div className="text-xs text-gray-600">{d.getDate()}</div>
                        </div>
                        {holidayLabel ? (
                          <div className="text-[10px] rounded-full border px-2 py-0.5" title={holidayLabel}>
                            Feiertag
                          </div>
                        ) : null}
                      </div>

                      <div className="relative" style={{ height: totalHeight }}>
                        {Array.from({ length: totalRows + 1 }).map((_, ri) => (
                          <div
                            key={ri}
                            className="absolute left-0 right-0 bg-gray-50"
                            style={{ top: ri * ROW_H - 1, height: 1 }}
                          />
                        ))}

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
                          const colorCls = statusPillClass(status);

                          const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
                          const customerAddressLine = (a as any).customerAddressLine || (a as any).address || (a.customer as any)?.address || "";

                          const startLabel = formatTime(startDate);
                          const endLabel = formatTime(endDate);

                          return (
                            <Link
                              key={a.id}
                              href={`/assignments/${a.id}`}
                              className={`absolute left-1 right-1 rounded-md border-l-4 px-2 py-0.5 text-xs leading-tight overflow-hidden ${colorCls} hover:bg-gray-200`}
                              style={{ top: topPx, height: Math.max(42, heightPx) }}
                              title={`${startLabel}–${endLabel} ${customerName}`}
                            >
                              <div className="truncate">{`${startLabel}–${endLabel} ${customerName}`}</div>
                              {customerAddressLine ? (
                                <div className="truncate text-[10px] text-gray-600">{customerAddressLine}</div>
                              ) : null}
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
        ) : (
          <div className="flex overflow-y-auto" style={{ maxHeight: 560 }}>
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
                      className="absolute left-0 text-[10px] text-gray-500"
                      style={{ top: idx * ROW_H - 8, height: ROW_H }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-1 gap-px bg-gray-200" style={{ height: totalHeight }}>
                {gridDays.map((d) => {
                  const iso = dayKeyLocal(d);
                  const holidayLabel = getBwHolidayLabelByIsoDate(iso);
                  const dayAssignments = assignmentsByDate[iso] || [];

                  return (
                    <div key={iso} className="relative bg-white">
                      <div className="sticky top-0 z-10 bg-white border-b px-2 py-1 text-sm flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{formatWeekdayShort(d)}</div>
                          <div className="text-xs text-gray-600">{formatDayMonth(d)}</div>
                        </div>
                        {holidayLabel ? (
                          <div className="text-[10px] rounded-full border px-2 py-0.5" title={holidayLabel}>
                            Feiertag
                          </div>
                        ) : null}
                      </div>

                      <div className="relative" style={{ height: totalHeight }}>
                        {Array.from({ length: totalRows + 1 }).map((_, ri) => (
                          <div
                            key={ri}
                            className="absolute left-0 right-0 bg-gray-50"
                            style={{ top: ri * ROW_H - 1, height: 1 }}
                          />
                        ))}

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
                          const colorCls = statusPillClass(status);

                          const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
                            const customerAddress = (a as any).customerAddress || (a as any).address || (a.customer as any)?.address || "";


                          const startLabel = formatTime(startDate);
                          const endLabel = formatTime(endDate);

                          return (
                            <Link
                              key={a.id}
                              href={`/assignments/${a.id}`}
                              className={`absolute left-1 right-1 rounded-md border-l-4 px-2 py-1 text-xs leading-tight overflow-hidden ${colorCls} hover:bg-gray-200`}
                              style={{ top: topPx, height: Math.max(42, heightPx) }}
                              title={`${startLabel}–${endLabel} ${customerName}`}
                            >
                              <div className="truncate">{`${startLabel}–${endLabel} ${customerName}`}</div>
                              {customerAddress ? (
                                <div className="truncate text-[10px] text-gray-600">{customerAddress}</div>
                              ) : null}
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
                <span className="text-gray-600">{formatDate(h.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
