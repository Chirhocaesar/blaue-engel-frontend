"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { MetricCard, Panel, PanelHead, StatusBadge } from "@/components/ui";
import { cn } from "@/components/ui/cn";

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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint">
        {label}
      </span>
      <div className="font-medium text-ink">{children}</div>
    </div>
  );
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
    return <div className="text-sm text-muted">Lade…</div>;
  }

  if (error) {
    return (
      <Panel className="p-5">
        <div className="font-serif text-[17px] font-bold text-ink">Fehler</div>
        <div className="mt-1 text-sm text-muted">{error}</div>
        <div className="mt-4">
          <Link
            href="/admin/masterdata?tab=customers"
            className="inline-flex items-center gap-2 rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Zurück zu den Stammdaten
          </Link>
        </div>
      </Panel>
    );
  }

  if (!customer) {
    return (
      <Panel className="p-5">
        <div className="font-serif text-[17px] font-bold text-ink">Nicht gefunden</div>
      </Panel>
    );
  }

  const isActive = customer.isActive ?? true;

  return (
    <div className="flex flex-col gap-4">
      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/masterdata?tab=customers"
            className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-deep hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Stammdaten
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold leading-[1.1] text-ink">
              {customer.name || "Kunde"}
            </h1>
            <StatusBadge tone={isActive ? "green" : "gray"}>
              {isActive ? "Aktiv" : "Inaktiv"}
            </StatusBadge>
          </div>
          <div className="mt-1 text-[13.5px] text-muted">{customer.address || "—"}</div>
        </div>
      </div>

      {/* Stats */}
      {statsError ? (
        <div className="rounded-field border border-st-amber/20 bg-st-amber-bg px-3 py-2 text-sm text-st-amber">
          {statsError}
        </div>
      ) : null}
      {statsLoading ? (
        <div className="text-sm text-muted">Auswertung lädt…</div>
      ) : (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard accent="accent" label="Geplant (Std.)" value={(stats?.plannedHours ?? 0).toFixed(2)} />
          <MetricCard accent="green" label="Erledigt (Std.)" value={(stats?.doneHours ?? 0).toFixed(2)} />
          <MetricCard accent="blue" label="KM (Erledigt)" value={(stats?.doneKilometers ?? 0).toFixed(1)} />
          <MetricCard accent="ink" label="Einsätze gesamt" value={stats?.totalAssignments ?? 0} />
          <MetricCard accent="green" label="Einsätze erledigt" value={stats?.doneAssignments ?? 0} />
          <MetricCard
            accent="accent"
            label="Letzter Einsatz"
            value={
              <span className="text-[22px]">{formatDateLocal(stats?.lastAssignmentAt ?? null)}</span>
            }
          />
        </section>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_340px]">
        <Panel>
          <PanelHead title="Kundendaten" />
          <div className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
            <Field label="Name">{customer.name || "—"}</Field>
            <Field label="Telefon">{customer.phone || "—"}</Field>
            <Field label="Adresse" className="sm:col-span-2">
              <span className="whitespace-pre-line">{customer.address || "—"}</span>
            </Field>
            <Field label="Versicherungsnummer">{customer.insuranceNumber || "—"}</Field>
            <Field label="Krankenkasse">{customer.healthInsurance || "—"}</Field>
            <Field label="Pflegegrad">{customer.careLevel || "—"}</Field>
            <Field label="Geburtsdatum">{formatDateLocal(customer.birthDate ?? null)}</Field>
            <Field label="Kundentyp">
              {customer.customerType === "KASS"
                ? "Gesetzlich"
                : customer.customerType === "PRIVAT"
                  ? "Privat"
                  : "—"}
            </Field>
            <Field label="Status">
              <StatusBadge tone={isActive ? "green" : "gray"}>
                {isActive ? "Aktiv" : "Inaktiv"}
              </StatusBadge>
            </Field>
            <Field label="Admin-Notizen" className="sm:col-span-2">
              <div className="min-h-[56px] whitespace-pre-line rounded-field border border-line bg-tint px-3 py-2 font-normal">
                {customer.adminNotes || "—"}
              </div>
            </Field>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead title="Nächste Einsätze" titleClassName="text-[15px]" />
            {stats?.upcomingAssignments?.length ? (
              <div className="py-1">
                {stats.upcomingAssignments.map((a, i) => (
                  <div
                    key={a.id ?? `${a.startAt}-${a.endAt}`}
                    className={cn(
                      "flex items-center justify-between gap-3 px-5 py-[9px] text-[12.5px]",
                      i > 0 && "border-t border-line"
                    )}
                  >
                    <span className="min-w-0 truncate font-medium tabular-nums">
                      {`${formatDateLocal(a.startAt)} ${formatTimeLocal(a.startAt)}–${formatTimeLocal(a.endAt)}`}
                    </span>
                    <span className="min-w-0 truncate text-muted">{a.employeeName || "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-muted">Keine geplant.</div>
            )}
          </Panel>

          <Panel>
            <PanelHead title="Notfallkontakte" titleClassName="text-[15px]" />
            {contactsError ? (
              <div className="px-5 py-3 text-sm text-red-600">{contactsError}</div>
            ) : null}
            {contactsLoading ? (
              <div className="px-5 py-4 text-sm text-muted">Lade…</div>
            ) : contacts.length === 0 ? (
              <div className="px-5 py-4 text-sm text-muted">Keine Notfallkontakte hinterlegt.</div>
            ) : (
              <div className="py-1">
                {contacts.map((contact, i) => {
                  const tel = sanitizePhone(contact.phone || "");
                  return (
                    <div
                      key={contact.id}
                      className={cn(
                        "flex items-center justify-between gap-3 px-5 py-[10px]",
                        i > 0 && "border-t border-line"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-ink">
                          {contact.name}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {contact.relation ? `${contact.relation} · ` : ""}
                          {contact.phone || "—"}
                        </div>
                      </div>
                      {tel ? (
                        <a
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                          href={`tel:${tel}`}
                        >
                          <Phone className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Anrufen
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
