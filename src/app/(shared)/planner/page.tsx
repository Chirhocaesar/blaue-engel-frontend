"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, useEffect, useRef } from "react";
import { getUpcomingHessenHolidays, getHessenHolidayLabelByIsoDate } from "@/lib/holidays-hessen";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { formatDate, formatDayMonth, formatMonthYear, formatTime, formatWeekdayShort } from "@/lib/format";
import { deDateToIso, isoToDeDate } from "@/lib/datetime-de";
import { useNativePickers } from "@/lib/useNativePickers";
import { normalizeStatus, statusLabelDe, type NormalizedStatus } from "@/lib/status";
import {
  Alert,
  Button,
  Input,
  Panel,
  Select,
  StatusBadge,
  Textarea,
  statusTone,
  type BadgeTone,
} from "@/components/ui";
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

function endOfDayLocal(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
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

function parseYmdLocal(value?: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((part) => parseInt(part, 10));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

type Assignment = {
  id: string;
  startAt: string;
  endAt: string;
  kilometers?: number | null;
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
const START_HOUR = 0;
const END_HOUR = 24;

/** Event block styling per status tone (amber/blue/green/gray). */
const eventToneClasses: Record<BadgeTone, string> = {
  amber: "border-st-amber bg-st-amber-bg text-st-amber",
  blue: "border-st-blue bg-st-blue-bg text-st-blue",
  green: "border-st-green bg-st-green-bg text-st-green",
  gray: "border-st-gray bg-st-gray-bg text-st-gray",
};

const FILTERABLE_STATUSES: NormalizedStatus[] = ["ASSIGNED", "CONFIRMED", "DONE", "CANCELLED"];

function getStatusString(a: Assignment) {
  const st = (a as any).status ?? (a as any).state;
  if (!st) return "ASSIGNED";
  if (typeof st === "string") return st;
  return st.type ?? st.status ?? "ASSIGNED";
}

export default function PlannerPage() {
  const searchParams = useSearchParams();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dayStart, setDayStart] = useState<Date>(() => startOfDayLocal(new Date()));

  const upcoming = useMemo(() => getUpcomingHessenHolidays(new Date(), 6), []);
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
  // Status chips act as a client-side visibility filter; empty = show all.
  const [statusFilter, setStatusFilter] = useState<Set<NormalizedStatus>>(new Set());
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

  // km today mini-form state
  const [kmDate, setKmDate] = useState<string>(() => isoTodayLocal());
  const [kmDateDe, setKmDateDe] = useState<string>(() => isoToDeDate(isoTodayLocal()) || "");
  const [kmValue, setKmValue] = useState<string>("");
  const [kmSaving, setKmSaving] = useState<boolean>(false);
  const [kmSavedAt, setKmSavedAt] = useState<number | null>(null);
  const [kmError, setKmError] = useState<string | null>(null);

  useEffect(() => {
    const queryView = searchParams.get("view");
    const queryDate = parseYmdLocal(searchParams.get("date"));
    const queryEmployeeId = searchParams.get("employeeId");

    if (queryEmployeeId !== null && queryEmployeeId !== employeeFilterId) {
      setEmployeeFilterId(queryEmployeeId);
    }

    if (queryView === "week") {
      if (queryDate) setWeekStart(startOfWeek(queryDate));
      if (viewMode !== "week") setViewMode("week");
      return;
    }

    if (queryView === "day") {
      if (queryDate) setDayStart(startOfDayLocal(queryDate));
      if (viewMode !== "day") setViewMode("day");
      return;
    }

    if (queryView === "month") {
      if (queryDate) setViewMonth(new Date(queryDate.getFullYear(), queryDate.getMonth(), 1));
      if (viewMode !== "month") setViewMode("month");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const plannerReturnTo = useMemo(() => {
    const params = new URLSearchParams();
    params.set("view", viewMode);

    if (viewMode === "month") {
      params.set("date", dayKeyLocal(viewMonth));
    } else if (viewMode === "week") {
      params.set("date", dayKeyLocal(weekStart));
    } else {
      params.set("date", dayKeyLocal(dayStart));
    }

    if (isAdmin && employeeFilterId) {
      params.set("employeeId", employeeFilterId);
    }

    return `/planner?${params.toString()}`;
  }, [viewMode, viewMonth, weekStart, dayStart, isAdmin, employeeFilterId]);

  function assignmentDetailHref(assignmentId: string) {
    return `/assignments/${assignmentId}?returnTo=${encodeURIComponent(plannerReturnTo)}`;
  }

  const visibleAssignmentsByDate = useMemo(() => {
    const employeeActive = isAdmin && employeeFilterId;
    const statusActive = statusFilter.size > 0;
    if (!employeeActive && !statusActive) return assignmentsByDate;
    const filtered: Record<string, Assignment[]> = {};
    Object.entries(assignmentsByDate).forEach(([key, items]) => {
      const next = items.filter((a) => {
        if (employeeActive) {
          const id = a.employee?.id ?? (a as any).employeeId;
          if (id !== employeeFilterId) return false;
        }
        if (statusActive) {
          const st = normalizeStatus(getStatusString(a)) || "ASSIGNED";
          if (!statusFilter.has(st)) return false;
        }
        return true;
      });
      if (next.length > 0) filtered[key] = next;
    });
    return filtered;
  }, [assignmentsByDate, employeeFilterId, isAdmin, statusFilter]);

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
    const startLocal = startOfDayLocal(gridDays[0]);
    const endLocal = endOfDayLocal(viewMode === "day" ? gridDays[0] : gridDays[gridDays.length - 1]);
    const start = startLocal.toISOString();
    const end = endLocal.toISOString();

    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/planner/assignments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        {
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
        setCreateError("Wiederholen bis muss nach dem Beginn liegen.");
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

  // sync km value from the assignment for the selected date
  useEffect(() => {
    let cancelled = false;
    setKmError(null);
    const items = assignmentsByDate[kmDate] || [];
    const target = items.find((a) => String(a.status || a.state || "").toUpperCase() === "CONFIRMED") || null;
    if (!cancelled) {
      if (target && typeof target.kilometers === "number") {
        setKmValue(String(target.kilometers));
      } else {
        setKmValue("");
      }
    }
    return () => {
      cancelled = true;
    };
  }, [assignmentsByDate, kmDate]);

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

  function goToday() {
    const now = new Date();
    if (viewMode === "month") setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    else if (viewMode === "day") setDayStart(startOfDayLocal(now));
    else setWeekStart(startOfWeek(now));
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

  // Scroll week/day timeline to the first event (or 07:00) instead of 00:00.
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (viewMode === "month") return;
    const el = timelineScrollRef.current;
    if (!el) return;
    let earliest = 7 * 60;
    gridDays.forEach((d) => {
      (visibleAssignmentsByDate[dayKeyLocal(d)] || []).forEach((a) => {
        earliest = Math.min(earliest, minutesSinceStartOfDayLocal(new Date(a.startAt)));
      });
    });
    el.scrollTop = (Math.max(earliest - 30, 0) / 30) * ROW_H;
  }, [viewMode, visibleAssignmentsByDate, gridDays]);

  function eventTone(a: Assignment): BadgeTone {
    return statusTone(getStatusString(a));
  }

  function toggleStatusFilter(status: NormalizedStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
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

    const items = assignmentsByDate[kmDate] || [];
    const target = items.find((a) => String(a.status || a.state || "").toUpperCase() === "CONFIRMED") || null;
    if (!target) {
      setKmError("Kein bestätigter Einsatz gefunden.");
      return;
    }

    setKmSaving(true);
    try {
      const res = await fetch(`/api/me/assignments/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kilometers: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setKmError(json?.message || "Fehler beim Speichern");
      } else {
        setKmSavedAt(Date.now());
        setKmError(null);
        setAssignmentsByDate((prev) => {
          const next = { ...prev };
          const list = [...(next[kmDate] || [])];
          const idx = list.findIndex((a) => a.id === target.id);
          if (idx >= 0) list[idx] = { ...list[idx], kilometers: n };
          next[kmDate] = list;
          return next;
        });
      }
    } catch (e) {
      setKmError("Fehler beim Speichern");
    } finally {
      setKmSaving(false);
    }
  }

  const todayIso = dayKeyLocal(new Date());

  function customerNameOf(a: Assignment) {
    return a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
  }

  function customerAddressOf(a: Assignment) {
    return (a as any).customerAddress || (a as any).address || (a.customer as any)?.address || "";
  }

  /** Full-width readable event block (mobile week agenda). */
  function EventBlock({ a }: { a: Assignment }) {
    const tone = eventTone(a);
    return (
      <Link
        href={assignmentDetailHref(a.id)}
        className={cn(
          "block rounded-[10px] border-l-[3px] px-3 py-2 transition-opacity hover:opacity-80",
          eventToneClasses[tone]
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold tabular-nums">
            {formatTime(a.startAt)}–{formatTime(a.endAt)}
          </span>
          <span className="text-[11px] font-medium opacity-80">
            {statusLabelDe(getStatusString(a))}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[13px] font-semibold">{customerNameOf(a)}</div>
        {customerAddressOf(a) ? (
          <div className="truncate text-xs opacity-75">{customerAddressOf(a)}</div>
        ) : null}
        {a.employee?.fullName ? (
          <div className="truncate text-xs opacity-75">{a.employee.fullName}</div>
        ) : null}
      </Link>
    );
  }

  function HolidayBadge({ label }: { label: string }) {
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-st-amber-bg px-2 py-0.5 text-[10px] font-semibold text-st-amber"
        title={label}
      >
        <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
        Feiertag
      </span>
    );
  }

  const segBtnClasses = (active: boolean) =>
    cn(
      "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors sm:px-4",
      active ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"
    );

  return (
    <div className="flex flex-col gap-4">
      {plannerError ? <Alert variant="warn">{plannerError}</Alert> : null}
      {createSaved ? <Alert variant="success">Termin erstellt ✓</Alert> : null}

      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] text-ink">Einsatzplanung</h1>
          <div className="mt-1 text-[13.5px] text-muted">
            {assignmentsCount} {assignmentsCount === 1 ? "Termin" : "Termine"} im angezeigten
            Zeitraum
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <Link
              href="/admin/assignments/new"
              className="inline-flex items-center gap-2 rounded-field bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(18,18,18,.5)] hover:bg-black"
            >
              <Plus className="h-4 w-4 text-accent" strokeWidth={2} />
              Neuer Termin
            </Link>
          ) : (
            <>
              <Button type="button" onClick={openCreateModal} variant="primary">
                <Plus className="h-4 w-4" strokeWidth={2} />
                Termin erstellen
              </Button>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-field border border-line-strong bg-card px-4 py-2.5 text-[13.5px] font-semibold hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
              >
                Dashboard
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-20 -my-1 bg-canvas/95 py-1 backdrop-blur">
        <Panel className="flex flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* View switch */}
            <div className="inline-flex rounded-field border border-line bg-tint p-1">
              <button type="button" className={segBtnClasses(viewMode === "month")} onClick={switchToMonth}>
                Monat
              </button>
              <button type="button" className={segBtnClasses(viewMode === "week")} onClick={switchToWeek}>
                Woche
              </button>
              <button type="button" className={segBtnClasses(viewMode === "day")} onClick={switchToDay}>
                Tag
              </button>
            </div>

            {/* Date nav */}
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Vorheriger"
                className="grid h-9 w-9 flex-none place-items-center rounded-field border border-line-strong bg-card text-muted hover:border-accent hover:text-accent-deep"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <div className="min-w-0 truncate px-2 text-center font-serif text-[17px] font-bold text-ink sm:min-w-[210px]">
                {viewMode === "month"
                  ? monthLabel(viewMonth)
                  : viewMode === "day"
                    ? `${formatWeekdayShort(gridDays[0])}, ${formatDate(gridDays[0])}`
                    : `${formatDayMonth(gridDays[0])} – ${formatDate(gridDays[6])}`}
              </div>
              <button
                type="button"
                onClick={goNext}
                aria-label="Nächster"
                className="grid h-9 w-9 flex-none place-items-center rounded-field border border-line-strong bg-card text-muted hover:border-accent hover:text-accent-deep"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
              <Button type="button" variant="outline" size="sm" className="ml-1" onClick={goToday}>
                Heute
              </Button>
            </div>

            {/* Employee filter (admin) */}
            {isAdmin ? (
              <div className="flex items-center gap-2 sm:ml-auto">
                <Select
                  value={employeeFilterId}
                  onChange={(e) => setEmployeeFilterId(e.target.value)}
                  className="w-auto min-w-[180px] py-2"
                  aria-label="Mitarbeiter filtern"
                >
                  <option value="">Alle Mitarbeiter</option>
                  {(employeeOptionsAll.length > 0 ? employeeOptionsAll : employeeOptions).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {employeeFilterId ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEmployeeFilterId("")}>
                    Zurücksetzen
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Status filter chips — single row */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-medium text-muted">Status</span>
            {FILTERABLE_STATUSES.map((st) => {
              const active = statusFilter.size === 0 || statusFilter.has(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleStatusFilter(st)}
                  aria-pressed={statusFilter.has(st)}
                  className={cn(
                    "rounded-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active ? "opacity-100" : "opacity-35 grayscale"
                  )}
                  title={statusFilter.size === 0 ? "Klicken zum Filtern" : undefined}
                >
                  <StatusBadge status={st} />
                </button>
              );
            })}
            {statusFilter.size > 0 ? (
              <button
                type="button"
                onClick={() => setStatusFilter(new Set())}
                className="text-xs font-semibold text-accent-deep hover:underline"
              >
                Alle anzeigen
              </button>
            ) : null}
          </div>
        </Panel>
      </div>

      {!loading && !plannerError && assignmentsCount === 0 ? (
        <Panel className="border-dashed bg-tint p-6 text-center text-sm text-muted shadow-none">
          Keine Termine in diesem Zeitraum.
        </Panel>
      ) : null}

      {/* Calendar */}
      <Panel className="overflow-hidden">
        {viewMode === "month" ? (
          <>
            <div className="grid grid-cols-7 border-b border-line bg-tint">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-faint"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-line">
              {gridDays.map((d) => {
                const inMonth = d.getMonth() === viewMonth.getMonth();
                const jsDay = d.getDay();
                const isWeekend = jsDay === 0 || jsDay === 6;

                const iso = dayKeyLocal(d);
                const holidayLabel = getHessenHolidayLabelByIsoDate(iso);
                const dayAssignments = visibleAssignmentsByDate[iso] || [];
                const isToday = iso === todayIso;

                return (
                  <div
                    key={iso}
                    className={cn(
                      "relative min-h-[76px] overflow-hidden p-1.5 sm:min-h-[96px]",
                      isWeekend || holidayLabel ? "bg-tint" : "bg-card",
                      !inMonth && "opacity-45"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div
                        className={cn(
                          "grid h-6 w-6 place-items-center text-[13px] font-semibold leading-none",
                          isToday ? "rounded-full bg-ink text-white" : "text-ink"
                        )}
                      >
                        {d.getDate()}
                      </div>
                      {holidayLabel ? (
                        <span className="hidden sm:inline-flex">
                          <HolidayBadge label={holidayLabel} />
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 space-y-1">
                      {holidayLabel ? (
                        <div className="truncate text-[10px] text-st-amber" title={holidayLabel}>
                          {holidayLabel}
                        </div>
                      ) : null}
                      {dayAssignments.slice(0, 4).map((a) => {
                        const tone = eventTone(a);
                        return (
                          <Link
                            key={a.id}
                            href={assignmentDetailHref(a.id)}
                            className={cn(
                              "block truncate rounded-[6px] border-l-[3px] px-1.5 py-1 text-[11px] font-medium leading-tight transition-opacity hover:opacity-80",
                              eventToneClasses[tone]
                            )}
                            title={`${formatTime(a.startAt)}–${formatTime(a.endAt)} ${customerNameOf(a)}`}
                          >
                            <span className="tabular-nums">{formatTime(a.startAt)}</span>{" "}
                            {customerNameOf(a)}
                          </Link>
                        );
                      })}
                      {dayAssignments.length > 4 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDayStart(startOfDayLocal(d));
                            setViewMode("day");
                          }}
                          className="block w-full rounded-[6px] px-1.5 py-0.5 text-left text-[11px] font-semibold text-accent-deep hover:bg-accent-soft"
                        >
                          +{dayAssignments.length - 4} weitere
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : viewMode === "week" ? (
          <>
            {/* Mobile: stacked day agenda (readable full-width blocks) */}
            <div className="md:hidden">
              {gridDays.map((d) => {
                const iso = dayKeyLocal(d);
                const holidayLabel = getHessenHolidayLabelByIsoDate(iso);
                const dayAssignments = visibleAssignmentsByDate[iso] || [];
                const isToday = iso === todayIso;

                return (
                  <div key={iso} className="border-b border-line last:border-b-0">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-2",
                        isToday ? "bg-accent-soft" : "bg-tint"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 flex-none place-items-center rounded-[9px] font-serif text-[17px] font-bold",
                          isToday ? "bg-ink text-white" : "text-ink"
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-ink">
                          {formatWeekdayShort(d)} {formatDayMonth(d)}
                        </div>
                        {holidayLabel ? (
                          <div className="truncate text-[11px] text-st-amber">{holidayLabel}</div>
                        ) : null}
                      </div>
                      <span className="ml-auto text-xs text-faint tabular-nums">
                        {dayAssignments.length > 0
                          ? `${dayAssignments.length} Termin${dayAssignments.length === 1 ? "" : "e"}`
                          : ""}
                      </span>
                    </div>
                    <div className="space-y-2 px-3 py-2.5">
                      {dayAssignments.length === 0 ? (
                        <div className="px-1 text-sm text-faint">Keine Termine</div>
                      ) : (
                        dayAssignments.map((a) => <EventBlock key={a.id} a={a} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: 7-column timeline */}
            <div
              ref={timelineScrollRef}
              className="relative hidden w-full overflow-auto md:block"
              style={{ maxHeight: 560 }}
            >
              <div className="sticky top-0 z-20 flex border-b border-line bg-card">
                <div className="w-16 shrink-0 bg-card pr-2" />
                <div className="grid flex-1 grid-cols-7 gap-px bg-line">
                  {gridDays.map((d) => {
                    const iso = dayKeyLocal(d);
                    const holidayLabel = getHessenHolidayLabelByIsoDate(iso);
                    const isToday = iso === todayIso;
                    const jsDay = d.getDay();
                    const isWeekend = jsDay === 0 || jsDay === 6;
                    return (
                      <div
                        key={iso}
                        className={cn(
                          "flex items-center justify-between gap-1 px-2 py-1.5",
                          isToday ? "bg-accent-soft" : isWeekend ? "bg-tint" : "bg-card"
                        )}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[13px] font-semibold text-ink">
                            {formatWeekdayShort(d)}
                          </span>
                          <span
                            className={cn(
                              "grid h-[22px] w-[22px] place-items-center text-xs font-semibold",
                              isToday ? "rounded-full bg-ink text-white" : "text-muted"
                            )}
                          >
                            {d.getDate()}
                          </span>
                        </div>
                        {holidayLabel ? <HolidayBadge label={holidayLabel} /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex w-full">
                <div className="sticky left-0 z-10 w-16 shrink-0 bg-card pr-2">
                  <div className="relative" style={{ height: totalHeight }}>
                    {Array.from({ length: totalRows + 1 }).map((_, idx) => {
                      const minutes = START_HOUR * 60 + idx * 30;
                      const hour = Math.floor(minutes / 60);
                      const minute = minutes % 60;
                      const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                      return (
                        <div
                          key={idx}
                          className="absolute left-2 text-[10px] text-faint tabular-nums"
                          style={{ top: idx * ROW_H - 8, height: ROW_H }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1">
                  <div className="grid grid-cols-7 gap-px bg-line" style={{ height: totalHeight }}>
                    {gridDays.map((d) => {
                      const iso = dayKeyLocal(d);
                      const holidayLabel = getHessenHolidayLabelByIsoDate(iso);
                      const dayAssignments = visibleAssignmentsByDate[iso] || [];
                      const jsDay = d.getDay();
                      const isWeekend = jsDay === 0 || jsDay === 6;

                      const now = new Date();
                      const nowMinutes = minutesSinceStartOfDayLocal(now);
                      const nowVisible = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
                      const nowTop = ((nowMinutes - START_HOUR * 60) / 30) * ROW_H;

                      return (
                        <div
                          key={iso}
                          className={cn("relative", holidayLabel || isWeekend ? "bg-tint" : "bg-card")}
                        >
                          <div className="relative" style={{ height: totalHeight }}>
                            {Array.from({ length: totalRows + 1 }).map((_, ri) => (
                              <div
                                key={ri}
                                className="absolute left-0 right-0 bg-line/60"
                                style={{ top: ri * ROW_H - 1, height: 1 }}
                              />
                            ))}

                            {iso === todayIso && nowVisible ? (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-10 h-[2px] bg-accent-deep"
                                style={{ top: nowTop }}
                              >
                                <span className="absolute -top-[3px] left-0 h-2 w-2 rounded-full bg-accent-deep" />
                              </div>
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

                              const tone = eventTone(a);

                              return (
                                <Link
                                  key={a.id}
                                  href={assignmentDetailHref(a.id)}
                                  className={cn(
                                    "absolute left-1 right-1 overflow-hidden rounded-[8px] border-l-[3px] px-2 py-1 text-xs leading-tight transition-opacity hover:opacity-80",
                                    eventToneClasses[tone]
                                  )}
                                  style={{ top: topPx, height: Math.max(58, heightPx) }}
                                  title={`${formatTime(startDate)}–${formatTime(endDate)} ${customerNameOf(a)}`}
                                >
                                  <div className="truncate font-semibold tabular-nums">
                                    {formatTime(startDate)}–{formatTime(endDate)}
                                  </div>
                                  <div className="truncate font-semibold">{customerNameOf(a)}</div>
                                  {customerAddressOf(a) ? (
                                    <div className="truncate text-[10px] opacity-75">
                                      {customerAddressOf(a)}
                                    </div>
                                  ) : null}
                                  {a.employee?.fullName ? (
                                    <div className="truncate text-[10px] opacity-75">
                                      {a.employee.fullName}
                                    </div>
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
          </>
        ) : (
          <div ref={timelineScrollRef} className="flex w-full overflow-y-auto" style={{ maxHeight: 560 }}>
            <div className="w-14 shrink-0 pr-2 sm:w-16">
              <div className="relative" style={{ height: totalHeight }}>
                {Array.from({ length: totalRows + 1 }).map((_, idx) => {
                  const minutes = START_HOUR * 60 + idx * 30;
                  const hour = Math.floor(minutes / 60);
                  const minute = minutes % 60;
                  const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                  return (
                    <div
                      key={idx}
                      className="absolute left-2 text-[10px] text-faint tabular-nums"
                      style={{ top: idx * ROW_H - 8, height: ROW_H }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-1" style={{ height: totalHeight }}>
                {gridDays.map((d) => {
                  const iso = dayKeyLocal(d);
                  const holidayLabel = getHessenHolidayLabelByIsoDate(iso);
                  const dayAssignments = visibleAssignmentsByDate[iso] || [];

                  return (
                    <div key={iso} className={cn("relative", holidayLabel ? "bg-tint" : "bg-card")}>
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-2 py-1.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-ink">
                            {formatWeekdayShort(d)}
                          </span>
                          <span className="text-xs text-muted tabular-nums">{formatDayMonth(d)}</span>
                        </div>
                        {holidayLabel ? <HolidayBadge label={holidayLabel} /> : null}
                      </div>

                      <div className="relative" style={{ height: totalHeight }}>
                        {Array.from({ length: totalRows + 1 }).map((_, ri) => (
                          <div
                            key={ri}
                            className="absolute left-0 right-0 bg-line/60"
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

                          const tone = eventTone(a);

                          return (
                            <Link
                              key={a.id}
                              href={assignmentDetailHref(a.id)}
                              className={cn(
                                "absolute left-1 right-1 overflow-hidden rounded-[8px] border-l-[3px] px-2 py-1 text-xs leading-tight transition-opacity hover:opacity-80",
                                eventToneClasses[tone]
                              )}
                              style={{ top: topPx, height: Math.max(42, heightPx) }}
                              title={`${formatTime(startDate)}–${formatTime(endDate)} ${customerNameOf(a)}`}
                            >
                              <div className="truncate font-semibold">
                                <span className="tabular-nums">
                                  {formatTime(startDate)}–{formatTime(endDate)}
                                </span>{" "}
                                {customerNameOf(a)}
                              </div>
                              {customerAddressOf(a) ? (
                                <div className="truncate text-[10px] opacity-75">
                                  {customerAddressOf(a)}
                                </div>
                              ) : null}
                              {a.employee?.fullName ? (
                                <div className="truncate text-[10px] opacity-75">
                                  {a.employee.fullName}
                                </div>
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
      </Panel>

      {/* Create modal */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card border border-line bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-[17px] font-bold text-ink">Termin erstellen</h2>
            </div>

            {createError ? (
              <Alert variant="error" className="mt-2 text-xs">
                {createError}
              </Alert>
            ) : null}
            {createCustomerLoading ? (
              <div className="mt-2 text-xs text-muted">Kunden werden geladen…</div>
            ) : null}
            {!createCustomerLoading && createCustomerOptions.length === 0 ? (
              <div className="mt-2 text-xs text-muted">
                Keine Kunden gefunden. Bitte Admin kontaktieren.
              </div>
            ) : null}

            <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleCreateAssignment}>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-muted">Kunde</span>
                <Input
                  type="text"
                  value={createCustomerQuery}
                  onChange={(e) => setCreateCustomerQuery(e.target.value)}
                  placeholder="Kunden suchen…"
                  disabled={createSaving || createCustomerLoading}
                />
                <Select
                  value={createCustomerId}
                  onChange={(e) => setCreateCustomerId(e.target.value)}
                  disabled={createSaving || createCustomerOptions.length === 0 || createCustomerLoading}
                >
                  <option value="">Bitte wählen…</option>
                  {filteredCreateCustomerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted">Datum</span>
                <Input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  disabled={createSaving}
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted">Beginn</span>
                  <Input
                    type="time"
                    lang="de-DE"
                    step={1800}
                    value={createStartTime}
                    onChange={(e) => setCreateStartTime(e.target.value)}
                    disabled={createSaving}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted">Ende</span>
                  <Input
                    type="time"
                    lang="de-DE"
                    step={1800}
                    value={createEndTime}
                    onChange={(e) => setCreateEndTime(e.target.value)}
                    disabled={createSaving}
                  />
                </label>
              </div>

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-muted">Notiz (optional)</span>
                <Textarea
                  rows={2}
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  disabled={createSaving}
                />
              </label>

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={createRecurring}
                  onChange={(e) => setCreateRecurring(e.target.checked)}
                  disabled={createSaving}
                  className="accent-[var(--color-accent-deep)]"
                />
                Serientermin
              </label>

              {createRecurring ? (
                <>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted">Frequenz</span>
                    <Select
                      value={createFrequency}
                      onChange={(e) => setCreateFrequency(e.target.value as "WEEKLY" | "BIWEEKLY")}
                      disabled={createSaving}
                    >
                      <option value="WEEKLY">Wöchentlich</option>
                      <option value="BIWEEKLY">Alle 2 Wochen</option>
                    </Select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted">Wiederholen bis</span>
                    <Input
                      type="date"
                      value={createRepeatUntil}
                      onChange={(e) => {
                        setCreateRepeatUntilTouched(true);
                        setCreateRepeatUntil(e.target.value);
                      }}
                      disabled={createSaving}
                    />
                  </label>
                </>
              ) : null}

              <div className="sticky bottom-0 -mx-5 mt-2 border-t border-line bg-card px-5 pt-3 sm:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={closeCreateModal}>
                    Schließen
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
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

      {/* Holidays */}
      <Panel>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-serif text-[15px] font-bold text-ink">Feiertage · Hessen</h2>
          <span className="text-xs text-muted">werden im Kalender markiert</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Keine weiteren Feiertage gefunden.</p>
        ) : (
          <div className="py-1">
            {upcoming.map((h, i) => (
              <div
                key={h.date}
                className={cn(
                  "flex items-center justify-between px-5 py-[9px] text-[12.5px]",
                  i > 0 && "border-t border-line"
                )}
              >
                <span>{h.label}</span>
                <span className="text-muted tabular-nums">{formatDate(h.date)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
