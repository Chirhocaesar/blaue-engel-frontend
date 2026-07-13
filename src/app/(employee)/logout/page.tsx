"use client";

import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
  }, []);

  return (
    <main className="space-y-2">
      <h1 className="text-2xl font-bold text-ink">Abmelden…</h1>
      <p className="text-sm text-muted">Bitte warten.</p>
    </main>
  );
}
