"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDate,
  formatKm,
  formatMinutes,
  formatSignedMinutes,
  formatTime,
  formatWeekdayShort,
} from "@/lib/format";

type Customer = {
  id?: string;
  name?: string;
  companyName?: string;
  address?: string;
  phone?: string;
};

type Signature = {
  id: string;
  createdAt?: string;
  signatureData?: string; // often data URL
  imageData?: string;     // sometimes data URL
  data?: string;          // sometimes data URL
};

type LatestSignature = {
  id: string;
  signedAt?: string;
  imageUrl?: string | null;
};

type TimeEntry = {
  id: string;
  // either classic timestamps
  startAt?: string;
  endAt?: string;
  // or new compact shape
  date?: string; // YYYY-MM-DD
  minutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
};

type Assignment = {
  id: string;
  customerId?: string;
  employeeId?: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
  status?: string;
  customer?: Customer;
  customerName?: string;

  signatures?: Signature[];
  timeEntries?: TimeEntry[];
  latestSignature?: LatestSignature | null;

  // Day-level KM entry returned by backend on /me/assignments/:id and /assignments/:id
  kmEntry?: { id: string; km: number } | null;

  totals?: {
    plannedMinutes: number;
    recordedMinutes: number;
    adjustedMinutes: number;
    finalMinutes: number;
    kmRecorded: number | null;
    kmAdjusted: number;
    kmFinal: number | null;
  };
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// local datetime-local value from ISO string
function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

// ISO from datetime-local (assumes local time)
function fromLocalDateTimeInput(v: string) {
  const d = new Date(v);
  return d.toISOString();
}

function durationMinutes(startIso: string, endIso: string) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

function ymdFromDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// YYYY-MM-DD in *local* time
function isoDayLocalFromIsoDateTime(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AssignmentDetailClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [showCreated, setShowCreated] = useState(false);

  // time entries
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [teLoading, setTeLoading] = useState(false);
  const [teErr, setTeErr] = useState<string>("");

  // add time entry form
  const [teStart, setTeStart] = useState<string>("");
  const [teEnd, setTeEnd] = useState<string>("");
  const [teNotes, setTeNotes] = useState<string>("");
  const [teSaving, setTeSaving] = useState(false);

  // signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const [sigSaving, setSigSaving] = useState(false);
  const [sigErr, setSigErr] = useState<string>("");
  const [sigOk, setSigOk] = useState<string>("");

  // employee actions
  const [ackLoading, setAckLoading] = useState(false);
  const [ackErr, setAckErr] = useState<string>("");
  const [doneLoading, setDoneLoading] = useState(false);
  const [doneErr, setDoneErr] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  // km per day (new truth)
  const [kmValue, setKmValue] = useState<string>("");
  const [kmSaving, setKmSaving] = useState(false);
  const [kmSavedAt, setKmSavedAt] = useState<number | null>(null);
  const [kmErr, setKmErr] = useState<string>("");
  const [kmLocked, setKmLocked] = useState(false);
  const [isKmLockedBySignature, setIsKmLockedBySignature] = useState(false);
  const [kmLoadState, setKmLoadState] = useState<"idle" | "loading" | "error" | "empty" | "value">("idle");
  const [isTimeLockedBySignature, setIsTimeLockedBySignature] = useState(false);

  const customerName = useMemo(() => {
    const c = data?.customer;
    return c?.companyName || c?.name || data?.customerName || "Kunde";
  }, [data]);

  const customerAddress = useMemo(() => data?.customer?.address || "", [data]);
  const customerPhone = useMemo(() => data?.customer?.phone || "", [data]);

  const mapsHref = useMemo(() => {
    if (!customerAddress) return "";
    const q = encodeURIComponent(customerAddress);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }, [customerAddress]);

  const telHref = useMemo(() => {
    if (!customerPhone) return "";
    const cleaned = customerPhone.replace(/[^\d+]/g, "");
    return `tel:${cleaned}`;
  }, [customerPhone]);

  const assignmentDate = useMemo(() => {
    if (!data?.startAt) return "";
    return `${formatWeekdayShort(data.startAt)}, ${formatDate(data.startAt)}`;
  }, [data?.startAt]);

  const assignmentTime = useMemo(() => {
    if (!data?.startAt || !data?.endAt) return "";
    const s = formatTime(data.startAt);
    const e = formatTime(data.endAt);
    return `${s}–${e}`;
  }, [data?.startAt, data?.endAt]);

  const plannedDuration = useMemo(() => {
    if (!data?.startAt || !data?.endAt) return "";
    return formatMinutes(durationMinutes(data.startAt, data.endAt));
  }, [data?.startAt, data?.endAt]);

  const totalWorkedMinutes = useMemo(() => {
    return timeEntries.reduce((sum, t) => {
      if (typeof t.minutes === 'number') return sum + Math.max(0, Math.round(t.minutes));
      if (t.startAt && t.endAt) return sum + durationMinutes(t.startAt, t.endAt);
      return sum;
    }, 0);
  }, [timeEntries]);

  const totals = data?.totals ?? null;

  const kmDate = useMemo(() => {
    if (!data?.startAt) return "";
    return isoDayLocalFromIsoDateTime(data.startAt);
  }, [data?.startAt]);

  const correctionsHref = useMemo(() => {
    const empId = data?.employeeId || (data as any)?.employee?.id || "";
    const day = data?.startAt ? isoDayLocalFromIsoDateTime(data.startAt) : "";
    if (!empId || !day) return "/admin/corrections";
    return `/admin/corrections?employeeId=${encodeURIComponent(empId)}&date=${encodeURIComponent(day)}&aid=${encodeURIComponent(id)}`;
  }, [data?.employeeId, data?.startAt, id]);

  const latestSignature = useMemo(() => {
    if (data?.latestSignature) return data.latestSignature as any;
    const sigs = data?.signatures || [];
    if (!sigs.length) return null;
    const sorted = [...sigs].sort((a, b) => {
      const ta = (a as any).signedAt ? new Date((a as any).signedAt).getTime() : 0;
      const tb = (b as any).signedAt ? new Date((b as any).signedAt).getTime() : 0;
      return tb - ta;
    });
    return sorted[0] as any;
  }, [data?.latestSignature, data?.signatures]);

  const latestSignatureImage = useMemo(() => {
    if (!latestSignature) return "";
    return (
      (latestSignature as any).signatureData ||
      (latestSignature as any).imageData ||
      (latestSignature as any).data ||
      (latestSignature as any).imageUrl ||
      ""
    );
  }, [latestSignature]);

  const hasSignature = Boolean(latestSignature);
  const isSigned = hasSignature;
  const isLocked = isSigned || isKmLockedBySignature || isTimeLockedBySignature;
  const isReceiptMode = isLocked || hasSignature;
  const lockAfterSignatureActive = kmLocked || isKmLockedBySignature || isSigned;

  const statusU = String(data?.status || "").toUpperCase();
  const isDone = statusU === "DONE";
  const isConfirmed = statusU === "CONFIRMED";
  const isAssigned = statusU === "ASSIGNED";
  const canSign = isConfirmed || isDone;

  async function loadAssignment() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/me/assignments/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      setData(json);

      if (json?.kmEntry?.km != null) {
        setKmValue(String(json.kmEntry.km));
        setKmLoadState("value");
      } else if (json?.kmEntry) {
        setKmValue("");
        setKmLoadState("empty");
      }

      // initialize time entry defaults from assignment
      if (json?.startAt) setTeStart(toLocalDateTimeInput(json.startAt));
      if (json?.endAt) setTeEnd(toLocalDateTimeInput(json.endAt));
      return json;
    } catch (e: any) {
      setErr(e?.message || "Fehler beim Laden");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function dayRangeFromAssignment(startIso?: string, endIso?: string) {
    if (!startIso && !endIso) return null;
    const base = startIso || endIso;
    if (!base) return null;
    const d = new Date(base);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const ymd = `${y}-${m}-${day}`;
    return { from: ymd, to: ymd };
  }

  async function loadTimeEntries(range?: { from: string; to: string } | null) {
    setTeLoading(true);
    setTeErr("");
    try {
      const qs = new URLSearchParams({ assignmentId: id });
      if (range?.from) qs.set("from", range.from);
      if (range?.to) qs.set("to", range.to);

      const res = await fetch(`/api/me/time-entries?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

      const items: TimeEntry[] = Array.isArray(json) ? json : json?.items ?? json?.timeEntries ?? [];
      items.sort((a, b) => {
        const ta = a.startAt ? new Date(a.startAt).getTime() : a.date ? new Date(a.date).getTime() : 0;
        const tb = b.startAt ? new Date(b.startAt).getTime() : b.date ? new Date(b.date).getTime() : 0;
        return ta - tb;
      });
      setTimeEntries(items);
    } catch (e: any) {
      setTeErr(e?.message || "Fehler beim Laden der Zeiteinträge");
      setTimeEntries([]);
    } finally {
      setTeLoading(false);
    }
  }

  async function loadKmForDate(date: string) {
    if (!date) return;
    setKmErr("");
    setKmLoadState("loading");
    try {
      const res = await fetch(`/api/me/km-entries?from=${date}&to=${date}&limit=1`, {
        cache: "no-store",
      });
      const raw = await res.json().catch(() => ({}));
      const items = Array.isArray(raw) ? raw : raw?.items ?? [];
      if (items && items.length > 0) {
        const item = items[0];
        const km = item?.km ?? null;
        setKmValue(km == null ? "" : String(km));
        setKmLoadState("value");
      } else {
        setKmValue("");
        setKmLoadState("empty");
      }
    } catch {
      setKmValue("");
      setKmLoadState("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const assignment = await loadAssignment();
      if (!cancelled) {
        if (Array.isArray(assignment?.timeEntries)) {
          const items: TimeEntry[] = assignment.timeEntries.map((t: any) => ({
            id: t.id,
            date: ymdFromDateInput(t.date),
            minutes: typeof t.minutes === "number" ? Math.max(0, Math.round(t.minutes)) : undefined,
            startAt: t.startAt ?? undefined,
            endAt: t.endAt ?? undefined,
            notes: t.notes ?? null,
          }));
          items.sort((a, b) => {
            const ta = a.startAt ? new Date(a.startAt).getTime() : a.date ? new Date(a.date).getTime() : 0;
            const tb = b.startAt ? new Date(b.startAt).getTime() : b.date ? new Date(b.date).getTime() : 0;
            return ta - tb;
          });
          setTimeEntries(items);
          setTeLoading(false);
        } else {
          await loadTimeEntries(dayRangeFromAssignment(assignment?.startAt, assignment?.endAt));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const created = searchParams.get("created");
    if (created !== "1") return;
    setShowCreated(true);
    const timeout = window.setTimeout(() => setShowCreated(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (!cancelled) setIsAdmin(json?.role === "ADMIN");
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!kmDate) return;
    setKmLocked(false);
    if (data?.kmEntry?.km != null) {
      setKmValue(String(data.kmEntry.km));
      setKmLoadState("value");
      return;
    }
    if (isAdmin) {
      const km = data?.kmEntry?.km ?? null;
      if (km == null) {
        setKmValue("");
        setKmLoadState("empty");
      } else {
        setKmValue(String(km));
        setKmLoadState("value");
      }
      return;
    }
    loadKmForDate(kmDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmDate, isAdmin, data?.kmEntry?.km]);

  async function handleAddTimeEntry() {
    if (teSaving) return;
    setTeErr("");
    if (!teStart || !teEnd) {
      setTeErr("Bitte Start- und Endzeit angeben.");
      return;
    }

    const startIso = fromLocalDateTimeInput(teStart);
    const endIso = fromLocalDateTimeInput(teEnd);

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setTeErr("Endzeit muss nach der Startzeit liegen.");
      return;
    }

    setTeSaving(true);
    try {
      const minutes = durationMinutes(startIso, endIso);
      const date = isoDayLocalFromIsoDateTime(startIso);

      const res = await fetch(`/api/me/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: id,
          date,
          minutes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Fehler beim Speichern");

      setTeNotes("");
      setIsTimeLockedBySignature(false);
      await loadTimeEntries();
    } catch (e: any) {
      const msg = e?.message || "Fehler beim Speichern";
      if (msg === "LOCKED_AFTER_SIGNATURE" || msg.includes("LOCKED_AFTER_SIGNATURE")) {
        setIsTimeLockedBySignature(true);
      }
      setTeErr(msg);
    } finally {
      setTeSaving(false);
    }
  }

  // signature canvas helpers
  function getPos(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y };
  }

  function startDraw(e: any) {
    if (!canvasRef.current) return;
    drawing.current = true;
    last.current = getPos(e);
    setSigOk("");
    setSigErr("");
  }

  function moveDraw(e: any) {
    if (!drawing.current || !canvasRef.current) return;
    e.preventDefault?.();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);
    const prev = last.current;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";

    ctx.beginPath();
    if (prev) ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    last.current = pos;
  }

  function endDraw() {
    drawing.current = false;
    last.current = null;
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigOk("");
    setSigErr("");
  }

  async function submitSig() {
    setSigErr("");
    setSigOk("");
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const hasInk = (() => {
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 0) return true;
      }
      return false;
    })();

    if (!hasInk) {
      setSigErr("Bitte unterschreiben (nicht leer).");
      return;
    }

    setSigSaving(true);
    try {
      const signatureData = canvas.toDataURL("image/png");
      const res = await fetch(`/api/me/assignments/${id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Fehler beim Speichern der Unterschrift");

      setSigOk("Unterschrift gespeichert ✓");
      await loadAssignment();
    } catch (e: any) {
      setSigErr(e?.message || "Fehler beim Speichern der Unterschrift");
    } finally {
      setSigSaving(false);
    }
  }

  async function handleAcknowledge() {
    setAckErr("");
    setAckLoading(true);
    try {
      const res = await fetch(`/api/me/assignments/${id}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      await loadAssignment();
    } catch (e: any) {
      setAckErr(e?.message || "Fehler beim Bestätigen");
    } finally {
      setAckLoading(false);
    }
  }

  async function handleMarkDone() {
    setDoneErr("");
    setDoneLoading(true);
    try {
      const res = await fetch(`/api/me/assignments/${id}/done`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      await loadAssignment();
    } catch (e: any) {
      setDoneErr(e?.message || "Fehler beim Abschließen");
    } finally {
      setDoneLoading(false);
    }
  }

  async function handleKmSave() {
    setKmErr("");
    setKmSavedAt(null);

    if (!kmDate) {
      setKmErr("Kein Datum gefunden.");
      return;
    }

    if (!kmValue || kmValue.trim() === "") {
      setKmErr("Bitte Kilometer eingeben");
      return;
    }

    const n = Number(kmValue);
    if (Number.isNaN(n) || n < 0) {
      setKmErr("Ungültige Kilometerzahl");
      return;
    }

    setKmSaving(true);
    try {
      const res = await fetch(`/api/me/km-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: kmDate, km: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && json?.message === "LOCKED_AFTER_SIGNATURE") {
          setKmLocked(true);
          setIsKmLockedBySignature(true);
          await loadKmForDate(kmDate);
          return;
        }
        throw new Error(json?.message || "Fehler beim Speichern");
      }

      setKmSavedAt(Date.now());
      setIsKmLockedBySignature(false);
      await loadKmForDate(kmDate);
    } catch (e: any) {
      const msg = e?.message || "Fehler beim Speichern";
      if (msg === "LOCKED_AFTER_SIGNATURE" || msg.includes("LOCKED_AFTER_SIGNATURE")) {
        setKmLocked(true);
        setIsKmLockedBySignature(true);
      } else if (msg === "ASSIGNMENT_NOT_CONFIRMED" || msg.includes("ASSIGNMENT_NOT_CONFIRMED")) {
        setKmErr("Bitte bestätige zuerst den Termin, bevor Kilometer erfasst werden können.");
      } else {
        setKmErr(msg);
      }
      await loadAssignment();
    } finally {
      setKmSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <div className="text-sm text-gray-600">Lade…</div>
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="min-h-screen p-4">
        <div className="rounded border p-4">
          <div className="font-semibold">Fehler</div>
          <div className="mt-1 text-sm text-gray-700">{err || "Nicht gefunden"}</div>
          <div className="mt-4">
            <Link href="/planner" className="rounded border px-3 py-2 text-sm inline-block">
              ← Zur Planung
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      {showCreated ? (
        <div className="mb-3 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          Gespeichert ✓
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{customerName}</h1>
          {customerAddress ? <div className="text-sm text-gray-700">{customerAddress}</div> : null}
        </div>

        <div className="flex gap-2 flex-wrap">
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              🗺️ Navigation öffnen
            </a>
          ) : (
            <span className="rounded border px-3 py-2 text-sm text-gray-400">—</span>
          )}

          {customerPhone ? (
            <a href={telHref} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
              📞 Anrufen
            </a>
          ) : null}

          <Link href="/planner" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            ← Planung
          </Link>
          {isAdmin ? (
            <Link
              href={correctionsHref}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Admin-Korrekturen
            </Link>
          ) : null}
        </div>
      </div>

      {customerPhone ? <div className="mt-2 text-sm text-gray-700">{customerPhone}</div> : null}

      {/* TOP META + ACTIONS */}
      <section className="mt-4 rounded border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Datum</div>
            <div className="font-medium">{assignmentDate}</div>
          </div>

          <div>
            <div className="text-gray-600">Zeit</div>
            <div className="font-medium">{assignmentTime}</div>
          </div>

          <div>
            <div className="text-gray-600">Arbeitsdauer (geplant)</div>
            <div className="font-medium">{plannedDuration}</div>
          </div>

          <div>
            <div className="text-gray-600">Status</div>
            <div className="font-medium flex items-center gap-2 flex-wrap">
              <span>{data.status || "—"}</span>
              {isLocked ? (
                <span className="rounded border px-2 py-0.5 text-xs font-semibold text-red-700 border-red-300">
                  LOCKED
                </span>
              ) : null}
            </div>
            {isLocked ? (
              <div className="mt-1 text-xs text-gray-600">
                Gesperrt nach Unterschrift – Änderungen nur durch Admin-Korrektur möglich.
              </div>
            ) : null}
          </div>
        </div>

        {data.notes ? (
          <div className="mt-4">
            <div className="text-sm text-gray-600">Notiz</div>
            <div className="text-sm">{data.notes}</div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {String(data?.status || "").toUpperCase() === "ASSIGNED" ? (
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={ackLoading}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              {ackLoading ? "Bestätige…" : "Termin bestätigen"}
            </button>
          ) : null}

          {String(data?.status || "").toUpperCase() === "CONFIRMED" ? (
            <button
              type="button"
              onClick={handleMarkDone}
              disabled={doneLoading}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              {doneLoading ? "Abschließen…" : "Abschließen"}
            </button>
          ) : null}

          {ackErr ? <div className="text-sm text-red-600">{ackErr}</div> : null}
          {doneErr ? <div className="text-sm text-red-600">{doneErr}</div> : null}
        </div>
      </section>

      {/* TOTALS */}
      <section className="mt-4 rounded border p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold">Summen</h2>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Geplant</div>
            <div className="font-medium">
              {totals ? formatMinutes(totals.plannedMinutes) : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Erfasst</div>
            <div className="font-medium">
              {totals ? formatMinutes(totals.recordedMinutes) : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Korrektur</div>
            <div className="font-medium">
              {totals ? formatSignedMinutes(totals.adjustedMinutes) : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Final</div>
            <div className="font-medium">
              {totals ? formatMinutes(totals.finalMinutes) : "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-gray-600">KM erfasst</div>
            <div className="font-medium">
              {totals ? formatKm(totals.kmRecorded) : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-600">KM Korrektur</div>
            <div className="font-medium">
              {totals ? (totals.kmAdjusted ? `${totals.kmAdjusted > 0 ? "+" : ""}${formatKm(totals.kmAdjusted)}` : "0") : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-600">KM final</div>
            <div className="font-medium">
              {totals ? formatKm(totals.kmFinal) : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* KM PER DAY */}
      <section className="mt-4 rounded border p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold">Kilometer (Tag){lockAfterSignatureActive ? " 🔒" : ""}</h2>
          {isAdmin ? (
            <span className="rounded border px-2 py-0.5 text-xs text-gray-600">Nur Anzeige</span>
          ) : null}
          {kmDate ? <div className="text-sm text-gray-600">{kmDate}</div> : null}
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {isAdmin ? (
            <>
              <div className="text-sm text-gray-700">
                {kmLoadState === "error"
                  ? "Fehler beim Laden"
                  : data?.kmEntry?.km != null
                    ? String(data.kmEntry.km)
                    : "Nicht erfasst"}
              </div>
              <span className="rounded border px-2 py-0.5 text-xs text-gray-600">Nur Anzeige</span>
            </>
          ) : isReceiptMode ? (
            <div className="text-sm text-gray-700">
              {kmLoadState === "error"
                ? "Fehler beim Laden"
                : data?.kmEntry?.km != null
                  ? String(data.kmEntry.km)
                  : kmValue || "Nicht erfasst"}
            </div>
          ) : (
            <>
              {kmLoadState === "error" ? (
                <div className="text-sm text-gray-700">Fehler beim Laden</div>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={kmValue}
                  onChange={(e) => setKmValue(e.target.value)}
                  className={`text-sm rounded border px-2 py-2 w-28 ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  aria-label="Kilometer"
                  disabled={kmSaving || isAssigned || isLocked || isKmLockedBySignature || kmLocked}
                />
              )}

              {kmLoadState !== "error" ? (
                <button
                  type="button"
                  onClick={handleKmSave}
                  disabled={kmSaving || isAssigned || isLocked || isKmLockedBySignature || kmLocked}
                  className={`rounded border px-3 py-2 text-sm hover:bg-gray-50 ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {kmSaving ? "Speichern…" : "Speichern"}
                </button>
              ) : null}
              {kmLocked ? (
                <div className="mt-2 text-sm text-red-600">
                  Gesperrt nach Unterschrift: Kilometer und Zeiteinträge können nach der Unterschrift nicht mehr geändert werden.
                </div>
              ) : null}
              {isAssigned ? (
                <div className="mt-2 text-sm text-gray-600">
                  Bitte zuerst bestätigen, um Zeiten/Kilometer einzutragen.
                </div>
              ) : null}

              {kmSavedAt ? <div className="text-sm text-green-700">Gespeichert ✓</div> : null}
            </>
          )}
        </div>

        {isSigned ? (
          <div className="mt-2 text-sm text-gray-600">
            Gesperrt nach Unterschrift: Kilometer (tagesbasiert) und Zeiteinträge sind nach jeder Unterschrift an diesem Tag gesperrt. Änderungen nur via Admin-Korrektur. Bitte Admin kontaktieren: <Link href="/admin/corrections" className="underline">Admin → Korrekturen → Tag</Link>.
          </div>
        ) : null}

        {isLocked || isKmLockedBySignature ? (
          <div className="mt-2 text-sm text-gray-600">
            Gesperrt nach Unterschrift: Kilometer (tagesbasiert) und Zeiteinträge sind nach jeder Unterschrift an diesem Tag gesperrt. Änderungen nur via Admin-Korrektur. Bitte Admin kontaktieren: <Link href="/admin/corrections" className="underline">Admin → Korrekturen → Tag</Link>.
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-gray-600">
            <span>Änderungen nur über Korrekturen möglich.</span>
            <Link href="/admin/corrections" className="rounded border px-2 py-1 text-xs">
              Zu Korrekturen
            </Link>
          </div>
        ) : null}

        {kmErr ? <div className="mt-2 text-sm text-red-600">{kmErr}</div> : null}
      </section>

      {/* TIME ENTRIES */}
      <section className="mt-4 rounded border p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold">Zeiteinträge{lockAfterSignatureActive ? " 🔒" : ""}</h2>
          {isAdmin ? (
            <span className="rounded border px-2 py-0.5 text-xs text-gray-600">Nur Anzeige</span>
          ) : null}
          <div className="text-sm text-gray-700">
            <span className="text-gray-600">Gesamt:</span>{" "}
            <span className="font-semibold">{formatMinutes(totalWorkedMinutes)}</span>
          </div>
        </div>

        {teErr ? <div className="mt-2 text-sm text-red-600">{teErr}</div> : null}

        {!isAdmin && !isReceiptMode && !isAssigned ? (
          <>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-600">Start</label>
                <input
                  type="datetime-local"
                  lang="de-DE"
                  step={60}
                  value={teStart}
                  onChange={(e) => setTeStart(e.target.value)}
                  className={`mt-1 w-full rounded border px-2 py-2 text-sm ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={teSaving || isSigned}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Ende</label>
                <input
                  type="datetime-local"
                  lang="de-DE"
                  step={60}
                  value={teEnd}
                  onChange={(e) => setTeEnd(e.target.value)}
                  className={`mt-1 w-full rounded border px-2 py-2 text-sm ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={teSaving || isSigned}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={handleAddTimeEntry}
                  disabled={teSaving || isSigned}
                  className={`w-full rounded border px-3 py-2 text-sm hover:bg-gray-50 ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {teSaving ? "Speichern…" : "Zeit hinzufügen"}
                </button>
              </div>
            </div>

            <div className="mt-2">
              <label className="text-xs text-gray-600">Notiz (optional)</label>
              <input
                type="text"
                value={teNotes}
                onChange={(e) => setTeNotes(e.target.value)}
                className={`mt-1 w-full rounded border px-2 py-2 text-sm ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                placeholder="z.B. extra Aufgaben"
                disabled={teSaving || isSigned}
              />
            </div>
          </>
        ) : null}

        {isAssigned && !isReceiptMode && !isAdmin ? (
          <div className="mt-2 text-sm text-gray-600">
            Bitte zuerst bestätigen, um Zeiten/Kilometer einzutragen.
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-gray-600">
            <span>Änderungen nur über Korrekturen möglich.</span>
            <Link href="/admin/corrections" className="rounded border px-2 py-1 text-xs">
              Zu Korrekturen
            </Link>
          </div>
        ) : null}

        {isSigned ? (
          <div className="mt-2 text-sm text-gray-600">
            Gesperrt nach Unterschrift: Kilometer (tagesbasiert) und Zeiteinträge sind nach jeder Unterschrift an diesem Tag gesperrt. Änderungen nur via Admin-Korrektur. Bitte Admin kontaktieren: <Link href="/admin/corrections" className="underline">Admin → Korrekturen → Tag</Link>.
          </div>
        ) : null}

        <div className="mt-4">
          {teLoading ? (
            <div className="text-sm text-gray-600">Lade Zeiteinträge…</div>
          ) : timeEntries.length === 0 ? (
            <div className="text-sm text-gray-600">Noch keine Zeiteinträge.</div>
          ) : (
            <ul className="space-y-2">
              {timeEntries.map((t) => {
                let mins = 0;
                let leftLabel = "—";

                if (typeof t.minutes === "number") {
                  mins = Math.max(0, Math.round(t.minutes));
                  leftLabel = `Datum: ${t.date ?? "—"}`;
                } else if (t.startAt && t.endAt) {
                  mins = durationMinutes(t.startAt, t.endAt);
                  const s = formatTime(t.startAt);
                  const e = formatTime(t.endAt);
                  leftLabel = `${s}–${e}`;
                }

                return (
                  <li key={t.id} className="rounded border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{leftLabel}</div>
                      <div className="text-gray-700">{formatMinutes(mins)}</div>
                    </div>
                    {t.notes ? <div className="mt-1 text-gray-600 text-xs">{t.notes}</div> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* SIGNATURE */}
      <section className="mt-4 rounded border p-4">
        <h2 className="text-base font-semibold">Unterschrift</h2>
        <p className="mt-1 text-sm text-red-600">
          Achtung: Nach dem Speichern der Unterschrift werden Zeiteinträge und Kilometer für diesen Tag gesperrt und können nicht mehr geändert werden.
        </p>
        {!latestSignature ? (
          <p className="mt-1 text-sm text-gray-600">Bitte hier unterschreiben und speichern. (MVP)</p>
        ) : null}

        {latestSignature ? (
          <div className="mt-3 rounded border p-3 bg-gray-50">
            <div className="text-xs text-gray-600">Vorhandene Unterschrift</div>
            <div className="mt-1 text-sm">
              {latestSignature.signedAt
                ? `Gespeichert: ${formatDate(latestSignature.signedAt)}`
                : "Gespeichert"}
            </div>

            {latestSignatureImage ? (
              <img
                src={latestSignatureImage}
                alt="Unterschrift"
                className="mt-3 w-full max-w-[520px] rounded border bg-white"
              />
            ) : (
              <div className="mt-2 text-xs text-gray-600">
                (Kein Bild im Response gefunden – Signature ist gespeichert, aber Preview fehlt.)
              </div>
            )}
          </div>
        ) : null}

          <div className="mt-3">
            {!hasSignature ? (
              <>
                {canSign ? (
                  <>
                    <div className="rounded border overflow-hidden bg-white">
                      <canvas
                        ref={canvasRef}
                        width={700}
                        height={220}
                        className="w-full h-[160px] touch-none"
                        onMouseDown={startDraw}
                        onMouseMove={moveDraw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={moveDraw}
                        onTouchEnd={endDraw}
                      />
                    </div>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button type="button" onClick={clearSig} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
                        Löschen
                      </button>
                      <button
                        type="button"
                        onClick={submitSig}
                        disabled={sigSaving}
                        className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {sigSaving ? "Speichere…" : "Unterschrift speichern"}
                      </button>
                      {sigOk ? <div className="text-sm text-green-700 flex items-center">{sigOk}</div> : null}
                    </div>

                    {sigErr ? <div className="mt-2 text-sm text-red-600">{sigErr}</div> : null}
                  </>
                ) : (
                  <div className="mt-2 text-sm text-gray-600">Unterschrift ist möglich, sobald der Termin bestätigt wurde.</div>
                )}
              </>
            ) : null}
          </div>
      </section>
    </main>
  );
}
