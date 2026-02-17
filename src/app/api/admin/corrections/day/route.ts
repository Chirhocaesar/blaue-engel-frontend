import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ?? "https://api.blaueengelhaushaltshilfe.de";

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

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const employeeId = url.searchParams.get("employeeId") ?? "";
  const date = url.searchParams.get("date") ?? "";

  const upstreamRes = await fetch(
    `${API_BASE}/admin/corrections/day${qs ? `?${qs}` : ""}`,
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    }
  );

  const data = await upstreamRes.json().catch(() => ({}));
  if (!upstreamRes.ok || !employeeId || !date) {
    return NextResponse.json(data, { status: upstreamRes.status });
  }

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const listRes = await fetch(
    `${API_BASE}/admin/assignments?employeeId=${encodeURIComponent(employeeId)}` +
      `&from=${encodeURIComponent(dayStart)}` +
      `&to=${encodeURIComponent(dayEnd)}` +
      `&limit=200`,
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    }
  );

  if (!listRes.ok) {
    return NextResponse.json(data, { status: upstreamRes.status });
  }

  const listJson = await listRes.json().catch(() => ({}));
  const items: any[] = Array.isArray(listJson?.items) ? listJson.items : [];
  const byId = new Map<string, any>(items.map((item) => [item.id, item]));

  const assignments = Array.isArray(data?.assignments)
    ? data.assignments.map((assignment: any) => {
        const match = byId.get(assignment.id);
        if (!match) return assignment;
        const kilometers = match.kilometers ?? null;
        const kmAdjusted = match.kmAdjusted ?? 0;
        const kmFinal = match.kmFinal ?? (kilometers ?? 0) + kmAdjusted;
        return {
          ...assignment,
          kilometers,
          kmAdjusted,
          kmFinal,
        };
      })
    : data?.assignments;

  return NextResponse.json({ ...data, assignments }, { status: upstreamRes.status });
}
