"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deDateToIso, isoToDeDate, makeTimeOptions } from "@/lib/datetime-de";
import { useNativePickers } from "@/lib/useNativePickers";
import { Button, Input, Select, Textarea } from "@/components/ui";

type Employee = {
  id: string;
  email: string;
  fullName?: string | null;
};

type Customer = {
  id: string;
  name: string;
  companyName?: string | null;
};

type CustomersResponse = {
  items?: Customer[];
} | Customer[];

type EmployeesResponse = Employee[];

function getCustomers(data: CustomersResponse): Customer[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function addDaysIsoDate(value: string, days: number) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function calculateRecurringCount(startDate: string, repeatUntil: string, intervalDays: number) {
  if (!startDate || !repeatUntil || intervalDays <= 0) return 0;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${repeatUntil}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / intervalDays) + 1;
}

export default function AdminAssignmentNewClient() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [seriesEnabled, setSeriesEnabled] = useState(false);
  const [seriesFrequency, setSeriesFrequency] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [seriesSuccess, setSeriesSuccess] = useState<string | null>(null);
  const [repeatUntil, setRepeatUntil] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [dateDe, setDateDe] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const showNativeInputs = useNativePickers();
  const timeOptions = useMemo(() => makeTimeOptions(30), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCustomerLoadError(null);
      try {
        const [empRes, custRes] = await Promise.all([
          fetch("/api/admin/employees", { cache: "no-store" }),
          fetch("/api/customers?limit=50", { cache: "no-store" }),
        ]);
        const empJson = await empRes.json().catch(() => []);
        const custJson = await custRes.json().catch(() => ({}));
        if (!cancelled) {
          setEmployees(Array.isArray(empJson) ? empJson : []);
          if (!custRes.ok) {
            setCustomers([]);
            setCustomerLoadError(
              `Kunden konnten nicht geladen werden (${custJson?.message || `HTTP ${custRes.status}`}).`
            );
          } else {
            setCustomers(getCustomers(custJson));
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Daten konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    const baseReady = !!(customerId && employeeId && date && startTime && endTime);
    if (!seriesEnabled) return baseReady;
    return baseReady && !!repeatUntil;
  }, [customerId, employeeId, date, startTime, endTime, seriesEnabled, repeatUntil]);

  useEffect(() => {
    if (canSubmit && formError) setFormError(null);
  }, [canSubmit, formError]);

  useEffect(() => {
    if (!seriesEnabled) return;
    if (!date || repeatUntil) return;
    setRepeatUntil(addDaysIsoDate(date, 14));
  }, [seriesEnabled, date, repeatUntil]);

  async function submit() {
    setError(null);
    setFormError(null);
    setSeriesSuccess(null);
    if (!canSubmit) {
      setFormError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    const startIso = new Date(`${date}T${startTime}`).toISOString();
    const endIso = new Date(`${date}T${endTime}`).toISOString();
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError("Endzeit muss nach der Startzeit liegen.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = "/api/admin/assignments";
      const payload = seriesEnabled
        ? (() => {
            const intervalDays = seriesFrequency === "BIWEEKLY" ? 14 : 7;
            const recurringCount = calculateRecurringCount(date, repeatUntil, intervalDays);
            if (recurringCount <= 0) {
              throw new Error("Bitte ein gueltiges Serien-Enddatum waehlen.");
            }
            return {
              customerId,
              employeeId,
              startAt: startIso,
              endAt: endIso,
              notes: notes.trim() || undefined,
              isRecurring: true,
              recurringCount,
              recurringIntervalDays: intervalDays,
            };
          })()
        : {
            customerId,
            employeeId,
            startAt: startIso,
            endAt: endIso,
            notes: notes.trim() || undefined,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          const start = json?.conflictStartAt ? new Date(json.conflictStartAt).toLocaleString("de-DE") : "";
          const end = json?.conflictEndAt ? new Date(json.conflictEndAt).toLocaleString("de-DE") : "";
          const range = start && end ? `${start} – ${end}` : "";
          throw new Error(`Konflikt mit bestehendem Termin. ${range}`.trim());
        }
        throw new Error(json?.message || "Fehler beim Erstellen");
      }

      if (seriesEnabled) {
        const count = Number(json?.count ?? (Array.isArray(json?.items) ? json.items.length : 0));
        setSeriesSuccess(`${count || 0} Termine erstellt ✓`);
        window.setTimeout(() => router.push("/planner"), 800);
        return;
      }

      const createdId = json?.id || json?.assignment?.id || json?.item?.id;
      if (!createdId) throw new Error("Keine ID im Response.");
      router.push(`/assignments/${createdId}?created=1`);
    } catch (e: any) {
      setError(e?.message || "Fehler beim Erstellen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Einsatz planen</h1>
        <p className="mt-1 text-sm text-gray-600">Neuen Termin erstellen.</p>
      </div>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      {customerLoadError ? (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          Konnte Kunden/Mitarbeiter nicht laden.
        </div>
      ) : null}
      {seriesSuccess ? (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {seriesSuccess}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Kunde</span>
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={loading || customers.length === 0}
          >
            <option value="">Bitte wählen…</option>
            {customers.length === 0 ? (
              <option value="" disabled>
                Keine Kunden vorhanden
              </option>
            ) : null}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name}
              </option>
            ))}
          </Select>
          {loading ? <div className="text-xs text-gray-600">Lade Daten…</div> : null}
        </label>

        <label className="grid gap-1 min-w-0">
          <span className="text-sm text-gray-700">Mitarbeiter</span>
          <Select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full min-w-0"
            disabled={loading || employees.length === 0}
          >
            <option value="">Bitte wählen…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {(e.fullName ? `${e.fullName} · ` : "") + e.email}
              </option>
            ))}
          </Select>
          {loading ? <div className="text-xs text-gray-600">Lade Daten…</div> : null}
        </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Datum</span>
            {showNativeInputs ? (
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  const nextIso = e.target.value;
                  setDate(nextIso);
                  setDateDe(isoToDeDate(nextIso));
                }}
              />
            ) : (
              <Input
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
              />
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Startzeit</span>
            {showNativeInputs ? (
              <Input
                type="time"
                lang="de-DE"
                step={60}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            ) : (
              <Select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                <option value="">Bitte wählen…</option>
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Endzeit</span>
            {showNativeInputs ? (
              <Input
                type="time"
                lang="de-DE"
                step={60}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            ) : (
              <Select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                <option value="">Bitte wählen…</option>
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm text-gray-700">Notiz (optional)</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </label>

          <div className="sm:col-span-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={seriesEnabled}
                onChange={(e) => setSeriesEnabled(e.target.checked)}
              />
              <span>Als Serientermin</span>
            </label>
            {seriesEnabled ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Frequenz</span>
                  <Select
                    value={seriesFrequency}
                    onChange={(e) => setSeriesFrequency(e.target.value as "WEEKLY" | "BIWEEKLY")}
                  >
                    <option value="WEEKLY">Woechentlich</option>
                    <option value="BIWEEKLY">Alle 2 Wochen</option>
                  </Select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Wiederholen bis (Datum)</span>
                  <Input
                    type="date"
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                    required
                  />
                </label>
              </div>
            ) : null}
          </div>
      </div>

      <div>
        <Button
          type="button"
          onClick={submit}
          disabled={submitting || loading || !canSubmit}
          variant="outline"
          size="md"
          className="w-full sm:w-auto"
        >
          {submitting ? "Speichern…" : "Termin erstellen"}
        </Button>
        {formError ? <div className="mt-2 text-sm text-red-600">{formError}</div> : null}
      </div>
    </main>
  );
}
