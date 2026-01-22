import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ?? "https://api.blaueengelhaushaltshilfe.de";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const upstreamRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await upstreamRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstreamRes.status });
}
