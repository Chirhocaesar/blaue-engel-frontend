"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDate, formatDateTime, formatDateTimeRange, formatKm, formatMinutes, formatSignedMinutes } from "@/lib/format";
import { deDateToIso, isoToDeDate } from "@/lib/datetime-de";
import { useNativePickers } from "@/lib/useNativePickers";
import { Alert } from "@/components/ui";
import PageHeader from "@/components/PageHeader";
import StatusPill from "@/components/StatusPill";

type Employee = {
  id: string;
  email: string;
  fullName?: string | null;
};

type DayBundle = {
  employeeId: string;
  date: string;
  lockedAfterSignature: boolean;
  locked?: boolean;
  lockBadge?: boolean;
  assignments: Array<{
    id: string;
    startAt: string;
    endAt: string;
    status: string;
    kilometers?: number | null;
    kmAdjusted?: number | null;
    kmFinal?: number | null;
    customer: { id: string; name: string; address: string; phone: string };
  }>;
  timeEntries: Array<{
    id: string;
    startAt: string | null;
    endAt: string | null;
    minutes: number;
    notes: string | null;
  }>;
  timeAdjustments: Array<{
    id: string;
    deltaMinutes: number;
    reason: string;
    createdAt: string;
    createdById: string | null;
  }>;
  kmAdjustments: Array<{
    id: string;
    assignmentId?: string | null;
    assignmentStartAt?: string | null;
    assignmentEndAt?: string | null;
    assignmentCustomerName?: string | null;
    deltaKm: number;
    reason: string;
    createdAt: string;
    createdById: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    createdAt: string;
    actorId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    reason: string | null;
  }>;
};

function minutesBetween(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

function ymdLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CorrectionsClient() {
  const DEBUG = false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [dateDe, setDateDe] = useState("");
  const [highlightAID, setHighlightAID] = useState("");
  const [assignmentIdParam, setAssignmentIdParam] = useState("");
  const [bundle, setBundle] = useState<DayBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [deltaMinutes, setDeltaMinutes] = useState("");
  const [timeReason, setTimeReason] = useState("");
  const [selectedTimeAssignmentId, setSelectedTimeAssignmentId] = useState("");
  const [timeFormError, setTimeFormError] = useState<string | null>(null);
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [timeSavedAt, setTimeSavedAt] = useState<number | null>(null);

  const [deltaKm, setDeltaKm] = useState("");
  const [kmReason, setKmReason] = useState("");
  const [selectedKmAssignmentId, setSelectedKmAssignmentId] = useState("");
  const [kmFormError, setKmFormError] = useState<string | null>(null);
  const [kmSubmitting, setKmSubmitting] = useState(false);
  const [kmSavedAt, setKmSavedAt] = useState<number | null>(null);

  const showNativeInputs = useNativePickers();
  const dateIso = date;
  const canFetch = employeeId && dateIso;
  const requestIdRef = useRef(0);
  const isLocked = Boolean(
    bundle?.lockedAfterSignature || (bundle as DayBundle | null)?.locked || (bundle as DayBundle | null)?.lockBadge
  );
  const disableInputs = !canFetch || loading;
  const disableSubmitBase = loading || timeSubmitting || kmSubmitting || !canFetch;
  const timeDeltaInvalid = deltaMinutes.trim() === "" || Number.isNaN(Number(deltaMinutes));
  const kmDeltaInvalid = deltaKm.trim() === "" || Number.isNaN(Number(deltaKm));
  const timeReasonMissing = !timeReason.trim();
  const kmReasonMissing = !kmReason.trim();

  const summary = useMemo(() => {
    const planned = (bundle?.assignments ?? []).reduce(
      (sum, a) => sum + minutesBetween(a.startAt, a.endAt),
      0
    );
    const recorded = (bundle?.timeEntries ?? []).reduce((sum, t) => sum + (t.minutes ?? 0), 0);
    const adjustments = (bundle?.timeAdjustments ?? []).reduce(
      (sum, a) => sum + (a.deltaMinutes ?? 0),
      0
    );
    const kmRecordedRaw = (bundle?.assignments ?? []).reduce(
      (sum, a) => sum + (typeof a.kilometers === "number" ? a.kilometers : 0),
      0
    );
    const hasKmRecorded = (bundle?.assignments ?? []).some(
      (a) => typeof a.kilometers === "number"
    );
    const kmRecorded = hasKmRecorded ? kmRecordedRaw : null;
    const kmAdjustments = (bundle?.kmAdjustments ?? []).reduce(
      (sum, a) => sum + (a.deltaKm ?? 0),
      0
    );
    const kmFinal = (kmRecorded ?? 0) + kmAdjustments;
    return {
      planned,
      recorded,
      adjustments,
      final: recorded + adjustments,
      kmRecorded,
      kmAdjustments,
      kmFinal,
    };
  }, [bundle]);

  const showTimeColumns = useMemo(() => {
    return (bundle?.timeEntries ?? []).some((t) => Boolean(t.startAt || t.endAt));
  }, [bundle?.timeEntries]);

  const hasAnyData = useMemo(() => {
    if (!bundle) return false;
    return (
      bundle.assignments.length > 0 ||
      bundle.timeEntries.length > 0 ||
      bundle.timeAdjustments.length > 0 ||
      bundle.kmAdjustments.length > 0
    );
  }, [bundle]);

  async function loadEmployees() {
    try {
      const res = await fetch("/api/admin/employees", { cache: "no-store" });
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      setEmployees(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setLoadError(e?.message || "Konnte Mitarbeiter nicht laden");
      setEmployees([]);
    }
  }

  async function loadBundle() {
    if (!canFetch) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/admin/corrections/day?employeeId=${encodeURIComponent(employeeId)}&date=${encodeURIComponent(dateIso)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      if (requestId === requestIdRef.current) {
        setBundle(json as DayBundle);
      }
    } catch (e: any) {
      if (requestId === requestIdRef.current) {
        setLoadError(e?.message || "Konnte Korrekturen nicht laden");
        setBundle(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const qEmp = searchParams.get("employeeId") ?? "";
    const qDate = searchParams.get("date") ?? "";
    const qAid = searchParams.get("aid") ?? "";
    if (qEmp && qEmp !== employeeId) setEmployeeId(qEmp);
    if (qDate && qDate !== date) {
      setDate(qDate);
      setDateDe(isoToDeDate(qDate));
    }
    if (qAid && qAid !== highlightAID) setHighlightAID(qAid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const qAssignmentId = searchParams.get("assignmentId") ?? "";
    if (!qAssignmentId || qAssignmentId === assignmentIdParam) return;
    setAssignmentIdParam(qAssignmentId);
    setHighlightAID(qAssignmentId);
    (async () => {
      try {
        const res = await fetch(`/api/me/assignments/${qAssignmentId}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const empId = json?.employeeId || json?.employee?.id || "";
        const day = ymdLocal(json?.startAt);
        if (empId && empId !== employeeId) setEmployeeId(empId);
        if (day && day !== date) {
          setDate(day);
          setDateDe(isoToDeDate(day));
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, assignmentIdParam]);

  useEffect(() => {
    if (canFetch) loadBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, dateIso]);

  useEffect(() => {
    if (!bundle?.employeeId || !bundle?.date) return;
    setDeltaMinutes("");
    setTimeReason("");
    setTimeFormError(null);
    const preferredTimeAssignmentId =
      assignmentIdParam && bundle.assignments.some((a) => a.id === assignmentIdParam)
        ? assignmentIdParam
        : bundle.assignments[0]?.id ?? "";
    setSelectedTimeAssignmentId(preferredTimeAssignmentId);
    setDeltaKm("");
    setKmReason("");
    setKmFormError(null);
    setSelectedKmAssignmentId(bundle.assignments[0]?.id ?? "");
  }, [bundle?.employeeId, bundle?.date, assignmentIdParam]);

  useEffect(() => {
    if (!bundle) return;
    if (selectedTimeAssignmentId && bundle.assignments.some((a) => a.id === selectedTimeAssignmentId)) return;
    setSelectedTimeAssignmentId(bundle.assignments[0]?.id ?? "");
  }, [bundle, selectedTimeAssignmentId]);

  useEffect(() => {
    if (!bundle) return;
    if (selectedKmAssignmentId && bundle.assignments.some((a) => a.id === selectedKmAssignmentId)) return;
    setSelectedKmAssignmentId(bundle.assignments[0]?.id ?? "");
  }, [bundle, selectedKmAssignmentId]);

  useEffect(() => {
    if (!timeSavedAt) return;
    const timeout = window.setTimeout(() => setTimeSavedAt(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [timeSavedAt]);

  useEffect(() => {
    if (!kmSavedAt) return;
    const timeout = window.setTimeout(() => setKmSavedAt(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [kmSavedAt]);

  async function submitTimeAdjustment() {
    setTimeFormError(null);
    if (!canFetch) return setTimeFormError("Mitarbeiter und Datum wählen");
    if (timeDeltaInvalid) return setTimeFormError("Minuten-Differenz ungültig");
    const delta = parseInt(deltaMinutes, 10);
    if (!timeReason.trim()) return setTimeFormError("Begründung erforderlich");
    if (!selectedTimeAssignmentId) {
      return setTimeFormError("Bitte einen Einsatz für die Zeit-Korrektur auswählen");
    }

    setTimeSubmitting(true);
    try {
      const res = await fetch(`/api/admin/time-adjustments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedTimeAssignmentId,
          userId: employeeId,
          date: dateIso,
          effectiveDate: dateIso,
          deltaMinutes: delta,
          reason: timeReason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

      setDeltaMinutes("");
      setTimeReason("");
      setTimeSavedAt(Date.now());
      await loadBundle();
    } catch (e: any) {
      setTimeFormError(e?.message || "Fehler beim Speichern");
    } finally {
      setTimeSubmitting(false);
    }
  }

  async function submitKmAdjustment() {
    setKmFormError(null);
    if (!canFetch) return setKmFormError("Mitarbeiter und Datum wählen");
    if (kmDeltaInvalid) return setKmFormError("KM-Differenz ungültig");
    const delta = parseInt(deltaKm, 10);
    if (!kmReason.trim()) return setKmFormError("Begründung erforderlich");
    if (!selectedKmAssignmentId) return setKmFormError("Bitte einen Einsatz für die KM-Korrektur auswählen");

    setKmSubmitting(true);
    try {
      const res = await fetch(`/api/admin/km-adjustments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedKmAssignmentId,
          userId: employeeId,
          date: dateIso,
          effectiveDate: dateIso,
          deltaKm: delta,
          reason: kmReason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

      setDeltaKm("");
      setKmReason("");
      setKmSavedAt(Date.now());
      await loadBundle();
    } catch (e: any) {
      setKmFormError(e?.message || "Fehler beim Speichern");
    } finally {
      setKmSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] text-ink">Korrekturen</h1>
          <div className="mt-1 text-[13.5px] text-muted">
            Änderungen hier wirken sich auf Monatsberichte und Abrechnung aus.
          </div>
        </div>
        <Link
          href="/planner"
          className="inline-flex items-center rounded-field border border-line-strong bg-card px-4 py-2.5 text-[13.5px] font-semibold hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
        >
          Zum Dienstplan
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-card px-4 py-3 text-sm shadow-card sm:grid-cols-2">
        <label className="grid gap-1 min-w-0">
          <span>Mitarbeiter</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full min-w-0 rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">Bitte wählen…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {(emp.fullName ? `${emp.fullName} · ` : "") + emp.email}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 min-w-0">
          <span>Datum</span>
          {showNativeInputs ? (
            <input
              type="date"
              value={dateIso}
              onChange={(e) => {
                const nextIso = e.target.value;
                setDate(nextIso);
                setDateDe(isoToDeDate(nextIso));
              }}
              className="w-full min-w-0 rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          ) : (
            <input
              type="text"
              inputMode="numeric"
              placeholder="TT.MM.JJJJ"
              value={dateDe}
              onChange={(e) => {
                const next = e.target.value;
                setDateDe(next);
                const nextIso = deDateToIso(next);
                setDate(nextIso || "");
              }}
              className="w-full min-w-0 rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          )}
        </label>
      </div>

      {(bundle || loading || loadError) && canFetch ? (
        <section className="space-y-2 rounded-card border border-line bg-card p-4 text-sm shadow-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-muted">Auswahl</div>
              <div className="font-medium">
                {employeeId
                  ? employees.find((e) => e.id === employeeId)?.fullName ||
                    employees.find((e) => e.id === employeeId)?.email ||
                    "—"
                  : "—"} · {formatDate(dateIso)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLocked ? (
                <span
                  className="rounded-full border border-red-300 px-2 py-0.5 text-xs font-semibold text-red-700"
                  aria-label="Gesperrt"
                  title="Gesperrt"
                >
                  🔒
                </span>
              ) : null}
            </div>
          </div>
          <div className="rounded-field border border-line bg-tint p-4">
            <h2 className="mb-3 text-base font-semibold text-ink">Summen</h2>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="col-span-2 flex items-baseline justify-between">
                <div className="text-muted">Geplant</div>
                <div className="font-medium">{formatMinutes(summary.planned)}</div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-muted">Erfasst</div>
                <div className="font-medium">{formatMinutes(summary.recorded)}</div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-muted">KM erfasst</div>
                <div className="font-medium">{summary.kmRecorded ?? 0}</div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-muted">Korrektur</div>
                <div className="font-medium">{formatSignedMinutes(summary.adjustments)}</div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-muted">KM Korrektur</div>
                <div className="font-medium">
                  {(summary.kmAdjustments ?? 0) >= 0 ? "+" : ""}
                  {summary.kmAdjustments ?? 0}
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-muted">Final</div>
                <div className="font-semibold">{formatMinutes(summary.final)}</div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-muted">KM final</div>
                <div className="font-semibold">{summary.kmFinal ?? summary.kmRecorded ?? 0}</div>
              </div>
            </div>
          </div>
          {isLocked ? (
            <div className="text-xs text-muted">
              Tag ist nach Unterschrift gesperrt (für Mitarbeiter). Admin-Korrekturen sind weiterhin möglich.
            </div>
          ) : null}
        </section>
      ) : null}

      {loadError ? <Alert variant="error">{loadError}</Alert> : null}
      {loadError ? (
        <div>
          <button
            type="button"
            onClick={loadBundle}
            className="mt-1 rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}
      {loading ? <Alert variant="info">Lade…</Alert> : null}
      {!loading && !loadError && bundle && !hasAnyData ? (
        <Alert variant="info">Keine Einsätze, Zeit- oder KM-Daten für diesen Tag.</Alert>
      ) : null}

      {bundle ? (
        <>
          <section className="min-h-[140px] space-y-3 rounded-card border border-line bg-card p-4 shadow-card">
            <h2 className="text-base font-semibold text-ink">Einsätze</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="">
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Kunde</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Zeit</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Status</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">KM (eingetragen)</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">KM Korrektur</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-faint">KM final</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.assignments.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={7}>
                        Keine Einsätze für diesen Tag.
                      </td>
                    </tr>
                  ) : (
                    bundle.assignments.map((a) => (
                      <tr
                        key={a.id}
                        className={
                          highlightAID && a.id === highlightAID
                            ? "bg-st-amber-bg"
                            : "hover:bg-tint-hover"
                        }
                      >
                        <td className="border-b border-line px-3 py-2.5">
                          <div className="font-medium">{a.customer?.name}</div>
                          <div className="text-xs text-muted">{a.customer?.address}</div>
                        </td>
                        <td className="border-b border-line px-3 py-2.5">
                          {formatDateTimeRange(a.startAt, a.endAt)}
                        </td>
                        <td className="border-b border-line px-3 py-2.5">
                          <StatusPill status={a.status} />
                        </td>
                        <td className="border-b border-line px-3 py-2.5 text-right tabular-nums">
                          {typeof a.kilometers === "number" ? formatKm(a.kilometers) : "—"}
                        </td>
                        <td className="border-b border-line px-3 py-2.5 text-right tabular-nums">{a.kmAdjusted ?? 0}</td>
                        <td className="border-b border-line px-3 py-2.5 text-right tabular-nums">
                          {a.kmFinal ?? (a.kilometers ?? 0) + (a.kmAdjusted ?? 0)}
                        </td>
                        <td className="border-b border-line px-3 py-2.5">
                          <button
                            type="button"
                            className={`rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium ${selectedKmAssignmentId === a.id ? "border-ink bg-ink text-white" : "bg-card hover:border-accent hover:bg-accent-soft hover:text-accent-deep"}`}
                            onClick={() => setSelectedKmAssignmentId(a.id)}
                            disabled={disableInputs}
                          >
                            {selectedKmAssignmentId === a.id ? "Ausgewählt" : "KM korrigieren"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="border-t" />

          <section className="min-h-[220px] space-y-3 rounded-card border border-line bg-card p-4 shadow-card">
            <h2 className="text-base font-semibold text-ink">Zeit</h2>
            <div className="text-sm text-fg">
              Geplant: {formatMinutes(summary.planned)} · Erfasst: {formatMinutes(summary.recorded)} · Korrektur: {formatSignedMinutes(summary.adjustments)} · Final: {formatMinutes(summary.final)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="grid gap-1 sm:col-span-2">
                <span>Einsatz für Zeit-Korrektur</span>
                <select
                  value={selectedTimeAssignmentId}
                  onChange={(e) => setSelectedTimeAssignmentId(e.target.value)}
                  disabled={disableInputs || bundle.assignments.length === 0}
                  className="rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {bundle.assignments.length === 0 ? (
                    <option value="">Keine Einsätze verfügbar</option>
                  ) : (
                    bundle.assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.customer?.name} · {formatDateTimeRange(assignment.startAt, assignment.endAt)}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="">
                    {showTimeColumns ? (
                      <>
                        <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Beginn</th>
                        <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Ende</th>
                      </>
                    ) : null}
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Dauer</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Notiz</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.timeEntries.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={showTimeColumns ? 4 : 2}>
                        Keine Zeiteinträge.
                      </td>
                    </tr>
                  ) : (
                    bundle.timeEntries.map((t) => (
                      <tr key={t.id} className="hover:bg-tint-hover">
                        {showTimeColumns ? (
                          <>
                            <td className="border-b border-line px-3 py-2.5">
                              {t.startAt ? formatDateTime(t.startAt) : <span className="text-faint">—</span>}
                            </td>
                            <td className="border-b border-line px-3 py-2.5">
                              {t.endAt ? formatDateTime(t.endAt) : <span className="text-faint">—</span>}
                            </td>
                          </>
                        ) : null}
                        <td className="border-b border-line px-3 py-2.5">{formatMinutes(t.minutes ?? 0)}</td>
                        <td className="border-b border-line px-3 py-2.5">{t.notes ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="">
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Delta</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Grund</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Erstellt</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.timeAdjustments.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={3}>
                        Keine Zeit-Korrekturen.
                      </td>
                    </tr>
                  ) : (
                    bundle.timeAdjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-tint-hover">
                        <td className="border-b border-line px-3 py-2.5">{a.deltaMinutes}</td>
                        <td className="border-b border-line px-3 py-2.5">{a.reason}</td>
                        <td className="border-b border-line px-3 py-2.5">{formatDateTime(a.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="grid gap-1">
                <span>Minuten-Differenz</span>
                <input
                  inputMode="numeric"
                  value={deltaMinutes}
                  onChange={(e) => {
                    if (DEBUG) console.log("deltaMinutes", e.target.value);
                    setDeltaMinutes(e.target.value);
                  }}
                  disabled={disableInputs}
                  className="rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span>Begründung</span>
                <textarea
                  value={timeReason}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTimeReason(next);
                    if (next.trim()) setTimeFormError(null);
                  }}
                  disabled={disableInputs}
                  className="rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  rows={3}
                />
                {timeFormError ? (
                  <Alert variant="error" className="mt-2 text-xs">
                    {timeFormError}
                  </Alert>
                ) : null}
              </label>
            </div>
            {isLocked ? (
              <div className="text-xs text-muted">
                Tag ist nach Unterschrift gesperrt (für Mitarbeiter). Admin-Korrekturen sind weiterhin möglich.
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submitTimeAdjustment}
                disabled={disableSubmitBase || timeDeltaInvalid || timeReasonMissing}
                className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
              >
                {timeSubmitting ? "Speichern…" : "Zeit-Korrektur erstellen"}
              </button>
              {timeSavedAt ? <div className="text-sm text-st-green">Gespeichert ✓</div> : null}
            </div>
          </section>

          <div className="border-t" />

          <section className="min-h-[180px] space-y-3 rounded-card border border-line bg-card p-4 shadow-card">
            <h2 className="text-base font-semibold text-ink">KM</h2>
            <div className="text-sm text-fg">
              KM (eingetragen): {summary.kmRecorded != null ? `${formatKm(summary.kmRecorded)} km` : "—"}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="">
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Bezug</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Delta</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Grund</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Erstellt</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.kmAdjustments.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={4}>
                        Keine KM-Korrekturen.
                      </td>
                    </tr>
                  ) : (
                    bundle.kmAdjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-tint-hover">
                        <td className="border-b border-line px-3 py-2.5">
                          {a.assignmentId
                            ? `${a.assignmentCustomerName ?? "Einsatz"}${a.assignmentStartAt && a.assignmentEndAt ? ` · ${formatDateTimeRange(a.assignmentStartAt, a.assignmentEndAt)}` : ""}`
                            : "Tag (Legacy)"}
                        </td>
                        <td className="border-b border-line px-3 py-2.5">{a.deltaKm}</td>
                        <td className="border-b border-line px-3 py-2.5">{a.reason}</td>
                        <td className="border-b border-line px-3 py-2.5">{formatDateTime(a.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="grid gap-1 sm:col-span-2">
                <span>Einsatz für KM-Korrektur</span>
                <select
                  value={selectedKmAssignmentId}
                  onChange={(e) => setSelectedKmAssignmentId(e.target.value)}
                  disabled={disableInputs || bundle.assignments.length === 0}
                  className="rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {bundle.assignments.length === 0 ? (
                    <option value="">Keine Einsätze verfügbar</option>
                  ) : (
                    bundle.assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.customer?.name} · {formatDateTimeRange(assignment.startAt, assignment.endAt)}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="grid gap-1">
                <span>KM-Differenz</span>
                <input
                  inputMode="numeric"
                  value={deltaKm}
                  onChange={(e) => {
                    if (DEBUG) console.log("deltaKm", e.target.value);
                    setDeltaKm(e.target.value);
                  }}
                  disabled={disableInputs}
                  className="rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span>Begründung</span>
                <textarea
                  value={kmReason}
                  onChange={(e) => {
                    const next = e.target.value;
                    setKmReason(next);
                    if (next.trim()) setKmFormError(null);
                  }}
                  disabled={disableInputs}
                  className="rounded-field border border-line-strong bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  rows={3}
                />
                {kmFormError ? (
                  <Alert variant="error" className="mt-2 text-xs">
                    {kmFormError}
                  </Alert>
                ) : null}
              </label>
            </div>
            {isLocked ? (
              <div className="text-xs text-muted">
                Tag ist nach Unterschrift gesperrt (für Mitarbeiter). Admin-Korrekturen sind weiterhin möglich.
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submitKmAdjustment}
                disabled={disableSubmitBase || kmDeltaInvalid || kmReasonMissing}
                className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
              >
                {kmSubmitting ? "Speichern…" : "KM-Korrektur erstellen"}
              </button>
              {kmSavedAt ? <div className="text-sm text-st-green">Gespeichert ✓</div> : null}
            </div>
          </section>

          <div className="border-t" />

          <section className="space-y-3 rounded-card border border-line bg-card p-4 shadow-card">
            <h2 className="text-base font-semibold text-ink">Audit-Protokoll</h2>
            {(() => {
              const logs = Array.isArray(bundle?.auditLogs) ? bundle.auditLogs : [];
              return (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="">
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Erstellt</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Aktion</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Entität</th>
                    <th className="sticky top-0 z-10 border-b border-line bg-tint px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Grund</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={4}>
                        Keine Logs.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-tint-hover">
                        <td className="border-b border-line px-3 py-2.5">{formatDateTime(log.createdAt)}</td>
                        <td className="border-b border-line px-3 py-2.5">{log.action}</td>
                        <td className="border-b border-line px-3 py-2.5">{log.entity}</td>
                        <td className="border-b border-line px-3 py-2.5">{log.reason ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
              );
            })()}
          </section>
        </>
      ) : null}
    </main>
  );
}
