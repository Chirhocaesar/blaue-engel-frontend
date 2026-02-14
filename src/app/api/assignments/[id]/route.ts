import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.API_BASE ??
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const cookieStore = await cookies();
  const access = cookieStore.get("be_access")?.value;

  if (!access) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const me = await meRes.json().catch(() => ({}));
  const path =
    me?.role === "ADMIN"
      ? `/assignments/${encodeURIComponent(id)}`
      : `/me/assignments/${encodeURIComponent(id)}`;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
