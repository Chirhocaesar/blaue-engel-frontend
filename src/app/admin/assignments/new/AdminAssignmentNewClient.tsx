"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function AdminAssignmentNewClient() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCustomerLoadError(null);
      try {
        const [empRes, custRes] = await Promise.all([
          fetch("/api/admin/employees", { cache: "no-store" }),
          fetch("/api/admin/customers?limit=50", { cache: "no-store" }),
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
    return !!(customerId && employeeId && date && startTime && endTime);
  }, [customerId, employeeId, date, startTime, endTime]);

  useEffect(() => {
    if (canSubmit && formError) setFormError(null);
  }, [canSubmit, formError]);

  async function submit() {
    setError(null);
    setFormError(null);
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
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId,
          employeeId,
          startAt: startIso,
          endAt: endIso,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Fehler beim Erstellen");
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

      {customerLoadError ? (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          {customerLoadError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-600">Lade Daten…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Kunde</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
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
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Mitarbeiter</span>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Bitte wählen…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.fullName ? `${e.fullName} · ` : "") + e.email}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Datum</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Startzeit</span>
            <input
              type="time"
              lang="de-DE"
              step={60}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Endzeit</span>
            <input
              type="time"
              lang="de-DE"
              step={60}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm text-gray-700">Notiz (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded border px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || loading || !canSubmit}
          className="rounded-xl border px-4 py-3 text-base font-semibold"
        >
          {submitting ? "Speichern…" : "Termin erstellen"}
        </button>
        {formError ? <div className="mt-2 text-sm text-red-600">{formError}</div> : null}
      </div>
    </main>
  );
}
