import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const cookieStore = await cookies();
  const access = cookieStore.get("be_access")?.value;

  if (!access) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const me = await meRes.json();

  const path = me.role === "ADMIN" ? `/assignments/${id}` : `/me/assignments/${id}`;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const cookieStore = await cookies();
  const access = cookieStore.get("be_access")?.value;

  if (!access) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const me = await meRes.json();
  const body = await req.json().catch(() => ({}));

  const path =
    me.role === "ADMIN"
      ? `/assignments/${id}`
      : `/me/assignments/${id}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
