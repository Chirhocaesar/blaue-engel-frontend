"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function sanitizeTel(phone?: string | null) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}

function mapsUrl(address?: string | null) {
  if (!address) return "";
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AssignmentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr("");
      try {
        const res = await fetch(`/api/me/assignments/${params.id}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Fehler beim Laden");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const customer = data?.customer;
  const phoneRaw = customer?.phone || "";
  const phone = useMemo(() => sanitizeTel(phoneRaw), [phoneRaw]);
  const address = customer?.address || "";
  const gmaps = useMemo(() => mapsUrl(address), [address]);

  if (err) {
    return (
      <main className="min-h-screen p-4">
        <Link href="/planner" className="text-sm underline">← Zurück zum Planer</Link>
        <div className="mt-4 rounded border p-4">{err}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen p-4">
        <Link href="/planner" className="text-sm underline">← Zurück zum Planer</Link>
        <div className="mt-4 text-sm text-gray-600">Lade…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <Link href="/planner" className="text-sm underline">← Zurück zum Planer</Link>

      <h1 className="mt-2 text-2xl font-semibold">Einsatz-Details</h1>

      <section className="mt-4 rounded border p-4">
        <div className="text-lg font-semibold">
          {customer?.companyName || customer?.name || "Kunde"}
        </div>

        {address && (
          <div className="mt-2 text-sm">
            <div>{address}</div>
            <a href={gmaps} target="_blank" className="underline">🗺️ Navigation öffnen</a>
          </div>
        )}

        {phone && (
          <div className="mt-3">
            <a href={`tel:${phone}`} className="underline">📞 Anrufen</a>
            <div className="text-xs text-gray-500">{phoneRaw}</div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded border p-4 text-sm">
        <div><b>Datum:</b> {fmtDate(data.startAt)}</div>
        <div><b>Zeit:</b> {fmtTime(data.startAt)}–{fmtTime(data.endAt)}</div>
        <div><b>Status:</b> {data.status || "—"}</div>
        {data.notes && <div className="mt-2"><b>Notiz:</b> {data.notes}</div>}
      </section>
    </main>
  );
}
