import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import StatusPill from "@/components/StatusPill";

type AssignmentStatus = "PLANNED" | "ASSIGNED" | "CONFIRMED" | "DONE" | "CANCELLED";

type Me = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  fullName?: string | null;
  isActive?: boolean;
};

type Customer = {
  id: string;
  // guessing minimal safe fields — we’ll render defensively
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type Assignment = {
  id: string;
  startAt: string; // Prisma returns ISO strings in JSON
  endAt?: string | null;
  status: AssignmentStatus;
  customer?: Customer | null;
};

type AssignmentsResponse = {
  items: Assignment[];
  nextCursor: string | null;
};

function customerLabel(c?: Customer | null) {
  if (!c) return "Unbekannter Kunde";
  if (c.name) return c.name;
  const full = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return full || "Unbekannter Kunde";
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    cursor?: string;
    limit?: string;
    status?: AssignmentStatus;
    employeeId?: string;
    customerId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};

  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  const me = await apiGet<Me>("/users/me", token);
  const basePath = me.role === "ADMIN" ? "/assignments" : "/me/assignments";
  const dashboardPath = me.role === "ADMIN" ? "/admin" : "/dashboard";

  // Backend contract:
  // GET /assignments?cursor=&limit=&from=&to=&employeeId=&customerId=&status=
  const qs = new URLSearchParams();

  // Keep a conservative default, backend default is 50 anyway.
  // We’ll set it explicitly so behavior is stable.
  qs.set("limit", sp.limit ?? "20");

  if (sp.cursor) qs.set("cursor", sp.cursor);
  if (sp.status) qs.set("status", sp.status);
  if (sp.employeeId) qs.set("employeeId", sp.employeeId);
  if (sp.customerId) qs.set("customerId", sp.customerId);
  if (sp.from) qs.set("from", sp.from);
  if (sp.to) qs.set("to", sp.to);

  let data: AssignmentsResponse;

  try {
    data = await apiGet<AssignmentsResponse>(`${basePath}?${qs.toString()}`, token);
  } catch (e: any) {
    const err = e as ApiError;

    if (err?.status === 401) redirect("/login");

    if (err?.status === 403) {
      return (
        <div className="p-4 pb-24">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Einsätze</h1>
            <Link className="text-sm underline" href={dashboardPath}>
              Dashboard
            </Link>
          </div>

          <div className="mt-4 rounded-xl border p-4">
            <p className="font-medium">Kein Zugriff</p>
            <p className="mt-1 text-sm opacity-80">
              Diese Seite ist aktuell nur für Admins verfügbar.
            </p>
          </div>

          <div className="mt-4">
            <Link className="underline" href={dashboardPath}>
              Zurück zum Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Einsätze</h1>
          <Link className="text-sm underline" href={dashboardPath}>
            Dashboard
          </Link>
        </div>

        <div className="mt-4 rounded-xl border p-4">
          <p className="font-medium">Konnte Einsätze nicht laden.</p>
          <p className="mt-2 text-sm opacity-80">{err?.message ?? "Unbekannter Fehler"}</p>
        </div>
      </div>
    );
  }

  const { items, nextCursor } = data;

  // Build “Next” link while keeping existing filters
  const nextParams = new URLSearchParams(qs);
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Einsätze</h1>
        <Link className="text-sm underline" href={dashboardPath}>
          Dashboard
        </Link>
      </div>

      <p className="mt-2 text-sm opacity-70">
        Zeitraum ist standardmäßig „ab heute + 14 Tage“ (Backend-Default).
      </p>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border p-4">
            <p className="font-medium">Keine Einsätze gefunden.</p>
            <p className="mt-1 text-sm opacity-80">
              Tipp: Es gibt Filter (status, employeeId, customerId, from/to).
            </p>
          </div>
        ) : (
          items.map((a) => (
            <Link
              key={a.id}
              href={`/assignments/${a.id}`}
              className="block rounded-2xl border p-4 shadow-sm hover:bg-gray-50 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {customerLabel(a.customer)}
                  </p>

                  <p className="mt-1 text-sm opacity-80">
                    <span className="font-medium">Start:</span>{" "}
                    {formatDateTime(a.startAt)}
                  </p>

                  {a.endAt ? (
                    <p className="text-sm opacity-80">
                      <span className="font-medium">Ende:</span>{" "}
                      {formatDateTime(a.endAt)}
                    </p>
                  ) : null}

                  <StatusPill status={a.status} className="px-3 py-1" />

                  <p className="mt-2 break-all font-mono text-xs opacity-70">
                    {a.id}
                  </p>

                  <p className="mt-3 text-sm underline">
                    Details öffnen
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>


      <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link className="text-sm underline" href={dashboardPath}>
            Zurück
          </Link>

          {nextCursor ? (
            <Link className="rounded-lg border px-4 py-2 text-sm" href={`/assignments?${nextParams.toString()}`}>
              Nächste
            </Link>
          ) : (
            <span className="text-sm opacity-60">Ende</span>
          )}
        </div>
      </div>
    </div>
  );
}
