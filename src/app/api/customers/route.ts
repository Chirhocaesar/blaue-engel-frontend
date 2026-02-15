import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE ?? "https://api.blaueengelhaushaltshilfe.de";

async function getAuthRole() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) {
    return {
      ok: false,
      res: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return {
      ok: false,
      res: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const me = await meRes.json().catch(() => ({}));
  return { ok: true, token, role: me?.role } as const;
}

export async function GET(req: Request) {
  const auth = await getAuthRole();
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const forwardUrl =
    auth.role === "ADMIN"
      ? `${API_BASE}/customers${qs ? `?${qs}` : ""}`
      : `${API_BASE}/me/customers${qs ? `?${qs}` : ""}`;

  const upstreamRes = await fetch(forwardUrl, {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: "no-store",
  });

  const contentType = upstreamRes.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await upstreamRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstreamRes.status });
  }

  const text = await upstreamRes.text().catch(() => "");
  return new NextResponse(text, { status: upstreamRes.status });
}
