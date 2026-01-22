import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const access = cookieStore.get("be_access")?.value;

  if (!access) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const res = await fetch(`${API_BASE}/me/km-entries${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const access = cookieStore.get("be_access")?.value;

  if (!access) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const res = await fetch(`${API_BASE}/me/km-entries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
