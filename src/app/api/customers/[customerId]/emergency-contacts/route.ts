import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.API_BASE ??
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL;

async function getAuthRole() {
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
  return { ok: true, token, role: me?.role } as const;
}

function contactsPath(role: string | null | undefined, customerId: string) {
  const encoded = encodeURIComponent(customerId);
  return role === "ADMIN"
    ? `/admin/customers/${encoded}/emergency-contacts`
    : `/me/customers/${encoded}/emergency-contacts`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ customerId: string }> }
) {
  const auth = await getAuthRole();
  if (!auth.ok) return auth.res;

  const { customerId } = await context.params;
  const path = contactsPath(auth.role, customerId);

  const upstreamRes = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: "no-store",
  });

  const data = await upstreamRes.json().catch(() => ([]));
  return NextResponse.json(data, { status: upstreamRes.status });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ customerId: string }> }
) {
  const auth = await getAuthRole();
  if (!auth.ok) return auth.res;

  if (auth.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const path = `/admin/customers/${encodeURIComponent(customerId)}/emergency-contacts`;

  const upstreamRes = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await upstreamRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstreamRes.status });
}
