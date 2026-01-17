import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET() {
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

  const me = await meRes.json();
  const path = me.role === "ADMIN" ? "/assignments" : "/me/assignments";

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
