import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.API_BASE ?? "https://api.blaueengelhaushaltshilfe.de";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) {
    return {
      ok: false,
      res: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return {
      ok: false,
      res: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  const me = await meRes.json().catch(() => ({}));
  if (me?.role !== "ADMIN") {
    return {
      ok: false,
      res: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, token } as const;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));

  const upstreamRes = await fetch(`${API_BASE}/admin/assignments/series`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const contentType = upstreamRes.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await upstreamRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstreamRes.status });
  }

  const text = await upstreamRes.text().catch(() => "");
  return NextResponse.json(text, { status: upstreamRes.status });
}
