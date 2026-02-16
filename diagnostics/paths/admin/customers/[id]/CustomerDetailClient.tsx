"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  insuranceNumber?: string | null;
  healthInsurance?: string | null;
  careLevel?: string | null;
  birthDate?: string | null;
  customerType?: "KASS" | "PRIVAT" | null;
  adminNotes?: string | null;
  isActive?: boolean | null;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone?: string | null;
  relation?: string | null;
};

type UpcomingAssignment = {
  id?: string;
  startAt: string;
  endAt: string;
  employeeName?: string | null;
};

type CustomerStats = {
  plannedHours: number;
  doneHours: number;
  doneKilometers: number;
  totalAssignments: number;
  doneAssignments: number;
  lastAssignmentAt?: string | null;
  upcomingAssignments?: UpcomingAssignment[];
};

function formatDateLocal(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("de-DE");
}

function formatTimeLocal(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function getErrorMessage(status: number, json?: any) {
  if (status === 401) return "Bitte neu einloggen.";
  if (status === 403) return "Keine Berechtigung.";
  if (json?.message) return String(json.message);
  return `HTTP ${status}`;
}

function sanitizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export default function CustomerDetailClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  function applyCustomer(next: Customer) {
    setCustomer(next);
  }

  async function loadCustomer() {
    const res = await fetch(`/api/admin/customers/${id}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      applyCustomer(json as Customer);
      return;
    }

    if (res.status !== 404) {
      throw new Error(getErrorMessage(res.status, json));
    }

    let cursor: string | null = null;
    for (let i = 0; i < 50; i += 1) {
      const url = new URL("/api/admin/customers", window.location.origin);
      url.searchParams.set("limit", "50");
      url.searchParams.set("includeInactive", "1");
      if (cursor) url.searchParams.set("cursor", cursor);
      const listRes = await fetch(url.toString(), { cache: "no-store" });
      const listJson = await listRes.json().catch(() => ({}));
      if (!listRes.ok) break;
      const items = Array.isArray(listJson) ? listJson : listJson?.items ?? [];
      const found = (items as Customer[]).find((c) => c.id === id);
      if (found) {
        applyCustomer(found);
        return;
      }
      if (!listJson?.nextCursor || items.length === 0) break;
      cursor = listJson.nextCursor ?? null;
    }

    throw new Error(getErrorMessage(res.status, json));
  }

  async function loadContacts() {
    setContactsLoading(true);
    setContactsError(null);
    try {
      const res = await fetch(`/api/admin/customers/${id}/emergency-contacts`, { cache: "no-store" });
      const json = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      setContacts(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setContactsError(e?.message || "Notfallkontakte konnten nicht geladen werden.");
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`/api/admin/customers/${id}/stats`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      setStats(json as CustomerStats);
    } catch (e: any) {
      setStatsError(e?.message || "Auswertung konnte nicht geladen werden.");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCustomer(), loadContacts(), loadStats()]);
    } catch (e: any) {
      setError(e?.message || "Kunde konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadAll();
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);


  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <div className="text-sm text-gray-600">Lade…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-4">
        <Card className="p-4">
          <div className="font-semibold">Fehler</div>
          <div className="mt-1 text-sm text-gray-700">{error}</div>
          <div className="mt-4">
            <Link href="/admin/masterdata?tab=customers" className="rounded border px-3 py-2 text-sm inline-block">
              ← Zurück
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen p-4">
        <Card className="p-4">
          <div className="font-semibold">Nicht gefunden</div>
        </Card>
      </main>
    );
  }

  const isActive = customer.isActive ?? true;

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Kundendetails</h1>
            <div className="text-sm text-gray-600">{customer.name || "—"}</div>
          </div>
          <Link href="/admin/masterdata?tab=customers" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            ← Stammdaten
          </Link>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Auswertung</h2>
            {statsLoading ? <span className="text-sm text-gray-600">Lade…</span> : null}
          </div>
          {statsError ? <div className="mt-2 text-sm text-red-600">{statsError}</div> : null}
          {!statsLoading ? (
            <>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded border p-3">
                  <div className="text-gray-600">Geplant (Std.)</div>
                  <div className="text-lg font-semibold">{(stats?.plannedHours ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-600">Erledigt (Std.)</div>
                  <div className="text-lg font-semibold">{(stats?.doneHours ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-600">KM (Erledigt)</div>
                  <div className="text-lg font-semibold">{(stats?.doneKilometers ?? 0).toFixed(1)}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-600">Einsätze gesamt</div>
                  <div className="text-lg font-semibold">{stats?.totalAssignments ?? 0}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-600">Einsätze erledigt</div>
                  <div className="text-lg font-semibold">{stats?.doneAssignments ?? 0}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-600">Letzter Einsatz</div>
                  <div className="text-lg font-semibold">{formatDateLocal(stats?.lastAssignmentAt ?? null)}</div>
                </div>
              </div>

              <div className="mt-3 rounded border p-3 text-sm">
                <div className="text-gray-600">Nächste Einsätze</div>
                {stats?.upcomingAssignments?.length ? (
                  <div className="mt-2 space-y-1">
                    {stats.upcomingAssignments.map((a) => (
                      <div key={a.id ?? `${a.startAt}-${a.endAt}`} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate">
                          {`${formatDateLocal(a.startAt)} ${formatTimeLocal(a.startAt)}–${formatTimeLocal(a.endAt)}`}
                        </div>
                        <div className="min-w-0 truncate text-gray-600">
                          {a.employeeName || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-600">Keine geplant.</div>
                )}
              </div>
            </>
          ) : null}
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <h2 className="text-lg font-semibold">Kundendaten</h2>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Name</span>
              <div className="font-medium text-gray-900">{customer.name || "—"}</div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Telefon</span>
              <div className="font-medium text-gray-900">{customer.phone || "—"}</div>
            </div>

            <div className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600">Adresse</span>
              <div className="font-medium text-gray-900 whitespace-pre-line">{customer.address || "—"}</div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Versicherungsnummer</span>
              <div className="font-medium text-gray-900">{customer.insuranceNumber || "—"}</div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Krankenkasse</span>
              <div className="font-medium text-gray-900">{customer.healthInsurance || "—"}</div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Pflegegrad</span>
              <div className="font-medium text-gray-900">{customer.careLevel || "—"}</div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Geburtsdatum</span>
              <div className="font-medium text-gray-900">{formatDateLocal(customer.birthDate ?? null)}</div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Kundentyp</span>
              <div className="font-medium text-gray-900">
                {customer.customerType === "KASS"
                  ? "Gesetzlich"
                  : customer.customerType === "PRIVAT"
                    ? "Privat"
                    : "—"}
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-xs text-gray-600">Status</span>
              <div className="font-medium text-gray-900">{isActive ? "Aktiv" : "Inaktiv"}</div>
            </div>

            <div className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600">Admin-Notizen</span>
              <div className="min-h-[56px] rounded border bg-gray-50 px-3 py-2 text-gray-900 whitespace-pre-line">
                {customer.adminNotes || "—"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Notfallkontakte</h2>
          </div>
          {contactsError ? <div className="mt-2 text-sm text-red-600">{contactsError}</div> : null}

          {contactsLoading ? (
            <div className="mt-2 text-sm text-gray-600">Lade…</div>
          ) : contacts.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">Keine Notfallkontakte hinterlegt.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {contacts.map((contact) => {
                const tel = sanitizePhone(contact.phone || "");
                return (
                  <div
                    key={contact.id}
                    className="flex flex-col gap-2 rounded border bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{contact.name}</div>
                      <div className="text-xs text-gray-600">
                        {contact.relation ? `${contact.relation} · ` : ""}
                        {contact.phone || "—"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tel ? (
                        <a
                          className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                          href={`tel:${tel}`}
                        >
                          Anrufen
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
