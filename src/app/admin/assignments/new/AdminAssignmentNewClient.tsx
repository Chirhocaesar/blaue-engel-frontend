"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deDateToIso, formatDateTimeDE, isoToDeDate, makeTimeOptions } from "@/lib/datetime-de";
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

type CustomersPage = {
  items?: Customer[];
  nextCursor?: string | null;
};

type EmployeesResponse = Employee[];

function getCustomers(data: CustomersResponse): Customer[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
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
  const [seriesFrequency, setSeriesFrequency] = useState<"WEEKLY" | "BIWEEKLY">("BIWEEKLY");
  const [seriesSuccess, setSeriesSuccess] = useState<string | null>(null);
  const [seriesRepeatUntil, setSeriesRepeatUntil] = useState("");
  const [seriesRepeatUntilDe, setSeriesRepeatUntilDe] = useState("");
  const [seriesRepeatUntilTouched, setSeriesRepeatUntilTouched] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");

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
        const empRes = await fetch("/api/admin/employees", { cache: "no-store" });
        const empJson = await empRes.json().catch(() => []);

        let cursor: string | null = null;
        let allCustomers: Customer[] = [];
        for (let i = 0; i < 50; i += 1) {
          const url = new URL("/api/admin/customers", window.location.origin);
          url.searchParams.set("limit", "50");
          if (cursor) url.searchParams.set("cursor", cursor);
          const custRes = await fetch(url.toString(), { cache: "no-store" });
          const custJson = (await custRes.json().catch(() => ({}))) as CustomersPage;
          if (!custRes.ok) {
            throw new Error(
              `Kunden konnten nicht geladen werden (${(custJson as any)?.message || `HTTP ${custRes.status}`}).`
            );
          }
          const items = getCustomers(custJson as CustomersResponse);
          allCustomers = allCustomers.concat(items);
          if (!custJson?.nextCursor || items.length === 0) break;
          cursor = custJson.nextCursor ?? null;
        }

        if (!cancelled) {
          setEmployees(Array.isArray(empJson) ? empJson : []);
          setCustomers(allCustomers);
        }
      } catch (e: any) {
        if (!cancelled) {
          setCustomers([]);
          setCustomerLoadError(e?.message || "Kunden konnten nicht geladen werden.");
        }
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
    return baseReady && !!seriesRepeatUntil;
  }, [customerId, employeeId, date, startTime, endTime, seriesEnabled, seriesRepeatUntil]);

  useEffect(() => {
    if (canSubmit && formError) setFormError(null);
  }, [canSubmit, formError]);

  useEffect(() => {
    if (!seriesEnabled) {
      setSeriesRepeatUntilTouched(false);
      return;
    }
    if (date && !seriesRepeatUntil && !seriesRepeatUntilTouched) {
      const start = new Date(`${date}T00:00:00`);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
        const yyyy = end.getFullYear();
        const mm = String(end.getMonth() + 1).padStart(2, "0");
        const dd = String(end.getDate()).padStart(2, "0");
        const nextIso = `${yyyy}-${mm}-${dd}`;
        setSeriesRepeatUntil(nextIso);
        setSeriesRepeatUntilDe(isoToDeDate(nextIso));
      }
    }
  }, [seriesEnabled, date, seriesRepeatUntil]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const label = `${c.companyName || ""} ${c.name || ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [customerQuery, customers]);

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
      setError("Endzeit muss nach der Beginnzeit liegen.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = seriesEnabled ? "/api/admin/assignments/series" : "/api/admin/assignments";
      const payload = seriesEnabled
        ? (() => {
            if (!seriesRepeatUntil) {
              throw new Error("Bitte Enddatum angeben.");
            }
            const startDay = new Date(`${date}T00:00:00`);
            const repeatEnd = new Date(`${seriesRepeatUntil}T23:59:59.999`);
            const diffMs = repeatEnd.getTime() - startDay.getTime();
            if (Number.isNaN(diffMs) || diffMs < 0) {
              throw new Error("Enddatum muss nach dem Beginn liegen.");
            }
            const rangeDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (rangeDays > 90) {
              throw new Error("Serienzeitraum ist auf 3 Monate begrenzt.");
            }
            const intervalDays = seriesFrequency === "BIWEEKLY" ? 14 : 7;
            const recurringCount = Math.floor(rangeDays / intervalDays) + 1;
            if (recurringCount < 1 || recurringCount > 52) {
              throw new Error("Serienlänge ist ungültig (max 52 Termine).");
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
          const start = json?.conflictStartAt ? formatDateTimeDE(json.conflictStartAt) : "";
          const end = json?.conflictEndAt ? formatDateTimeDE(json.conflictEndAt) : "";
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
          <Input
            placeholder="Kunden suchen…"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            disabled={loading || customers.length === 0}
          />
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={loading || customers.length === 0}
          >
            <option value="">Bitte wählen…</option>
            {filteredCustomers.length === 0 ? (
              <option value="" disabled>
                Keine Kunden vorhanden
              </option>
            ) : null}
            {filteredCustomers.map((c) => (
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
            <span className="text-sm text-gray-700">Beginnzeit</span>
            {showNativeInputs ? (
              <Input
                type="time"
                lang="de-DE"
                step={1800}
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
                step={1800}
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
                  <span className="text-xs text-gray-600">Enddatum (max. 3 Monate)</span>
                  {showNativeInputs ? (
                    <Input
                      type="date"
                      value={seriesRepeatUntil}
                      onChange={(e) => {
                        setSeriesRepeatUntilTouched(true);
                        const nextIso = e.target.value;
                        setSeriesRepeatUntil(nextIso);
                        setSeriesRepeatUntilDe(isoToDeDate(nextIso));
                      }}
                    />
                  ) : (
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="TT.MM.JJJJ"
                      value={seriesRepeatUntilDe}
                      onChange={(e) => {
                        setSeriesRepeatUntilTouched(true);
                        const next = e.target.value;
                        setSeriesRepeatUntilDe(next);
                        const nextIso = deDateToIso(next);
                        if (nextIso) setSeriesRepeatUntil(nextIso);
                      }}
                    />
                  )}
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
