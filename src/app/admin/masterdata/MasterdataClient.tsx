"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
};

type UsersResponse = AdminUser[] | { items?: AdminUser[] };

type CustomersResponse = { items?: Customer[] } | Customer[];

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

  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empSaving, setEmpSaving] = useState(false);
  const [empSaved, setEmpSaved] = useState(false);
  const [empFormError, setEmpFormError] = useState<string | null>(null);

  const [custName, setCustName] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custSaving, setCustSaving] = useState(false);
  const [custSaved, setCustSaved] = useState(false);
  const [custFormError, setCustFormError] = useState<string | null>(null);

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
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);

      setShowCustomerModal(false);
      setCustName("");
      setCustAddress("");
      setCustPhone("");
      setCustSaved(true);
      await loadCustomers();
    } catch (e: any) {
      setCustFormError(e?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setCustSaving(false);
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
            <div className="rounded border p-4 text-sm text-gray-700">Keine Mitarbeiter gefunden.</div>
          ) : (
            <div className="overflow-x-auto rounded border">
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
            <div className="rounded border p-4 text-sm text-gray-700">Keine Kunden gefunden.</div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Adresse</th>
                    <th className="p-2 text-left">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">{c.address || "—"}</td>
                      <td className="p-2">{c.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showEmployeeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
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
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">E-Mail</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="email"
                  required
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Passwort</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
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
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Kunde hinzufügen</h3>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setShowCustomerModal(false)}
              >
                Schließen
              </button>
            </div>

            {custFormError ? (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {custFormError}
              </div>
            ) : null}

            <form className="mt-3 space-y-3" onSubmit={submitCustomer}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Adresse</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  required
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Telefon</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
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
                  disabled={custSaving || !custFormValid}
                >
                  {custSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
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
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="password"
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Passwort bestätigen</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
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
