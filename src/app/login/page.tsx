"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", { cache: "no-store" });
        if (!res.ok) return;
        const me = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (me?.role === "ADMIN") {
          router.replace("/admin");
        } else {
          router.replace("/dashboard");
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? "Login failed");
        setLoading(false);
        return;
      }

      // cookie is set by the server route handler
      const meRes = await fetch("/api/users/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({}));
      if (me?.role === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Anmelden</h1>
        <p className="mt-1 text-sm text-gray-600">
          Bitte melde dich mit deinen Zugangsdaten an.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="w-full rounded-xl border px-3 py-3 text-base"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-xl border px-3 py-3 text-base"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-black px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Bitte warten…" : "Anmelden"}
        </button>

        <p className="text-xs text-gray-500">
          Bei Problemen bitte beim Admin melden.
        </p>
      </form>
    </main>
  );
}
