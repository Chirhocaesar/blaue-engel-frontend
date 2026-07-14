"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function LoginPage() {
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
          window.location.href = "/admin";
        } else {
          window.location.href = "/dashboard";
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        setError(data?.message ?? "Login fehlgeschlagen");
        setLoading(false);
        return;
      }

      // cookie is set by the server route handler
      const meRes = await fetch("/api/users/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({}));
      if (me?.role === "ADMIN") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err?.message ?? "Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6 pt-4">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/digitboost-logo.png"
          alt="DigitBoost"
          width={250}
          height={255}
          priority
          className="h-20 w-auto"
        />
        <h1 className="mt-3 text-2xl font-bold text-ink">Anmelden</h1>
        <p className="mt-1 text-sm text-muted">
          Bitte melden Sie sich mit Ihren Zugangsdaten an.
        </p>
      </div>

      <form
        className="space-y-4 rounded-card border border-line bg-card p-5 shadow-card"
        onSubmit={onSubmit}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="w-full rounded-field border border-line-strong bg-card px-3 py-3 text-base placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
            className="w-full rounded-field border border-line-strong bg-card px-3 py-3 text-base placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="rounded-field border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-field bg-ink px-4 py-3 text-base font-semibold text-white shadow-[0_8px_18px_-8px_rgba(18,18,18,.5)] hover:bg-black disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Bitte warten…" : "Anmelden"}
        </button>

        <p className="text-xs text-faint">
          Bei Problemen wenden Sie sich bitte an den Admin.
        </p>
      </form>
    </main>
  );
}
