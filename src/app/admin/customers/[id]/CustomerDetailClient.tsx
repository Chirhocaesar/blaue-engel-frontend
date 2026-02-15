"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

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
  customerType?: "STATUTORY" | "PRIVATE" | null;
  adminNotes?: string | null;
  isActive?: boolean | null;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone?: string | null;
  relation?: string | null;
};

type CustomerFormState = {
  name: string;
  address: string;
  phone: string;
  insuranceNumber: string;
  healthInsurance: string;
  careLevel: string;
  birthDate: string;
  customerType: "STATUTORY" | "PRIVATE" | "";
  adminNotes: string;
};

const emptyForm: CustomerFormState = {
  name: "",
  address: "",
  phone: "",
  insuranceNumber: "",
  healthInsurance: "",
  careLevel: "",
  birthDate: "",
  customerType: "",
  adminNotes: "",
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeBirthDate(value?: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
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
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRelation, setEditRelation] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    if (!contactSaved) return;
    const t = window.setTimeout(() => setContactSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [contactSaved]);

  function applyCustomer(next: Customer) {
    setCustomer(next);
    setForm({
      name: next.name ?? "",
      address: next.address ?? "",
      phone: next.phone ?? "",
      insuranceNumber: next.insuranceNumber ?? "",
      healthInsurance: next.healthInsurance ?? "",
      careLevel: next.careLevel ?? "",
      birthDate: toDateInput(next.birthDate),
      customerType: (next.customerType as "STATUTORY" | "PRIVATE" | null) ?? "",
      adminNotes: next.adminNotes ?? "",
    });
  }

  async function loadCustomer() {
    const res = await fetch(`/api/admin/customers/${id}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(res.status, json));
    applyCustomer(json as Customer);
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

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCustomer(), loadContacts()]);
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

  const canSave = useMemo(() => form.name.trim().length > 0, [form.name]);

  async function handleSaveCustomer(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!canSave) {
      setFormError("Bitte einen Namen angeben.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          insuranceNumber: form.insuranceNumber.trim() || undefined,
          healthInsurance: form.healthInsurance.trim() || undefined,
          careLevel: form.careLevel.trim() || undefined,
          birthDate: normalizeBirthDate(form.birthDate),
          customerType: form.customerType || undefined,
          adminNotes: form.adminNotes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      applyCustomer(json as Customer);
      setSaved(true);
    } catch (e: any) {
      setFormError(e?.message || "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCustomerActive(nextActive: boolean) {
    if (!customer) return;
    setToggleSaving(true);
    setError(null);
    try {
      const endpoint = nextActive ? "reactivate" : "deactivate";
      const res = await fetch(`/api/admin/customers/${id}/${endpoint}`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      setCustomer((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
    } catch (e: any) {
      setError(e?.message || "Status konnte nicht aktualisiert werden.");
    } finally {
      setToggleSaving(false);
    }
  }

  async function handleCreateContact(event: React.FormEvent) {
    event.preventDefault();
    setContactsError(null);
    const name = newName.trim();
    if (!name) {
      setContactsError("Name ist erforderlich.");
      return;
    }

    setContactSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/emergency-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: newPhone.trim() || undefined,
          relation: newRelation.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      setNewName("");
      setNewPhone("");
      setNewRelation("");
      setContactSaved(true);
      await loadContacts();
    } catch (e: any) {
      setContactsError(e?.message || "Notfallkontakt konnte nicht gespeichert werden.");
    } finally {
      setContactSaving(false);
    }
  }

  function startEdit(contact: EmergencyContact) {
    setEditId(contact.id);
    setEditName(contact.name || "");
    setEditPhone(contact.phone || "");
    setEditRelation(contact.relation || "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditPhone("");
    setEditRelation("");
    setEditError(null);
  }

  async function saveEdit(contactId: string) {
    const name = editName.trim();
    if (!name) {
      setEditError("Name ist erforderlich.");
      return;
    }

    setEditError(null);
    setContactSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/emergency-contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: editPhone.trim() || undefined,
          relation: editRelation.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      cancelEdit();
      setContactSaved(true);
      await loadContacts();
    } catch (e: any) {
      setEditError(e?.message || "Notfallkontakt konnte nicht gespeichert werden.");
    } finally {
      setContactSaving(false);
    }
  }

  async function deleteContact(contactId: string) {
    setContactsError(null);
    setContactSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/emergency-contacts/${contactId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(res.status, json));
      setContactSaved(true);
      await loadContacts();
    } catch (e: any) {
      setContactsError(e?.message || "Notfallkontakt konnte nicht gelöscht werden.");
    } finally {
      setContactSaving(false);
    }
  }

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
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <h2 className="text-lg font-semibold">Kundendaten</h2>
            {saved ? <span className="text-sm text-green-700">Gespeichert ✓</span> : null}
          </div>
          {formError ? <div className="mt-2 text-sm text-red-600">{formError}</div> : null}

          <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSaveCustomer}>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Name</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Telefon</span>
              <Input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600">Adresse</span>
              <Input
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Versicherungsnummer</span>
              <Input
                value={form.insuranceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, insuranceNumber: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Krankenkasse</span>
              <Input
                value={form.healthInsurance}
                onChange={(e) => setForm((prev) => ({ ...prev, healthInsurance: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Pflegegrad</span>
              <Input
                value={form.careLevel}
                onChange={(e) => setForm((prev) => ({ ...prev, careLevel: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Geburtsdatum</span>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Kundentyp</span>
              <Select
                value={form.customerType}
                onChange={(e) => setForm((prev) => ({ ...prev, customerType: e.target.value as CustomerFormState["customerType"] }))}
                disabled={saving}
              >
                <option value="">Bitte wählen…</option>
                <option value="STATUTORY">Gesetzlich</option>
                <option value="PRIVATE">Privat</option>
              </Select>
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600">Admin-Notizen</span>
              <Textarea
                rows={3}
                value={form.adminNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, adminNotes: e.target.value }))}
                disabled={saving}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <div className="text-sm text-gray-700">
                Status: {isActive ? "Aktiv" : "Inaktiv"}
              </div>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={saving || !canSave}
              >
                {saving ? "Speichern…" : "Speichern"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={toggleSaving}
                onClick={() => toggleCustomerActive(!isActive)}
              >
                {toggleSaving ? "Aktualisieren…" : isActive ? "Deaktivieren" : "Reaktivieren"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Notfallkontakte</h2>
            {contactSaved ? <span className="text-sm text-green-700">Gespeichert ✓</span> : null}
          </div>
          {contactsError ? <div className="mt-2 text-sm text-red-600">{contactsError}</div> : null}
          {editError ? <div className="mt-2 text-sm text-red-600">{editError}</div> : null}

          {contactsLoading ? (
            <div className="mt-2 text-sm text-gray-600">Lade…</div>
          ) : contacts.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">Keine Notfallkontakte hinterlegt.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {contacts.map((contact) => {
                const isEditing = editId === contact.id;
                const tel = sanitizePhone(contact.phone || "");
                return (
                  <div
                    key={contact.id}
                    className="flex flex-col gap-2 rounded border bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Input
                            className="text-sm"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={contactSaving}
                          />
                          <Input
                            className="text-sm"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            disabled={contactSaving}
                            placeholder="Telefon (optional)"
                          />
                          <Input
                            className="text-sm"
                            value={editRelation}
                            onChange={(e) => setEditRelation(e.target.value)}
                            disabled={contactSaving}
                            placeholder="Beziehung (optional)"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-medium truncate">{contact.name}</div>
                          <div className="text-xs text-gray-600">
                            {contact.relation ? `${contact.relation} · ` : ""}
                            {contact.phone || "—"}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tel && !isEditing ? (
                        <a
                          className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                          href={`tel:${tel}`}
                        >
                          Anrufen
                        </a>
                      ) : null}

                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                            disabled={contactSaving}
                            onClick={() => saveEdit(contact.id)}
                          >
                            {contactSaving ? "Speichern…" : "Speichern"}
                          </button>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                            disabled={contactSaving}
                            onClick={cancelEdit}
                          >
                            Abbrechen
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                            disabled={contactSaving}
                            onClick={() => startEdit(contact)}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                            disabled={contactSaving}
                            onClick={() => deleteContact(contact.id)}
                          >
                            Löschen
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" onSubmit={handleCreateContact}>
            <Input
              className="text-sm"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={contactSaving}
            />
            <Input
              className="text-sm"
              placeholder="Telefon (optional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              disabled={contactSaving}
            />
            <Input
              className="text-sm"
              placeholder="Beziehung (optional)"
              value={newRelation}
              onChange={(e) => setNewRelation(e.target.value)}
              disabled={contactSaving}
            />
            <div className="sm:col-span-3">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={contactSaving}
              >
                {contactSaving ? "Speichern…" : "Kontakt hinzufügen"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
