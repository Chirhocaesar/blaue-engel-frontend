import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.API_BASE ??
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(req: Request) {
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
  const path = me.role === "ADMIN" ? "/assignments" : "/me/assignments";

  const url = new URL(req.url);
  const startRaw = url.searchParams.get("start");
  const endRaw = url.searchParams.get("end");

  if (!startRaw || !endRaw) {
    return NextResponse.json(
      { message: "Start/Ende-Parameter fehlen" },
      { status: 400 }
    );
  }

  const startDate = new Date(startRaw);
  const endDate = new Date(endRaw);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json(
      { message: "Ungueltige Start/Ende-Parameter" },
      { status: 400 }
    );
  }

  const qs = new URLSearchParams({
    from: startDate.toISOString(),
    to: endDate.toISOString(),
  }).toString();
  const upstreamUrl = `${API_BASE}${path}?${qs}`;

  const res = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
