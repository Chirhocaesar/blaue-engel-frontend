import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE ?? "https://api.blaueengelhaushaltshilfe.de";

type Assignment = {
  id?: string;
  startAt: string;
  endAt: string;
  status?: string | null;
  kilometers?: number | null;
  km?: number | null;
  employee?: { fullName?: string | null; email?: string | null } | null;
  employeeId?: string | null;
};

type AssignmentsResponse = { items?: Assignment[]; nextCursor?: string | null } | Assignment[];

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) {
    return { ok: false, res: NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 }) };
  }

  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return { ok: false, res: NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 }) };
  }

  const me = await meRes.json().catch(() => ({}));
  if (me?.role !== "ADMIN") {
    return { ok: false, res: NextResponse.json({ message: "Keine Berechtigung" }, { status: 403 }) };
  }

  return { ok: true, token } as const;
}

function hoursBetween(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3600000;
}

function isDone(status?: string | null) {
  return String(status || "").toUpperCase() === "DONE";
}

function getItems(data: AssignmentsResponse): Assignment[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function getEmployeeName(a: Assignment) {
  return a.employee?.fullName || a.employee?.email || null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  const limit = 200;
  const maxPages = 10;
  let cursor: string | null = null;
  let items: Assignment[] = [];

  for (let i = 0; i < maxPages; i += 1) {
    const url = new URL(`${API_BASE}/assignments`);
    url.searchParams.set("customerId", id);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);

    const upstreamRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });

    const json = await upstreamRes.json().catch(() => ({}));
    if (!upstreamRes.ok) {
      return NextResponse.json(json, { status: upstreamRes.status });
    }

    const batch = getItems(json as AssignmentsResponse);
    items = items.concat(batch);
    const nextCursor = !Array.isArray(json) ? (json as any)?.nextCursor ?? null : null;
    if (!nextCursor || batch.length === 0) break;
    cursor = nextCursor;
  }

  let plannedHours = 0;
  let doneHours = 0;
  let doneKilometers = 0;
  let totalAssignments = 0;
  let doneAssignments = 0;
  let lastAssignmentAt: string | null = null;
  const nowMs = Date.now();

  items.forEach((a) => {
    totalAssignments += 1;
    const hours = hoursBetween(a.startAt, a.endAt);
    plannedHours += hours;
    if (isDone(a.status)) {
      doneAssignments += 1;
      doneHours += hours;
      const val = (a as any).kilometers ?? (a as any).km;
      if (typeof val === "number" && Number.isFinite(val)) doneKilometers += val;
    }

    const startMs = new Date(a.startAt).getTime();
    if (Number.isFinite(startMs) && startMs <= nowMs) {
      if (!lastAssignmentAt || startMs > new Date(lastAssignmentAt).getTime()) {
        lastAssignmentAt = a.startAt;
      }
    }
  });

  const upcomingAssignments = items
    .filter((a) => {
      const startMs = new Date(a.startAt).getTime();
      return Number.isFinite(startMs) && startMs >= nowMs;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      employeeName: getEmployeeName(a),
    }));

  return NextResponse.json({
    plannedHours,
    doneHours,
    doneKilometers,
    totalAssignments,
    doneAssignments,
    lastAssignmentAt,
    upcomingAssignments,
  });
}
