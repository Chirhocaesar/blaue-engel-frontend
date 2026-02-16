import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.API_BASE_URL ?? "https://api.blaueengelhaushaltshilfe.de";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { message: "E-Mail und Passwort sind erforderlich" },
      { status: 400 }
    );
  }

  const upstreamRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });

  const data = await upstreamRes.json().catch(() => ({}));

  if (!upstreamRes.ok) {
    return NextResponse.json(
      { message: data?.message ?? "Login fehlgeschlagen" },
      { status: upstreamRes.status }
    );
  }

  const accessToken = data?.accessToken;
  if (!accessToken || typeof accessToken !== "string" || accessToken.length < 20) {
    // return upstream payload for debugging (safe-ish)
    return NextResponse.json(
      { message: "Kein gueltiger Access-Token von der API", received: data },
      { status: 500 }
    );
  }

  // Set HttpOnly cookie on the APP domain
  const cookieStore = await cookies();
  cookieStore.set("be_access", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
