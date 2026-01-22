import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { formatDate, formatDateTimeRange } from "@/lib/format";

export const dynamic = "force-dynamic";

type Me = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

type Assignment = {
  id: string;
  employeeId?: string | null;
  employee?: { id: string; fullName?: string | null; email?: string | null } | null;
  startAt: string;
  endAt: string;
  status?: string;
  customer?: { name?: string | null; companyName?: string | null } | null;
  customerName?: string | null;
};

type AssignmentsResponse = {
  items?: Assignment[];
  nextCursor?: string | null;
} | Assignment[];

type AdminUser = {
  id: string;
  email?: string | null;
  fullName?: string | null;
};

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortId(id?: string | null) {
  if (!id) return "—";
  return `…${id.slice(-6)}`;
}

function statusLabel(status?: string | null) {
  return (status || "—").toUpperCase();
}

function statusPillClass(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ASSIGNED":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "DONE":
      return "bg-green-100 text-green-800 border-green-300";
    case "CANCELLED":
      return "bg-gray-100 text-gray-700 border-gray-300";
    case "PLANNED":
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

function getItems(data: AssignmentsResponse): Assignment[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  let me: Me;
  try {
    me = await apiGet<Me>("/users/me", token);
  } catch (e: any) {
    const err = e as ApiError;
    if (err?.status === 401) redirect("/login");
    throw e;
  }

  if (me.role !== "ADMIN") {
    redirect("/dashboard");
  }

  let userMap = new Map<string, { fullName?: string | null; email?: string | null }>();
  try {
    const headerList = await headers();
    const host = headerList.get("host");
    if (host) {
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${host}`;
      const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { cookie: `be_access=${token}` },
        cache: "no-store",
      });
      if (usersRes.ok) {
        const usersJson = await usersRes.json().catch(() => ([]));
        const users = Array.isArray(usersJson) ? (usersJson as AdminUser[]) : [];
        userMap = new Map(users.map((u) => [u.id, { fullName: u.fullName, email: u.email }]));
      }
    }
  } catch {
    userMap = new Map();
  }

  const start = ymdLocal(new Date());
  const end = ymdLocal(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  let assignmentsData: AssignmentsResponse = { items: [] };
  let assignmentsWarning: string | null = null;
  try {
    assignmentsData = await apiGet<AssignmentsResponse>(
      `/assignments?from=${start}&to=${end}&limit=200`,
      token,
    );
  } catch (e: any) {
    const err = e as ApiError;
    assignmentsWarning = `Daten konnten nicht geladen werden (${err?.status ?? "?"}).`;
    assignmentsData = { items: [] };
  }

  const items = getItems(assignmentsData).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const totalCount = items.length;
  const openCount = items.filter((a) => {
    const st = String(a.status || "").toUpperCase();
    return st === "ASSIGNED" || st === "CONFIRMED";
  }).length;
  const doneCount = items.filter((a) => String(a.status || "").toUpperCase() === "DONE").length;

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Admin-Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Übersicht für die nächsten 14 Tage.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/planner" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Dienstplan
        </Link>
        <Link href="/admin/masterdata" className="rounded-xl border px-4 py-2 text-left">
          <div className="text-sm font-semibold">Stammdaten</div>
          <div className="text-xs text-gray-600">Mitarbeiter &amp; Kunden verwalten</div>
        </Link>
        <Link href="/admin/assignments/new" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Einsatz planen
        </Link>
        <Link href="/admin/corrections" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Korrekturen
        </Link>
        <Link href="/assignments" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Einsätze
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border p-3">
          <div className="text-gray-600">Termine (14 Tage)</div>
          <div className="text-lg font-semibold">{totalCount}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-gray-600">Offen</div>
          <div className="text-lg font-semibold">{openCount}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-gray-600">Erledigt</div>
          <div className="text-lg font-semibold">{doneCount}</div>
        </div>
      </div>

      {assignmentsWarning ? (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          {assignmentsWarning}
        </div>
      ) : null}

      <section className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Nächste Einsätze</h2>
          <div className="text-xs text-gray-600">Zeitraum: {formatDate(start)} – {formatDate(end)}</div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 border">Kunde</th>
                <th className="text-left p-2 border">Mitarbeiter</th>
                <th className="text-left p-2 border">Zeit</th>
                <th className="text-left p-2 border">Status</th>
                <th className="text-left p-2 border">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-2" colSpan={5}>
                    Keine Einsätze gefunden.
                  </td>
                </tr>
              ) : (
                items.map((a) => {
                  const customerName = a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
                  const mappedUser = a.employeeId ? userMap.get(a.employeeId) : null;
                  const employeeLabel = a.employee?.fullName
                    ?? mappedUser?.fullName
                    ?? mappedUser?.email
                    ?? (a.employeeId ? shortId(a.employeeId) : "—");
                  return (
                    <tr key={a.id}>
                      <td className="p-2 border">
                        <div className="font-medium">{customerName}</div>
                      </td>
                      <td className="p-2 border">{employeeLabel}</td>
                      <td className="p-2 border">
                        {formatDateTimeRange(a.startAt, a.endAt)}
                      </td>
                      <td className="p-2 border">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClass(
                            a.status,
                          )}`}
                        >
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td className="p-2 border text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link className="underline" href={`/assignments/${a.id}`}>
                            Details
                          </Link>
                          <Link className="underline" href={`/admin/corrections?assignmentId=${encodeURIComponent(a.id)}`}>
                            Korrektur
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
