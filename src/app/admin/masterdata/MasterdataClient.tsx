"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button, Card, Input, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import StateNotice from "@/components/StateNotice";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  isActive?: boolean | null;
};

type Customer = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  insuranceNumber?: string | null;
  healthInsurance?: string | null;
  careLevel?: string | null;
  notes?: string | null;
  birthDate?: string | null;
  customerType?: "KASS" | "PRIVAT" | null;
  adminNotes?: string | null;
  isActive?: boolean | null;
};

function normalizeCustomerId(input: any): string {
  if (input?.id && typeof input.id === "string") return input.id;
  if (input?.customerId && typeof input.customerId === "string") return input.customerId;
  if (input?.customer?.id && typeof input.customer.id === "string") return input.customer.id;
  return "";
}

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation?: string | null;
};

type UsersResponse = AdminUser[] | { items?: AdminUser[] };

type CustomersResponse = { items?: Customer[] } | Customer[];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeBirthDate(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeCustomerType(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "KASS" || raw === "PRIVAT") return raw as "KASS" | "PRIVAT";
  if (raw === "STATUTORY") return "KASS";
  if (raw === "PRIVATE") return "PRIVAT";
  return undefined;
}

function getUsers(data: UsersResponse): AdminUser[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function getCustomers(data: CustomersResponse): Customer[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function sanitizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

type EmergencyContactsPanelProps = {
  customerId: string;
  contacts: EmergencyContact[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  saved: boolean;
  name: string;
  phone: string;
  relation: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onRelationChange: (value: string) => void;
  onCreate: (event?: React.SyntheticEvent) => Promise<void> | void;
  onDelete: (contactId: string) => Promise<void> | void;
  onUpdate: (contactId: string, payload: { name: string; phone: string; relation?: string }) => Promise<void> | void;
  onRefresh: (customerId: string) => Promise<void> | void;
};

function EmergencyContactsPanel({
  customerId,
  contacts,
  loading,
  error,
  saving,
  saved,
  name,
  phone,
  relation,
  onNameChange,
  onPhoneChange,
  onRelationChange,
  onCreate,
  onDelete,
  onUpdate,
  onRefresh,
}: EmergencyContactsPanelProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRelation, setEditRelation] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    void onRefresh(customerId);
  }, [customerId, onRefresh]);

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
    const nextName = editName.trim();
    const nextPhone = editPhone.trim();
    if (!nextName || !nextPhone) {
      setEditError("Name und Telefon sind erforderlich.");
      return;
    }
    setEditError(null);
    await onUpdate(contactId, {
      name: nextName,
      phone: nextPhone,
      relation: editRelation.trim() || undefined,
    });
    cancelEdit();
  }

  function handlePanelKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <Card variant="subtle" className="p-3 space-y-2" onKeyDown={handlePanelKeyDown}>
      <div className="font-serif text-[15px] font-bold text-ink">Notfallkontakte</div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      {saved ? <div className="text-xs text-st-green">Kontakt gespeichert ✓</div> : null}
      {editError ? <div className="text-xs text-red-600">{editError}</div> : null}
      {loading ? (
        <div className="text-sm text-muted">Lade…</div>
      ) : contacts.length === 0 ? (
        <div className="text-sm text-muted">Keine Notfallkontakte.</div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => {
            const tel = sanitizePhone(c.phone || "");
            const isEditing = editId === c.id;
            return (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-field border border-line bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input
                        className="text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={saving}
                      />
                      <Input
                        className="text-sm"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        disabled={saving}
                      />
                      <Input
                        className="text-sm"
                        value={editRelation}
                        onChange={(e) => setEditRelation(e.target.value)}
                        disabled={saving}
                        placeholder="Beziehung (optional)"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.relation ? `${c.relation} · ` : ""}{c.phone}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tel && !isEditing ? (
                    <a
                      className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                      href={`tel:${tel}`}
                    >
                      Anrufen
                    </a>
                  ) : null}
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                        disabled={saving}
                        onClick={() => saveEdit(c.id)}
                      >
                        {saving ? "Speichern…" : "Speichern"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                        disabled={saving}
                        onClick={cancelEdit}
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                        disabled={saving}
                        onClick={() => startEdit(c)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                        disabled={saving}
                        onClick={() => onDelete(c.id)}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input
          className="text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={saving}
        />
        <Input
          className="text-sm"
          placeholder="Telefon"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={saving}
        />
        <Input
          className="text-sm"
          placeholder="Beziehung (optional)"
          value={relation}
          onChange={(e) => onRelationChange(e.target.value)}
          disabled={saving}
        />
        <div className="sm:col-span-3">
          <button
            type="button"
            className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
            disabled={saving}
            onClick={(event) => onCreate(event)}
          >
            {saving ? "Speichern…" : "Kontakt hinzufügen"}
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function MasterdataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"employees" | "customers">("employees");

  function switchTab(next: "employees" | "customers") {
    setTab(next);
    // Keep the URL in sync so the sidebar highlights the right entry.
    router.replace(`/admin/masterdata?tab=${next}`, { scroll: false });
  }

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [includeInactiveEmployees, setIncludeInactiveEmployees] = useState(false);
  const [userToggleId, setUserToggleId] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [includeInactiveCustomers, setIncludeInactiveCustomers] = useState(false);
  const [customerToggleId, setCustomerToggleId] = useState<string | null>(null);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaved, setEditSaved] = useState(false);

  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empSaving, setEmpSaving] = useState(false);
  const [empSaved, setEmpSaved] = useState(false);
  const [empFormError, setEmpFormError] = useState<string | null>(null);

  const [custName, setCustName] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custInsuranceNumber, setCustInsuranceNumber] = useState("");
  const [custHealthInsurance, setCustHealthInsurance] = useState("");
  const [custCareLevel, setCustCareLevel] = useState("");
  const [custBirthDate, setCustBirthDate] = useState("");
  const [custType, setCustType] = useState<"KASS" | "PRIVAT">("KASS");
  const [custAdminNotes, setCustAdminNotes] = useState("");
  const [custSaving, setCustSaving] = useState(false);
  const [custSaved, setCustSaved] = useState(false);
  const [custFormError, setCustFormError] = useState<string | null>(null);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [createdCustomerName, setCreatedCustomerName] = useState<string>("");
  const missingCustomerIdWarned = useRef(false);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [ecLoading, setEcLoading] = useState(false);
  const [ecError, setEcError] = useState<string | null>(null);
  const [ecSaving, setEcSaving] = useState(false);
  const [ecSaved, setEcSaved] = useState(false);
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");

  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetSaved, setResetSaved] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [showEmployeeEditModal, setShowEmployeeEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<AdminUser | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpEmail, setEditEmpEmail] = useState("");
  const [editEmpSaving, setEditEmpSaving] = useState(false);
  const [editEmpError, setEditEmpError] = useState<string | null>(null);
  const [editEmpSaved, setEditEmpSaved] = useState(false);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const qs = includeInactiveEmployees ? "?includeInactive=1" : "";
      const res = await fetch(`/api/admin/users${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      setUsers(getUsers(json));
    } catch (e: any) {
      setUsersError(e?.message ?? "Mitarbeiter konnten nicht geladen werden.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadCustomers() {
    setCustomersLoading(true);
    setCustomersError(null);
    try {
      const allItems: Customer[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      while (true) {
        const qs = new URLSearchParams({ limit: "50" });
        if (includeInactiveCustomers) qs.set("includeInactive", "1");
        if (cursor) qs.set("cursor", cursor);

        const res = await fetch(`/api/admin/customers?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

        const pageItems = getCustomers(json).map((c) => ({
          ...c,
          id: normalizeCustomerId(c) || c.id,
        }));
        allItems.push(...pageItems);

        const nextCursor =
          typeof (json as { nextCursor?: unknown })?.nextCursor === "string" &&
          (json as { nextCursor?: string }).nextCursor
            ? (json as { nextCursor: string }).nextCursor
            : null;

        cursor = nextCursor;
        pageCount += 1;
        if (!cursor || pageCount >= 200) break;
      }

      const uniqueById = new Map<string, Customer>();
      for (const item of allItems) {
        if (!item.id) continue;
        if (!uniqueById.has(item.id)) uniqueById.set(item.id, item);
      }

      const items = Array.from(uniqueById.values());
      setCustomers(items);
    } catch (e: any) {
      setCustomersError(e?.message ?? "Kunden konnten nicht geladen werden.");
    } finally {
      setCustomersLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tab === "employees") {
        if (!cancelled) await loadUsers();
      } else {
        if (!cancelled) await loadCustomers();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, includeInactiveEmployees, includeInactiveCustomers]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "customers" || t === "employees") setTab(t);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!empSaved) return;
    const t = setTimeout(() => setEmpSaved(false), 2000);
    return () => clearTimeout(t);
  }, [empSaved]);

  useEffect(() => {
    if (!custSaved) return;
    const t = setTimeout(() => setCustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [custSaved]);

  useEffect(() => {
    if (!editSaved) return;
    const t = setTimeout(() => setEditSaved(false), 2000);
    return () => clearTimeout(t);
  }, [editSaved]);

  useEffect(() => {
    if (!ecSaved) return;
    const t = setTimeout(() => setEcSaved(false), 2000);
    return () => clearTimeout(t);
  }, [ecSaved]);

  useEffect(() => {
    if (!resetSaved) return;
    const t = setTimeout(() => setResetSaved(false), 2000);
    return () => clearTimeout(t);
  }, [resetSaved]);

  useEffect(() => {
    if (!editEmpSaved) return;
    const t = setTimeout(() => setEditEmpSaved(false), 2000);
    return () => clearTimeout(t);
  }, [editEmpSaved]);

  const userRows = useMemo(() => {
    return users.map((u) => ({
      id: u.id,
      name: u.fullName || "—",
      email: u.email || "—",
      raw: u,
    }));
  }, [users]);

  const normalizedSearchTerm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const filteredUserRows = useMemo(() => {
    if (!normalizedSearchTerm) return userRows;
    return userRows.filter((u) => {
      const values = [u.name, u.email, u.raw.phone ?? ""];
      return values.some((value) =>
        String(value ?? "").toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [userRows, normalizedSearchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!normalizedSearchTerm) return customers;
    return customers.filter((c) => {
      const values = [
        c.name,
        c.address,
        c.phone,
        c.insuranceNumber,
        c.notes,
        c.adminNotes,
      ];
      return values.some((value) =>
        String(value ?? "").toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [customers, normalizedSearchTerm]);

  const empNameTrim = empName.trim();
  const empEmailTrim = empEmail.trim();
  const empPasswordTrim = empPassword.trim();
  const empFormValid = empNameTrim.length > 0 && empEmailTrim.length > 0 && empPasswordTrim.length > 0;

  const custNameTrim = custName.trim();
  const custAddressTrim = custAddress.trim();
  const custPhoneTrim = custPhone.trim();
  const custFormValid =
    custNameTrim.length > 0 && custAddressTrim.length > 0 && custPhoneTrim.length > 0;

  async function loadCustomerDetail(customerId: string) {
    const res = await fetch(`/api/admin/customers/${customerId}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
    const normalized = { ...(json as Customer) };
    normalized.customerType = normalizeCustomerType(normalized.customerType) ?? normalized.customerType;
    return normalized as Customer;
  }

  const loadEmergencyContacts = useCallback(async (customerId?: string) => {
    const targetId = customerId || editingCustomer?.id || createdCustomerId;
    if (!targetId) return;
    setEcLoading(true);
    setEcError(null);
    try {
      const res = await fetch(
        `/api/admin/customers/${targetId}/emergency-contacts`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      setEmergencyContacts(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setEcError(e?.message ?? "Notfallkontakte konnten nicht geladen werden.");
      setEmergencyContacts([]);
    } finally {
      setEcLoading(false);
    }
  }, [editingCustomer?.id, createdCustomerId]);

  async function submitEmployee(e: React.FormEvent) {
    e.preventDefault();
    setEmpFormError(null);
    if (!empFormValid) {
      setEmpFormError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setEmpSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: empNameTrim,
          email: empEmailTrim,
          password: empPasswordTrim,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      setShowEmployeeModal(false);
      setEmpName("");
      setEmpEmail("");
      setEmpPassword("");
      setEmpSaved(true);
      await loadUsers();
    } catch (e: any) {
      setEmpFormError(e?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setEmpSaving(false);
    }
  }

  async function submitCustomer(e: React.FormEvent) {
    e.preventDefault();
    setCustFormError(null);
    if (!custFormValid) {
      setCustFormError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setCustSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: custNameTrim,
          address: custAddressTrim,
          phone: custPhoneTrim,
          insuranceNumber: custInsuranceNumber.trim() || undefined,
          healthInsurance: custHealthInsurance.trim() || undefined,
          careLevel: custCareLevel.trim() || undefined,
          birthDate: normalizeBirthDate(custBirthDate),
          customerType: normalizeCustomerType(custType) ?? custType,
          adminNotes: custAdminNotes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      const createdId = json?.id ? String(json.id) : null;
      setCreatedCustomerId(createdId);
      setCreatedCustomerName(json?.name ? String(json.name) : custNameTrim);
      setEmergencyContacts([]);
      setEcError(null);
      setEcName("");
      setEcPhone("");
      setEcRelation("");
      if (createdId) {
        await loadEmergencyContacts(createdId);
      }
      setCustSaved(true);
      await loadCustomers();
    } catch (e: any) {
      setCustFormError(e?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setCustSaving(false);
    }
  }

  async function openEditCustomer(customerId: string) {
    setEditError(null);
    setEditLoading(true);
    setShowCustomerEditModal(true);
    setCreatedCustomerId(null);
    setCreatedCustomerName("");
    try {
      const customer = await loadCustomerDetail(customerId);
      setEditingCustomer(customer);
      await loadEmergencyContacts(customerId);
    } catch (e: any) {
      setEditError(e?.message ?? "Kunde konnte nicht geladen werden.");
      setEditingCustomer(null);
      setEmergencyContacts([]);
    } finally {
      setEditLoading(false);
    }
  }

  async function submitCustomerUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCustomer.name?.trim() || undefined,
          address: editingCustomer.address ?? undefined,
          phone: editingCustomer.phone ?? undefined,
          insuranceNumber: editingCustomer.insuranceNumber ?? undefined,
          healthInsurance: editingCustomer.healthInsurance ?? undefined,
          careLevel: editingCustomer.careLevel ?? undefined,
          birthDate: normalizeBirthDate(editingCustomer.birthDate),
          customerType: normalizeCustomerType(editingCustomer.customerType) ?? undefined,
          adminNotes: editingCustomer.adminNotes ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      setEditSaved(true);
      await loadCustomers();
    } catch (e: any) {
      setEditError(e?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setEditSaving(false);
    }
  }

  async function submitEmergencyContact(e?: React.SyntheticEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetId = editingCustomer?.id || createdCustomerId;
    if (!targetId) return;
    setEcError(null);
    const name = ecName.trim();
    const phone = ecPhone.trim();
    if (!name || !phone) {
      setEcError("Name und Telefon sind erforderlich.");
      return;
    }
    setEcSaving(true);
    try {
      const res = await fetch(
        `/api/admin/customers/${targetId}/emergency-contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            relation: ecRelation.trim() || undefined,
          }),
          cache: "no-store",
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      const nextContact = json && typeof json === "object" && !Array.isArray(json) ? json : null;
      if (Array.isArray(json)) {
        setEmergencyContacts(json as EmergencyContact[]);
      } else if (nextContact?.id) {
        setEmergencyContacts((prev) => [
          ...prev,
          {
            id: String(nextContact.id),
            name: String(nextContact.name ?? name),
            phone: String(nextContact.phone ?? phone),
            relation: nextContact.relation ?? (ecRelation.trim() || undefined),
          },
        ]);
      }
      await loadEmergencyContacts(targetId);
      setEcName("");
      setEcPhone("");
      setEcRelation("");
      setTab("customers");
      setEcSaved(true);
    } catch (e: any) {
      setEcError(e?.message ?? "Notfallkontakt konnte nicht gespeichert werden.");
    } finally {
      setEcSaving(false);
    }
  }

  async function deleteEmergencyContact(contactId: string) {
    const targetId = editingCustomer?.id || createdCustomerId;
    if (!targetId) return;
    setEcError(null);
    setEcSaving(true);
    setEmergencyContacts((prev) => prev.filter((c) => c.id !== contactId));
    try {
      const res = await fetch(
        `/api/admin/customers/${targetId}/emergency-contacts/${contactId}`,
        { method: "DELETE", cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      await loadEmergencyContacts(targetId);
      setEcSaved(true);
    } catch (e: any) {
      setEcError(e?.message ?? "Notfallkontakt konnte nicht gelöscht werden.");
      await loadEmergencyContacts(targetId);
    } finally {
      setEcSaving(false);
    }
  }

  async function updateEmergencyContact(
    contactId: string,
    payload: { name: string; phone: string; relation?: string }
  ) {
    const targetId = editingCustomer?.id || createdCustomerId;
    if (!targetId) return;
    setEcError(null);
    setEcSaving(true);
    setEmergencyContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, ...payload } : c))
    );
    try {
      const res = await fetch(
        `/api/admin/customers/${targetId}/emergency-contacts/${contactId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      await loadEmergencyContacts(targetId);
      setEcSaved(true);
    } catch (e: any) {
      setEcError(e?.message ?? "Notfallkontakt konnte nicht gespeichert werden.");
      await loadEmergencyContacts(targetId);
    } finally {
      setEcSaving(false);
    }
  }

  async function submitResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    if (!resetUser) return;

    const nextPassword = resetPassword.trim();
    if (nextPassword.length < 6) {
      setResetError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (nextPassword !== resetConfirm.trim()) {
      setResetError("Passwörter stimmen nicht überein.");
      return;
    }

    setResetSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nextPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      setResetSaved(true);
      setResetUser(null);
      setResetPassword("");
      setResetConfirm("");
    } catch (e: any) {
      setResetError(e?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setResetSaving(false);
    }
  }

  function openEmployeeEdit(user: AdminUser) {
    setEditEmpError(null);
    setEditingEmployee(user);
    setEditEmpName(user.fullName || "");
    setEditEmpEmail(user.email || "");
    setShowEmployeeEditModal(true);
  }

  async function submitEmployeeEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee || editEmpSaving) return;
    setEditEmpError(null);

    const name = editEmpName.trim();
    const email = editEmpEmail.trim();

    if (!name) {
      setEditEmpError("Bitte einen Namen angeben.");
      return;
    }
    if (!email || !emailPattern.test(email)) {
      setEditEmpError("Bitte eine gueltige E-Mail angeben.");
      return;
    }

    setEditEmpSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

      setShowEmployeeEditModal(false);
      setEditingEmployee(null);
      setEditEmpSaved(true);
      await loadUsers();
    } catch (e: any) {
      setEditEmpError(e?.message || "Speichern fehlgeschlagen.");
    } finally {
      setEditEmpSaving(false);
    }
  }

  async function deactivateUser(user: AdminUser) {
    if (!user?.id) return;
    setUserToggleId(user.id);
    setUsersError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/deactivate`, {
        method: "PATCH",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      if (includeInactiveEmployees) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u))
        );
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      }
    } catch (e: any) {
      setUsersError(e?.message ?? "Mitarbeiter konnte nicht deaktiviert werden.");
    } finally {
      setUserToggleId(null);
    }
  }

  async function reactivateUser(user: AdminUser) {
    if (!user?.id) return;
    setUserToggleId(user.id);
    setUsersError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reactivate`, {
        method: "PATCH",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: true } : u))
      );
    } catch (e: any) {
      setUsersError(e?.message ?? "Mitarbeiter konnte nicht reaktiviert werden.");
    } finally {
      setUserToggleId(null);
    }
  }

  async function deactivateCustomer(customer: Customer) {
    if (!customer?.id) return;
    setCustomerToggleId(customer.id);
    setCustomersError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/deactivate`, {
        method: "PATCH",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      if (includeInactiveCustomers) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === customer.id ? { ...c, isActive: false } : c))
        );
      } else {
        setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      }
    } catch (e: any) {
      setCustomersError(e?.message ?? "Kunde konnte nicht deaktiviert werden.");
    } finally {
      setCustomerToggleId(null);
    }
  }

  async function reactivateCustomer(customer: Customer) {
    if (!customer?.id) return;
    setCustomerToggleId(customer.id);
    setCustomersError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/reactivate`, {
        method: "PATCH",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, isActive: true } : c))
      );
    } catch (e: any) {
      setCustomersError(e?.message ?? "Kunde konnte nicht reaktiviert werden.");
    } finally {
      setCustomerToggleId(null);
    }
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] text-ink">Stammdaten</h1>
          <p className="mt-1 text-[13.5px] text-muted">Mitarbeiter und Kunden verwalten.</p>
        </div>
        {tab === "employees" ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-field bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(18,18,18,.5)] hover:bg-black"
            onClick={() => {
              setEmpFormError(null);
              setShowEmployeeModal(true);
            }}
          >
            <Plus className="h-4 w-4 text-accent" strokeWidth={2} />
            Mitarbeiter
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-field bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(18,18,18,.5)] hover:bg-black"
            onClick={() => {
              setCustFormError(null);
              setCreatedCustomerId(null);
              setCreatedCustomerName("");
              setEmergencyContacts([]);
              setEcError(null);
              setEcName("");
              setEcPhone("");
              setEcRelation("");
              setShowCustomerModal(true);
            }}
          >
            <Plus className="h-4 w-4 text-accent" strokeWidth={2} />
            Kunde
          </button>
        )}
      </div>

      <Panel className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="inline-flex rounded-field border border-line bg-tint p-1">
          <button
            type="button"
            className={cn(
              "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors sm:px-4",
              tab === "employees" ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"
            )}
            onClick={() => switchTab("employees")}
          >
            Mitarbeiter
          </button>
          <button
            type="button"
            className={cn(
              "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors sm:px-4",
              tab === "customers" ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"
            )}
            onClick={() => switchTab("customers")}
          >
            Kunden
          </button>
        </div>

        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" strokeWidth={1.8} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={tab === "customers" ? "Kunden durchsuchen…" : "Mitarbeiter durchsuchen…"}
            className="pl-9"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-accent-deep)]"
            checked={tab === "employees" ? includeInactiveEmployees : includeInactiveCustomers}
            onChange={(e) =>
              tab === "employees"
                ? setIncludeInactiveEmployees(e.target.checked)
                : setIncludeInactiveCustomers(e.target.checked)
            }
          />
          Inaktive anzeigen
        </label>

        {(tab === "employees" && (empSaved || resetSaved || editEmpSaved)) ||
        (tab === "customers" && custSaved) ? (
          <span className="text-sm font-medium text-st-green">Gespeichert ✓</span>
        ) : null}
      </Panel>

      {tab === "employees" ? (
        <section className="space-y-3">
          {usersError ? (
            <StateNotice variant="error" message={usersError} />
          ) : null}

          {usersLoading ? (
            <StateNotice variant="loading" message="Lade…" />
          ) : filteredUserRows.length === 0 ? (
            <StateNotice variant="empty" message="Keine Eintraege vorhanden." />
          ) : (
            <>
              <div className="space-y-3 sm:hidden max-h-[60vh] overflow-auto">
                {filteredUserRows.map((u) => (
                  <Card key={u.id} className="space-y-2">
                    <div>
                      <div className="text-xs font-medium text-muted">Name</div>
                      <div className="flex items-center gap-2 font-semibold text-ink">
                        <span>{u.name}</span>
                        {includeInactiveEmployees && u.raw.isActive === false ? (
                          <StatusBadge tone="gray">Inaktiv</StatusBadge>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted">E-Mail</div>
                      <div>{u.email}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openEmployeeEdit(u.raw)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setResetError(null);
                        setResetUser(u.raw);
                        setResetPassword("");
                        setResetConfirm("");
                      }}
                    >
                      Passwort zuruecksetzen
                    </Button>
                    {includeInactiveEmployees && u.raw.isActive === false ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={userToggleId === u.id}
                        onClick={() => reactivateUser(u.raw)}
                      >
                        {userToggleId === u.id ? "Reaktivieren…" : "Reaktivieren"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={userToggleId === u.id}
                        onClick={() => deactivateUser(u.raw)}
                      >
                        {userToggleId === u.id ? "Deaktivieren…" : "Deaktivieren"}
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
              <Panel className="hidden max-h-[60vh] overflow-auto sm:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Name</th>
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">E-Mail</th>
                      {includeInactiveEmployees ? (
                        <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Status</th>
                      ) : null}
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserRows.map((u) => (
                      <tr key={u.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-tint-hover">
                        <td className="border-b border-line px-5 py-3.5 font-semibold text-ink">{u.name}</td>
                        <td className="border-b border-line px-5 py-3.5">{u.email}</td>
                        {includeInactiveEmployees ? (
                          <td className="border-b border-line px-5 py-3.5">
                            {u.raw.isActive === false ? (
                              <StatusBadge tone="gray">Inaktiv</StatusBadge>
                            ) : (
                              <StatusBadge tone="green">Aktiv</StatusBadge>
                            )}
                          </td>
                        ) : null}
                        <td className="border-b border-line px-5 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                              onClick={() => openEmployeeEdit(u.raw)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                              onClick={() => {
                                setResetError(null);
                                setResetUser(u.raw);
                                setResetPassword("");
                                setResetConfirm("");
                              }}
                            >
                              Passwort zurücksetzen
                            </button>
                            {includeInactiveEmployees && u.raw.isActive === false ? (
                              <button
                                type="button"
                                className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                                disabled={userToggleId === u.id}
                                onClick={() => reactivateUser(u.raw)}
                              >
                                {userToggleId === u.id ? "Reaktivieren…" : "Reaktivieren"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                                disabled={userToggleId === u.id}
                                onClick={() => deactivateUser(u.raw)}
                              >
                                {userToggleId === u.id ? "Deaktivieren…" : "Deaktivieren"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {customersError ? (
            <StateNotice variant="error" message={customersError} />
          ) : null}

          {customersLoading ? (
            <StateNotice variant="loading" message="Lade…" />
          ) : filteredCustomers.length === 0 ? (
            <StateNotice variant="empty" message="Keine Eintraege vorhanden." />
          ) : (
            <>
              <div className="space-y-3 sm:hidden max-h-[60vh] overflow-auto">
                {filteredCustomers.map((c) => (
                  <Card
                    key={c.id}
                    className="space-y-2 cursor-pointer"
                    role="link"
                    tabIndex={0}
                    onClick={() => {
                      if (!c.id) {
                        if (!missingCustomerIdWarned.current) {
                          console.warn("Customer list entry missing id", c);
                          missingCustomerIdWarned.current = true;
                        }
                        return;
                      }
                      router.push(`/admin/customers/${c.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!c.id) {
                          if (!missingCustomerIdWarned.current) {
                            console.warn("Customer list entry missing id", c);
                            missingCustomerIdWarned.current = true;
                          }
                          return;
                        }
                        router.push(`/admin/customers/${c.id}`);
                      }
                    }}
                  >
                    <div>
                      <div className="text-xs font-medium text-muted">Name</div>
                      <div className="flex items-center gap-2 font-semibold text-ink">
                        <span>{c.name}</span>
                        {!c.id ? (
                          <span className="rounded-full border border-red-300 px-2 py-0.5 text-xs text-red-700">
                            Fehlende ID
                          </span>
                        ) : null}
                        {includeInactiveCustomers && c.isActive === false ? (
                          <StatusBadge tone="gray">Inaktiv</StatusBadge>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted">Adresse</div>
                      <div>{c.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted">Telefon</div>
                      <div>{c.phone || "—"}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCustomer(c.id);
                      }}
                    >
                      Bearbeiten
                    </Button>
                    {includeInactiveCustomers && c.isActive === false ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={customerToggleId === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          reactivateCustomer(c);
                        }}
                      >
                        {customerToggleId === c.id ? "Reaktivieren…" : "Reaktivieren"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={customerToggleId === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          deactivateCustomer(c);
                        }}
                      >
                        {customerToggleId === c.id ? "Deaktivieren…" : "Deaktivieren"}
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
              <Panel className="hidden max-h-[60vh] overflow-auto sm:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Name</th>
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Adresse</th>
                      {includeInactiveCustomers ? (
                        <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Status</th>
                      ) : null}
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Telefon</th>
                      <th className="border-b border-line bg-tint px-5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-faint">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-tint-hover">
                        <td className="border-b border-line px-5 py-3.5">
                          {c.id ? (
                            <Link
                              href={`/admin/customers/${c.id}`}
                              className="font-semibold text-ink hover:text-accent-deep hover:underline"
                            >
                              {c.name}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">{c.name}</span>
                              <span className="rounded-full border border-red-300 px-2 py-0.5 text-xs text-red-700">
                                Fehlende ID
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-line px-5 py-3.5">{c.address || "—"}</td>
                        {includeInactiveCustomers ? (
                          <td className="border-b border-line px-5 py-3.5">
                            {c.isActive === false ? (
                              <StatusBadge tone="gray">Inaktiv</StatusBadge>
                            ) : (
                              <StatusBadge tone="green">Aktiv</StatusBadge>
                            )}
                          </td>
                        ) : null}
                        <td className="border-b border-line px-5 py-3.5">{c.phone || "—"}</td>
                        <td className="border-b border-line px-5 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                              onClick={() => openEditCustomer(c.id)}
                            >
                              Bearbeiten
                            </button>
                            {includeInactiveCustomers && c.isActive === false ? (
                              <button
                                type="button"
                                className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                                disabled={customerToggleId === c.id}
                                onClick={() => reactivateCustomer(c)}
                              >
                                {customerToggleId === c.id ? "Reaktivieren…" : "Reaktivieren"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep disabled:opacity-60"
                                disabled={customerToggleId === c.id}
                                onClick={() => deactivateCustomer(c)}
                              >
                                {customerToggleId === c.id ? "Deaktivieren…" : "Deaktivieren"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </>
          )}
        </section>
      )}

      {showEmployeeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-card max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold text-ink">Mitarbeiter hinzufügen</h3>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => setShowEmployeeModal(false)}
              >
                Schließen
              </button>
            </div>

            {empFormError ? (
              <div className="mt-3 rounded-field border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {empFormError}
              </div>
            ) : null}

            <form className="mt-3 space-y-3" onSubmit={submitEmployee}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  required
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Passwort</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                  onClick={() => setShowEmployeeModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-field bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={empSaving || !empFormValid}
                >
                  {empSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showEmployeeEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-card max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold text-ink">Mitarbeiter bearbeiten</h3>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => {
                  setShowEmployeeEditModal(false);
                  setEditingEmployee(null);
                }}
              >
                Schliessen
              </button>
            </div>

            {editEmpError ? (
              <div className="mt-3 rounded-field border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editEmpError}
              </div>
            ) : null}

            <form className="mt-3 space-y-3" onSubmit={submitEmployeeEdit}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  required
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                  onClick={() => {
                    setShowEmployeeEditModal(false);
                    setEditingEmployee(null);
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-field bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={editEmpSaving}
                >
                  {editEmpSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCustomerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-card max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold text-ink">Kunde hinzufügen</h3>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => {
                  setShowCustomerModal(false);
                  setCreatedCustomerId(null);
                  setCreatedCustomerName("");
                  setEmergencyContacts([]);
                  setEcError(null);
                }}
              >
                Schließen
              </button>
            </div>

            {custFormError ? (
              <div className="mt-3 rounded-field border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {custFormError}
              </div>
            ) : null}

            {createdCustomerId ? (
              <div className="mt-3 rounded-field border border-st-green/20 bg-st-green-bg px-3 py-2 text-sm text-st-green">
                Kunde erstellt ✓ {createdCustomerName ? `(${createdCustomerName})` : ""}
              </div>
            ) : null}

            <form className="mt-3 space-y-3" onSubmit={submitCustomer}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  disabled={custSaving || Boolean(createdCustomerId)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Adresse</label>
                <Input
                  required
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  disabled={custSaving || Boolean(createdCustomerId)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  disabled={custSaving || Boolean(createdCustomerId)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Versicherungsnummer</label>
                  <Input
                    value={custInsuranceNumber}
                    onChange={(e) => setCustInsuranceNumber(e.target.value)}
                    disabled={custSaving || Boolean(createdCustomerId)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Krankenkasse</label>
                  <Input
                    value={custHealthInsurance}
                    onChange={(e) => setCustHealthInsurance(e.target.value)}
                    disabled={custSaving || Boolean(createdCustomerId)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Pflegegrad</label>
                  <Input
                    value={custCareLevel}
                    onChange={(e) => setCustCareLevel(e.target.value)}
                    disabled={custSaving || Boolean(createdCustomerId)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Geburtsdatum</label>
                  <Input
                    type="date"
                    value={custBirthDate}
                    onChange={(e) => setCustBirthDate(e.target.value)}
                    disabled={custSaving || Boolean(createdCustomerId)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Kundentyp</label>
                  <Select
                    value={custType}
                    onChange={(e) => setCustType(e.target.value as "KASS" | "PRIVAT")}
                    disabled={custSaving || Boolean(createdCustomerId)}
                  >
                    <option value="KASS">Kasse</option>
                    <option value="PRIVAT">Privat</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Admin-Info / Notizen</label>
                <Textarea
                  rows={3}
                  value={custAdminNotes}
                  onChange={(e) => setCustAdminNotes(e.target.value)}
                  disabled={custSaving || Boolean(createdCustomerId)}
                />
              </div>

              <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t border-line bg-card px-5 py-3">
                <button
                  type="button"
                  className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                  onClick={() => setShowCustomerModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-field bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={custSaving || !custFormValid || Boolean(createdCustomerId)}
                >
                  {custSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>

            {createdCustomerId ? (
              <div className="mt-4">
                <EmergencyContactsPanel
                  customerId={createdCustomerId}
                  contacts={emergencyContacts}
                  loading={ecLoading}
                  error={ecError}
                  saving={ecSaving}
                  saved={ecSaved}
                  name={ecName}
                  phone={ecPhone}
                  relation={ecRelation}
                  onNameChange={setEcName}
                  onPhoneChange={setEcPhone}
                  onRelationChange={setEcRelation}
                  onCreate={submitEmergencyContact}
                  onDelete={deleteEmergencyContact}
                  onUpdate={updateEmergencyContact}
                  onRefresh={loadEmergencyContacts}
                />
              </div>
            ) : null}

            {createdCustomerId ? (
              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                  onClick={() => {
                    setShowCustomerModal(false);
                    setCreatedCustomerId(null);
                    setCreatedCustomerName("");
                    setEmergencyContacts([]);
                    setEcError(null);
                  }}
                >
                  Fertig
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCustomerEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-2xl rounded-card border border-line bg-card p-5 shadow-card max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold text-ink">Kunde bearbeiten</h3>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => {
                  setShowCustomerEditModal(false);
                  setEditingCustomer(null);
                  setEmergencyContacts([]);
                  setEcError(null);
                }}
              >
                Schließen
              </button>
            </div>

            {editError ? (
              <div className="mt-3 rounded-field border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            {editSaved ? <div className="mt-2 text-sm text-st-green">Gespeichert ✓</div> : null}

            {editLoading ? (
              <div className="mt-3 text-sm text-muted">Lade…</div>
            ) : editingCustomer ? (
              <form className="mt-3 space-y-3" onSubmit={submitCustomerUpdate}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={editingCustomer.name ?? ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Telefon</label>
                    <Input
                      value={editingCustomer.phone ?? ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          phone: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium">Adresse</label>
                    <Input
                      value={editingCustomer.address ?? ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          address: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Versicherungsnummer</label>
                    <Input
                      value={editingCustomer.insuranceNumber ?? ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          insuranceNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Krankenkasse</label>
                    <Input
                      value={editingCustomer.healthInsurance ?? ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          healthInsurance: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Pflegegrad</label>
                    <Input
                      value={editingCustomer.careLevel ?? ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          careLevel: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Geburtsdatum</label>
                    <Input
                      type="date"
                      value={(editingCustomer.birthDate ?? "").slice(0, 10)}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          birthDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kundentyp</label>
                    <Select
                      value={editingCustomer.customerType ?? "KASS"}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          customerType: e.target.value as "KASS" | "PRIVAT",
                        })
                      }
                    >
                      <option value="KASS">Kasse</option>
                      <option value="PRIVAT">Privat</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Admin-Info / Notizen</label>
                  <Textarea
                    rows={3}
                    value={editingCustomer.adminNotes ?? ""}
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        adminNotes: e.target.value,
                      })
                    }
                  />
                </div>

                {editingCustomer?.id ? (
                  <EmergencyContactsPanel
                    customerId={editingCustomer.id}
                    contacts={emergencyContacts}
                    loading={ecLoading}
                    error={ecError}
                    saving={ecSaving}
                    saved={ecSaved}
                    name={ecName}
                    phone={ecPhone}
                    relation={ecRelation}
                    onNameChange={setEcName}
                    onPhoneChange={setEcPhone}
                    onRelationChange={setEcRelation}
                    onCreate={submitEmergencyContact}
                    onDelete={deleteEmergencyContact}
                    onUpdate={updateEmergencyContact}
                    onRefresh={loadEmergencyContacts}
                  />
                ) : null}

                <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t border-line bg-card px-5 py-3">
                  <button
                    type="button"
                    className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                    onClick={() => setShowCustomerEditModal(false)}
                  >
                    Schließen
                  </button>
                  <button
                    type="submit"
                    className="rounded-field bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={editSaving}
                  >
                    {editSaving ? "Speichern…" : "Speichern"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-card max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold text-ink">Passwort zurücksetzen</h3>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => setResetUser(null)}
              >
                Schließen
              </button>
            </div>

            <div className="mt-1 text-xs text-muted">
              {resetUser.fullName || resetUser.email || "Mitarbeiter"}
            </div>

            {resetError ? (
              <div className="mt-3 rounded-field border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {resetError}
              </div>
            ) : null}

            <form className="mt-3 space-y-3" onSubmit={submitResetPassword}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Neues Passwort</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Passwort bestätigen</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-field border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                  onClick={() => setResetUser(null)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-field bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={resetSaving}
                >
                  {resetSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
