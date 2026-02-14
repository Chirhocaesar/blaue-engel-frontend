"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  email?: string | null;
  fullName?: string | null;
};

type Customer = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  insuranceNumber?: string | null;
  healthInsurance?: string | null;
  careLevel?: string | null;
  birthDate?: string | null;
  customerType?: "STATUTORY" | "PRIVATE" | null;
  adminNotes?: string | null;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation?: string | null;
};

type UsersResponse = AdminUser[] | { items?: AdminUser[] };

type CustomersResponse = { items?: Customer[] } | Customer[];

function normalizeBirthDate(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function getUsers(data: UsersResponse): AdminUser[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function getCustomers(data: CustomersResponse): Customer[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

export default function MasterdataPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"employees" | "customers">("employees");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
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
  const [custType, setCustType] = useState<"STATUTORY" | "PRIVATE">("STATUTORY");
  const [custAdminNotes, setCustAdminNotes] = useState("");
  const [custSaving, setCustSaving] = useState(false);
  const [custSaved, setCustSaved] = useState(false);
  const [custFormError, setCustFormError] = useState<string | null>(null);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [createdCustomerName, setCreatedCustomerName] = useState<string>("");

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

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
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
      const res = await fetch("/api/admin/customers?limit=50", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      setCustomers(getCustomers(json));
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
  }, [tab]);

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

  const userRows = useMemo(() => {
    return users.map((u) => ({
      id: u.id,
      name: u.fullName || "—",
      email: u.email || "—",
      raw: u,
    }));
  }, [users]);

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
    return json as Customer;
  }

  async function loadEmergencyContacts(customerId?: string) {
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
  }

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
          customerType: custType,
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
          customerType: editingCustomer.customerType ?? undefined,
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

  async function submitEmergencyContact(e: React.FormEvent) {
    e.preventDefault();
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
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      setEcName("");
      setEcPhone("");
      setEcRelation("");
      await loadEmergencyContacts(targetId);
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
    try {
      const res = await fetch(
        `/api/admin/customers/${targetId}/emergency-contacts/${contactId}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      await loadEmergencyContacts(targetId);
      setEcSaved(true);
    } catch (e: any) {
      setEcError(e?.message ?? "Notfallkontakt konnte nicht gelöscht werden.");
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

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Stammdaten</h1>
          <p className="mt-1 text-sm text-gray-600">Mitarbeiter und Kunden verwalten.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            tab === "employees" ? "bg-gray-900 text-white" : "hover:bg-gray-50"
          }`}
          onClick={() => setTab("employees")}
        >
          Mitarbeiter
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            tab === "customers" ? "bg-gray-900 text-white" : "hover:bg-gray-50"
          }`}
          onClick={() => setTab("customers")}
        >
          Kunden
        </button>
      </div>

      {tab === "employees" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">Mitarbeiter</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {empSaved ? <span className="text-sm text-green-700">Gespeichert ✓</span> : null}
              {resetSaved ? <span className="text-sm text-green-700">Gespeichert ✓</span> : null}
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                onClick={() => {
                  setEmpFormError(null);
                  setShowEmployeeModal(true);
                }}
              >
                + Mitarbeiter
              </button>
            </div>
          </div>

          {usersError ? (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {usersError}
            </div>
          ) : null}

          {usersLoading ? (
            <div className="text-sm text-gray-600">Lade…</div>
          ) : userRows.length === 0 ? (
            <Card variant="subtle" className="text-sm text-gray-700">
              Keine Eintraege vorhanden.
            </Card>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {userRows.map((u) => (
                  <Card key={u.id} className="space-y-2">
                    <div>
                      <div className="text-sm text-gray-600">Name</div>
                      <div>{u.name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">E-Mail</div>
                      <div>{u.email}</div>
                    </div>
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
                  </Card>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">E-Mail</th>
                      <th className="p-2 text-left">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-2">{u.name}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-gray-50"
                            onClick={() => {
                              setResetError(null);
                              setResetUser(u.raw);
                              setResetPassword("");
                              setResetConfirm("");
                            }}
                          >
                            Passwort zurücksetzen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">Kunden</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {custSaved ? <span className="text-sm text-green-700">Gespeichert ✓</span> : null}
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
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
                + Kunde
              </button>
            </div>
          </div>

          {customersError ? (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {customersError}
            </div>
          ) : null}

          {customersLoading ? (
            <div className="text-sm text-gray-600">Lade…</div>
          ) : customers.length === 0 ? (
            <Card variant="subtle" className="text-sm text-gray-700">
              Keine Eintraege vorhanden.
            </Card>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {customers.map((c) => (
                  <Card key={c.id} className="space-y-2">
                    <div>
                      <div className="text-sm text-gray-600">Name</div>
                      <div>{c.name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Adresse</div>
                      <div>{c.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Telefon</div>
                      <div>{c.phone || "—"}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openEditCustomer(c.id)}
                    >
                      Bearbeiten
                    </Button>
                  </Card>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Adresse</th>
                      <th className="p-2 text-left">Telefon</th>
                      <th className="p-2 text-left">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2">{c.name}</td>
                        <td className="p-2">{c.address || "—"}</td>
                        <td className="p-2">{c.phone || "—"}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-gray-50"
                            onClick={() => openEditCustomer(c.id)}
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {showEmployeeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Mitarbeiter hinzufügen</h3>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setShowEmployeeModal(false)}
              >
                Schließen
              </button>
            </div>

            {empFormError ? (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
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
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setShowEmployeeModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
                  disabled={empSaving || !empFormValid}
                >
                  {empSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCustomerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Kunde hinzufügen</h3>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
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
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {custFormError}
              </div>
            ) : null}

            {createdCustomerId ? (
              <div className="mt-3 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-700">
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
                    onChange={(e) => setCustType(e.target.value as "STATUTORY" | "PRIVATE")}
                    disabled={custSaving || Boolean(createdCustomerId)}
                  >
                    <option value="STATUTORY">Kasse</option>
                    <option value="PRIVATE">Privat</option>
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

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setShowCustomerModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
                  disabled={custSaving || !custFormValid || Boolean(createdCustomerId)}
                >
                  {custSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>

            {createdCustomerId ? (
              <div className="mt-4 rounded border p-3 space-y-2">
                <div className="text-sm font-semibold">Notfallkontakte</div>
                {ecError ? <div className="text-xs text-red-600">{ecError}</div> : null}
                {ecSaved ? <div className="text-xs text-green-700">Kontakt gespeichert ✓</div> : null}
                {ecLoading ? (
                  <div className="text-sm text-gray-600">Lade…</div>
                ) : emergencyContacts.length === 0 ? (
                  <div className="text-sm text-gray-600">Keine Notfallkontakte.</div>
                ) : (
                  <div className="space-y-2">
                    {emergencyContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded border px-2 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-gray-600">
                            {c.relation ? `${c.relation} · ` : ""}{c.phone}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                          disabled={ecSaving}
                          onClick={() => deleteEmergencyContact(c.id)}
                        >
                          Löschen
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form className="grid grid-cols-1 sm:grid-cols-3 gap-2" onSubmit={submitEmergencyContact}>
                  <Input
                    className="text-sm"
                    placeholder="Name"
                    value={ecName}
                    onChange={(e) => setEcName(e.target.value)}
                    disabled={ecSaving}
                  />
                  <Input
                    className="text-sm"
                    placeholder="Telefon"
                    value={ecPhone}
                    onChange={(e) => setEcPhone(e.target.value)}
                    disabled={ecSaving}
                  />
                  <Input
                    className="text-sm"
                    placeholder="Beziehung (optional)"
                    value={ecRelation}
                    onChange={(e) => setEcRelation(e.target.value)}
                    disabled={ecSaving}
                  />
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                      disabled={ecSaving}
                    >
                      {ecSaving ? "Speichern…" : "Kontakt hinzufügen"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCustomerEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Kunde bearbeiten</h3>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
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
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            {editSaved ? <div className="mt-2 text-sm text-green-700">Gespeichert ✓</div> : null}

            {editLoading ? (
              <div className="mt-3 text-sm text-gray-600">Lade…</div>
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
                      value={editingCustomer.customerType ?? "STATUTORY"}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          customerType: e.target.value as "STATUTORY" | "PRIVATE",
                        })
                      }
                    >
                      <option value="STATUTORY">Kasse</option>
                      <option value="PRIVATE">Privat</option>
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

                <div className="rounded border p-3 space-y-2">
                  <div className="text-sm font-semibold">Notfallkontakte</div>
                  {ecError ? <div className="text-xs text-red-600">{ecError}</div> : null}
                  {ecSaved ? <div className="text-xs text-green-700">Kontakt gespeichert ✓</div> : null}
                  {ecLoading ? (
                    <div className="text-sm text-gray-600">Lade…</div>
                  ) : emergencyContacts.length === 0 ? (
                    <div className="text-sm text-gray-600">Keine Notfallkontakte.</div>
                  ) : (
                    <div className="space-y-2">
                      {emergencyContacts.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-2 text-sm"
                        >
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-gray-600">
                              {c.relation ? `${c.relation} · ` : ""}{c.phone}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                            disabled={ecSaving}
                            onClick={() => deleteEmergencyContact(c.id)}
                          >
                            Löschen
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form className="grid grid-cols-1 sm:grid-cols-3 gap-2" onSubmit={submitEmergencyContact}>
                    <Input
                      className="text-sm"
                      placeholder="Name"
                      value={ecName}
                      onChange={(e) => setEcName(e.target.value)}
                      disabled={ecSaving}
                    />
                    <Input
                      className="text-sm"
                      placeholder="Telefon"
                      value={ecPhone}
                      onChange={(e) => setEcPhone(e.target.value)}
                      disabled={ecSaving}
                    />
                    <Input
                      className="text-sm"
                      placeholder="Beziehung (optional)"
                      value={ecRelation}
                      onChange={(e) => setEcRelation(e.target.value)}
                      disabled={ecSaving}
                    />
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                        disabled={ecSaving}
                      >
                        {ecSaving ? "Speichern…" : "Kontakt hinzufügen"}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm"
                    onClick={() => setShowCustomerEditModal(false)}
                  >
                    Schließen
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Passwort zurücksetzen</h3>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setResetUser(null)}
              >
                Schließen
              </button>
            </div>

            <div className="mt-1 text-xs text-gray-600">
              {resetUser.fullName || resetUser.email || "Mitarbeiter"}
            </div>

            {resetError ? (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
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
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setResetUser(null)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
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
