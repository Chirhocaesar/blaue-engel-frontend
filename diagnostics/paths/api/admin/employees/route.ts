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

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const upstreamRes = await fetch(`${API_BASE}/admin/users?role=EMPLOYEE`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: "no-store",
  });

  const data = await upstreamRes.json().catch(() => ([]));
  return NextResponse.json(data, { status: upstreamRes.status });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const payload = { ...body, role: "EMPLOYEE" };

  const upstreamRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await upstreamRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstreamRes.status });
}
