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
import { Alert, Button, Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";

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
    id?: string;
    name?: string;
    companyName?: string;
    address?: string;
    phone?: string;
  };
  customerName?: string;
  employee?: { id?: string | null; fullName?: string | null; email?: string | null } | null;
  employeeId?: string | null;
  status?: any;
  state?: any;
};

type CustomerOption = {
  id: string;
  label: string;
};

type EmployeeOption = {
  id: string;
  label: string;
};

type EmployeeMinimal = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
};

type CustomerMinimal = {
  id: string;
  name?: string | null;
  address?: string | null;
};

function buildCustomerOptions(assignments: Assignment[]) {
  const map = new Map<string, CustomerOption>();
  assignments.forEach((a) => {
    const id = a.customer?.id;
    if (!id) return;
    const name = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
    const address = a.customer?.address || "";
    const label = address ? `${name} - ${address}` : name;
    if (!map.has(id)) map.set(id, { id, label });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildEmployeeOptions(assignments: Assignment[]) {
  const map = new Map<string, EmployeeOption>();
  assignments.forEach((a) => {
    const id = a.employee?.id ?? (a as any).employeeId;
    if (!id) return;
    const label = a.employee?.fullName || a.employee?.email || id;
    if (!map.has(id)) map.set(id, { id, label });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildEmployeeOptionsFromEmployees(employees: EmployeeMinimal[]) {
  const map = new Map<string, EmployeeOption>();
  employees.forEach((e) => {
    if (!e?.id) return;
    const label = e.fullName || e.email || e.id;
    if (!map.has(e.id)) map.set(e.id, { id: e.id, label });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildCustomerOptionsFromCustomers(customers: CustomerMinimal[]) {
  const map = new Map<string, CustomerOption>();
  customers.forEach((c) => {
    if (!c?.id) return;
    const name = c.name || "Kunde";
    const address = c.address || "";
    const label = address ? `${name} - ${address}` : name;
    if (!map.has(c.id)) map.set(c.id, { id: c.id, label });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

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
  const [plannerError, setPlannerError] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [employeeFilterId, setEmployeeFilterId] = useState("");
  const [employeeOptionsAll, setEmployeeOptionsAll] = useState<EmployeeOption[]>([]);
  const showNativeInputs = useNativePickers();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCustomerId, setCreateCustomerId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createStartTime, setCreateStartTime] = useState("");
  const [createEndTime, setCreateEndTime] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createCustomerQuery, setCreateCustomerQuery] = useState("");
  const [createRecurring, setCreateRecurring] = useState(false);
  const [createFrequency, setCreateFrequency] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [createRepeatUntil, setCreateRepeatUntil] = useState("");
  const [createRepeatUntilTouched, setCreateRepeatUntilTouched] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSaved, setCreateSaved] = useState(false);
  const [createCustomerOptions, setCreateCustomerOptions] = useState<CustomerOption[]>([]);
  const [createCustomerLoading, setCreateCustomerLoading] = useState(false);

  const segBtn = (key: "month" | "week" | "day") =>
    cn(
      "flex-1 rounded-none border transition-colors",
      viewMode === key
        ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-900"
        : "bg-white text-slate-900 hover:bg-slate-100"
    );

  // km today mini-form state
  const [kmDate, setKmDate] = useState<string>(() => isoTodayLocal());
  const [kmDateDe, setKmDateDe] = useState<string>(() => isoToDeDate(isoTodayLocal()) || "");
  const [kmValue, setKmValue] = useState<string>("");
  const [kmSaving, setKmSaving] = useState<boolean>(false);
  const [kmSavedAt, setKmSavedAt] = useState<number | null>(null);
  const [kmError, setKmError] = useState<string | null>(null);

  const visibleAssignmentsByDate = useMemo(() => {
    if (!isAdmin || !employeeFilterId) return assignmentsByDate;
    const filtered: Record<string, Assignment[]> = {};
    Object.entries(assignmentsByDate).forEach(([key, items]) => {
      const next = items.filter((a) => {
        const id = a.employee?.id ?? (a as any).employeeId;
        return id === employeeFilterId;
      });
      if (next.length > 0) filtered[key] = next;
    });
    return filtered;
  }, [assignmentsByDate, employeeFilterId, isAdmin]);

  const assignmentsCount = useMemo(
    () => Object.values(visibleAssignmentsByDate).reduce((sum, arr) => sum + arr.length, 0),
    [visibleAssignmentsByDate]
  );

  const customerOptions = useMemo(() => {
    const all: Assignment[] = [];
    Object.values(assignmentsByDate).forEach((arr) => all.push(...arr));
    return buildCustomerOptions(all);
  }, [assignmentsByDate]);

  const employeeOptions = useMemo(() => {
    const all: Assignment[] = [];
    Object.values(assignmentsByDate).forEach((arr) => all.push(...arr));
    return buildEmployeeOptions(all);
  }, [assignmentsByDate]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/admin/employees", { cache: "no-store" });
        const raw = res.ok ? await res.json() : [];
        const items: EmployeeMinimal[] = Array.isArray(raw) ? raw : raw?.items ?? [];
        const filtered = items.filter((u) => !u.role || u.role === "EMPLOYEE");
        if (!cancelled) {
          setEmployeeOptionsAll(buildEmployeeOptionsFromEmployees(filtered));
        }
      } catch {
        if (!cancelled) {
          setEmployeeOptionsAll([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function openCreateModal() {
    const baseDate = gridDays?.[0] ?? new Date();
    const dateIso = dayKeyLocal(baseDate);
    setCreateDate(dateIso);
    setCreateStartTime("09:00");
    setCreateEndTime("12:00");
    setCreateNotes("");
    setCreateCustomerQuery("");
    setCreateRecurring(false);
    setCreateFrequency("WEEKLY");
    setCreateRepeatUntil(dayKeyLocal(addDays(baseDate, 14)));
    setCreateRepeatUntilTouched(false);
    setCreateError("");
    setCreateCustomerId("");
    setCreateCustomerOptions(customerOptions);
    setCreateCustomerLoading(true);
    setShowCreateModal(true);

    try {
      if (isAdmin) {
        let cursor: string | null = null;
        let all: CustomerMinimal[] = [];
        for (let i = 0; i < 50; i += 1) {
          const url = new URL("/api/admin/customers", window.location.origin);
          url.searchParams.set("limit", "50");
          if (cursor) url.searchParams.set("cursor", cursor);
          const res = await fetch(url.toString(), { cache: "no-store" });
          const raw = res.ok ? await res.json() : {};
          const items: CustomerMinimal[] = Array.isArray(raw) ? raw : raw?.items ?? [];
          if (!res.ok) break;
          all = all.concat(items);
          const nextCursor = raw?.nextCursor ?? null;
          if (!nextCursor || items.length === 0) break;
          cursor = nextCursor;
        }
        setCreateCustomerOptions(buildCustomerOptionsFromCustomers(all));
      } else {
        const res = await fetch("/api/customers?limit=1000", { cache: "no-store" });
        const raw = res.ok ? await res.json() : [];
        const items: CustomerMinimal[] = Array.isArray(raw) ? raw : raw?.items ?? [];
        if (res.ok) {
          setCreateCustomerOptions(buildCustomerOptionsFromCustomers(items));
        } else {
          setCreateCustomerOptions(customerOptions);
        }
      }
    } catch {
      setCreateCustomerOptions(customerOptions);
    } finally {
      setCreateCustomerLoading(false);
    }
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateError("");
  }

  const filteredCreateCustomerOptions = useMemo(() => {
    const q = createCustomerQuery.trim().toLowerCase();
    if (!q) return createCustomerOptions;
    return createCustomerOptions.filter((c) => c.label.toLowerCase().includes(q));
  }, [createCustomerOptions, createCustomerQuery]);

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
    const end = viewMode === "day"
      ? dayKeyLocal(addDays(gridDays[0], 1))
      : dayKeyLocal(gridDays[gridDays.length - 1]);

    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/planner/assignments?start=${start}&end=${end}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          console.error("Planner assignments fetch failed:", res.status, bodyText);
          if (!cancelled) {
            setAssignmentsByDate({});
            setPlannerError(
              `Fehler beim Laden der Termine (Status ${res.status}). Bitte neu anmelden.`
            );
          }
          return;
        }

        const raw = await res.json().catch(() => ([]));
        const data: Assignment[] = Array.isArray(raw) ? raw : raw?.items ?? [];

        if (cancelled) return;
        setPlannerError("");
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
          setPlannerError("Fehler beim Laden der Termine. Bitte neu anmelden.");
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

  useEffect(() => {
    if (!createSaved) return;
    const t = window.setTimeout(() => setCreateSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [createSaved]);

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (createSaving) return;
    setCreateError("");

    if (!createCustomerId) {
      setCreateError("Bitte einen Kunden auswählen.");
      return;
    }
    if (!createDate || !createStartTime || !createEndTime) {
      setCreateError("Bitte Datum und Uhrzeiten angeben.");
      return;
    }

    const startIso = new Date(`${createDate}T${createStartTime}`).toISOString();
    const endIso = new Date(`${createDate}T${createEndTime}`).toISOString();
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setCreateError("Endzeit muss nach der Startzeit liegen.");
      return;
    }

    const payload: any = {
      customerId: createCustomerId,
      startAt: startIso,
      endAt: endIso,
      notes: createNotes.trim() || undefined,
    };

    if (createRecurring) {
      if (!createRepeatUntil) {
        setCreateError("Bitte Wiederholen bis Datum angeben.");
        return;
      }
      const startDay = new Date(`${createDate}T00:00:00`);
      const repeatEnd = new Date(`${createRepeatUntil}T23:59:59.999`);
      const diffMs = repeatEnd.getTime() - startDay.getTime();
      if (Number.isNaN(diffMs) || diffMs < 0) {
        setCreateError("Wiederholen bis muss nach dem Start liegen.");
        return;
      }
      const rangeDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (rangeDays > 90) {
        setCreateError("Serienzeitraum ist auf 3 Monate begrenzt.");
        return;
      }
      const intervalDays = createFrequency === "BIWEEKLY" ? 14 : 7;
      const recurringCount = Math.floor(rangeDays / intervalDays) + 1;
      if (recurringCount < 1 || recurringCount > 52) {
        setCreateError("Serienlänge ist ungültig (max 52 Termine).");
        return;
      }
      payload.isRecurring = true;
      payload.recurringIntervalDays = intervalDays;
      payload.recurringCount = recurringCount;
    }

    setCreateSaving(true);
    try {
      const res = await fetch("/api/me/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      setCreateSaved(true);
      setShowCreateModal(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setCreateError(e?.message || "Termin konnte nicht erstellt werden.");
    } finally {
      setCreateSaving(false);
    }
  }

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
        {plannerError ? (
          <Alert variant="warn">
            {plannerError}
          </Alert>
        ) : null}
        {createSaved ? (
          <Alert variant="success">
            Termin erstellt ✓
          </Alert>
        ) : null}
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur pb-2">
          <div className="mx-auto w-full max-w-2xl flex flex-col gap-3 sm:gap-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">Einsatzplanung</h1>
              <div className="text-xs text-gray-600">
                <span className="font-medium">Termine:</span> <span>{assignmentsCount}</span>
              </div>
            </div>

            <div className="w-full flex items-center justify-between gap-3">
              <div className="max-w-[48%]">
                {isAdmin ? (
                  <Link
                    href="/admin/assignments/new"
                    className="rounded-md border px-2 py-1 text-sm font-semibold hover:bg-gray-50 sm:px-3 sm:py-2 whitespace-nowrap truncate"
                  >
                    <span className="sm:hidden">+ Termin</span>
                    <span className="hidden sm:inline">Neuen Termin erstellen</span>
                  </Link>
                ) : (
                  <Button
                    type="button"
                    onClick={openCreateModal}
                    variant="outline"
                    size="sm"
                    className="rounded-md whitespace-nowrap truncate"
                  >
                    <span className="sm:hidden">+ Termin</span>
                    <span className="hidden sm:inline">Termin erstellen</span>
                  </Button>
                )}
              </div>

              <div className="max-w-[48%] flex justify-end">
                <Link
                  href={isAdmin ? "/admin" : "/dashboard"}
                  className="rounded-md border px-2 py-1 text-sm font-semibold hover:bg-gray-50 sm:px-3 sm:py-2 whitespace-nowrap truncate"
                >
                  Dashboard
                </Link>
              </div>
            </div>

            <div className="flex w-full overflow-hidden rounded-lg border">
              <button type="button" className={segBtn("month")} onClick={switchToMonth}>
                Monat
              </button>
              <button type="button" className={segBtn("week")} onClick={switchToWeek}>
                Woche
              </button>
              <button type="button" className={segBtn("day")} onClick={switchToDay}>
                Tag
              </button>
            </div>

            {isAdmin ? (
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid gap-1 text-xs text-gray-600">
                  <span>Mitarbeiter</span>
                  <select
                    value={employeeFilterId}
                    onChange={(e) => setEmployeeFilterId(e.target.value)}
                    className="min-h-[36px] rounded border px-2 py-1 text-sm"
                  >
                    <option value="">Alle Mitarbeiter</option>
                    {(employeeOptionsAll.length > 0 ? employeeOptionsAll : employeeOptions).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {employeeFilterId ? (
                  <button
                    type="button"
                    className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => setEmployeeFilterId("")}
                  >
                    Filter zurücksetzen
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-xs text-gray-500">Status</div>
              <div className="flex flex-wrap justify-center gap-2">
                  <StatusPill status="ASSIGNED" className="px-3 py-1 text-sm" />
                  <StatusPill status="CONFIRMED" className="px-3 py-1 text-sm" />
                  <StatusPill status="DONE" className="px-3 py-1 text-sm" />
              </div>

              {viewMode === "day" ? (
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md whitespace-nowrap"
                    onClick={() => setDayStart(startOfDayLocal(new Date()))}
                  >
                    Heute
                  </Button>
                  <div className="w-full inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 shadow-sm">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md whitespace-nowrap"
                      onClick={goPrev}
                      aria-label="Vorheriger"
                    >
                      ←
                    </Button>

                    <div className="min-w-[200px] text-center text-base font-semibold sm:text-xl truncate">
                      {`${formatWeekdayShort(gridDays[0])}, ${formatDate(gridDays[0])}`}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md whitespace-nowrap"
                      onClick={goNext}
                      aria-label="Nächster"
                    >
                      →
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-1 shadow-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md whitespace-nowrap"
                    onClick={goPrev}
                    aria-label="Vorheriger"
                  >
                    ←
                  </Button>

                  <div className="min-w-[170px] text-center text-base font-semibold sm:text-xl truncate">
                    {viewMode === "month"
                      ? monthLabel(viewMonth)
                      : `${formatDate(gridDays[0])} – ${formatDate(gridDays[6])}`}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md whitespace-nowrap"
                    onClick={goNext}
                    aria-label="Nächster"
                  >
                    →
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!loading && !plannerError && assignmentsCount === 0 ? (
          <Card className="border-dashed bg-gray-50 p-6 text-center text-sm text-gray-600">
            Keine Termine in diesem Zeitraum.
          </Card>
        ) : null}
      </div>

      {/* Month or Week Grid */}
      <Card className="mt-3 p-2 sm:p-4">
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
                const dayAssignments = visibleAssignmentsByDate[iso] || [];

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
          <div className="relative w-full overflow-auto scroll-smooth" style={{ maxHeight: 560 }}>
            <div className="sticky top-0 z-20 flex border-b bg-white">
              <div className="w-12 sm:w-16 shrink-0 pr-2 bg-white" />
              <div className="grid grid-cols-7 gap-px flex-1 bg-gray-200">
                {gridDays.map((d) => {
                  const iso = dayKeyLocal(d);
                  const holidayLabel = getBwHolidayLabelByIsoDate(iso);
                  return (
                    <div key={iso} className="bg-white px-2 py-1 text-sm flex items-center justify-between">
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
                  );
                })}
              </div>
            </div>

            <div className="flex w-full">
              <div className="w-12 sm:w-16 shrink-0 pr-2 sticky left-0 z-10 bg-white">
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
                    const dayAssignments = visibleAssignmentsByDate[iso] || [];

                    const now = new Date();
                    const todayIso = dayKeyLocal(now);
                    const nowMinutes = minutesSinceStartOfDayLocal(now);
                    const nowVisible = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
                    const nowTop = ((nowMinutes - START_HOUR * 60) / 30) * ROW_H;

                    return (
                      <div key={iso} className="relative bg-white">
                        <div className="relative" style={{ height: totalHeight }}>
                          {Array.from({ length: totalRows + 1 }).map((_, ri) => (
                            <div
                              key={ri}
                              className="absolute left-0 right-0 bg-gray-50"
                              style={{ top: ri * ROW_H - 1, height: 1 }}
                            />
                          ))}

                          {iso === todayIso && nowVisible ? (
                            <div
                              className="absolute left-0 right-0 h-px bg-gray-400/70 pointer-events-none z-10"
                              style={{ top: nowTop }}
                            />
                          ) : null}

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
          </div>
        ) : (
          <div className="flex overflow-y-auto w-full" style={{ maxHeight: 560 }}>
            <div className="w-12 sm:w-16 shrink-0 pr-2">
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
                  const dayAssignments = visibleAssignmentsByDate[iso] || [];

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
      </Card>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Termin erstellen</h2>
            </div>

            {createError ? (
              <Alert variant="error" className="mt-2 text-xs">
                {createError}
              </Alert>
            ) : null}
            {createCustomerLoading ? (
              <div className="mt-2 text-xs text-gray-600">Kunden werden geladen…</div>
            ) : null}
            {!createCustomerLoading && createCustomerOptions.length === 0 ? (
              <div className="mt-2 text-xs text-gray-600">
                Keine Kunden gefunden. Bitte Admin kontaktieren.
              </div>
            ) : null}

            <form className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleCreateAssignment}>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-gray-600">Kunde</span>
                <input
                  type="text"
                  value={createCustomerQuery}
                  onChange={(e) => setCreateCustomerQuery(e.target.value)}
                  placeholder="Kunden suchen…"
                  className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                  disabled={createSaving || createCustomerLoading}
                />
                <select
                  value={createCustomerId}
                  onChange={(e) => setCreateCustomerId(e.target.value)}
                  className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                  disabled={createSaving || createCustomerOptions.length === 0 || createCustomerLoading}
                >
                  <option value="">Bitte wählen…</option>
                  {filteredCreateCustomerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-gray-600">Datum</span>
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                  disabled={createSaving}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Start</span>
                  <input
                    type="time"
                    value={createStartTime}
                    onChange={(e) => setCreateStartTime(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={createSaving}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Ende</span>
                  <input
                    type="time"
                    value={createEndTime}
                    onChange={(e) => setCreateEndTime(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={createSaving}
                  />
                </label>
              </div>

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-gray-600">Notiz (optional)</span>
                <textarea
                  rows={2}
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                  disabled={createSaving}
                />
              </label>

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={createRecurring}
                  onChange={(e) => setCreateRecurring(e.target.checked)}
                  disabled={createSaving}
                />
                Serientermin
              </label>

              {createRecurring ? (
                <>
                  <label className="grid gap-1">
                    <span className="text-xs text-gray-600">Frequenz</span>
                    <select
                      value={createFrequency}
                      onChange={(e) => setCreateFrequency(e.target.value as "WEEKLY" | "BIWEEKLY")}
                      className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                      disabled={createSaving}
                    >
                      <option value="WEEKLY">Wöchentlich</option>
                      <option value="BIWEEKLY">Alle 2 Wochen</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-gray-600">Wiederholen bis</span>
                    <input
                      type="date"
                      value={createRepeatUntil}
                      onChange={(e) => {
                        setCreateRepeatUntilTouched(true);
                        setCreateRepeatUntil(e.target.value);
                      }}
                      className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                      disabled={createSaving}
                    />
                  </label>
                </>
              ) : null}

              <div className="sm:col-span-2 sticky bottom-0 -mx-4 mt-2 border-t bg-white px-4 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeCreateModal}
                  >
                    Schließen
                  </Button>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={createSaving || createCustomerOptions.length === 0 || createCustomerLoading}
                  >
                    {createSaving ? "Speichern…" : "Termin erstellen"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Card className="mt-6">
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
      </Card>
    </main>
  );
}
