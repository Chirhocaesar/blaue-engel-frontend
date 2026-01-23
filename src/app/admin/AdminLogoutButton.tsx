"use client";

import { useState } from "react";

export default function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-xl border px-4 py-2 text-sm font-semibold"
    >
      {loading ? "Abmelden…" : "Abmelden"}
    </button>
  );
}
