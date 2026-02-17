"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDate,
  formatDateTime,
  formatKm,
  formatMinutes,
  formatSignedMinutes,
  formatTime,
  formatWeekdayShort,
} from "@/lib/format";
import { makeTimeOptions, toInputValueLocal } from "@/lib/datetime-de";
import { statusLabelDe } from "@/lib/status";
import StatusPill from "@/components/StatusPill";
import { Alert, Button, Card, Pill } from "@/components/ui";
import StateNotice from "@/components/StateNotice";

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

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  updatedAt?: string;
  notes?: string | null;
  status?: string;
  kilometers?: number | null;
  kmAdjusted?: number | null;
  kmFinal?: number | null;
  customer?: Customer;
  customerName?: string;
  employee?: { id?: string; fullName?: string | null; email?: string | null } | null;

  signatures?: Signature[];
  timeEntries?: TimeEntry[];
  latestSignature?: LatestSignature | null;

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

type AdminEmployee = {
  id: string;
  email?: string | null;
  fullName?: string | null;
};

type AdminCustomer = {
  id: string;
  name?: string | null;
  companyName?: string | null;
};

function splitLocalDateTime(value?: string | null) {
  if (!value) return { date: "", time: "" };
  const local = toInputValueLocal(value);
  if (!local) return { date: "", time: "" };
  const [date, time] = local.split("T");
  return { date: date || "", time: time || "" };
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
  const [teDate, setTeDate] = useState<string>("");
  const [teStartTime, setTeStartTime] = useState<string>("");
  const [teEndTime, setTeEndTime] = useState<string>("");
  const [teNotes, setTeNotes] = useState<string>("");
  const [teSaving, setTeSaving] = useState(false);
  const timeOptions = useMemo(() => makeTimeOptions(30), []);

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

  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [ecLoading, setEcLoading] = useState(false);
  const [ecError, setEcError] = useState<string>("");

  // admin edit
  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSaved, setEditSaved] = useState(false);
  const [editLocked, setEditLocked] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelSaved, setCancelSaved] = useState(false);

  const [adminCustomers, setAdminCustomers] = useState<AdminCustomer[]>([]);
  const [adminEmployees, setAdminEmployees] = useState<AdminEmployee[]>([]);
  const [adminListsLoading, setAdminListsLoading] = useState(false);
  const [adminListsError, setAdminListsError] = useState("");

  const [editCustomerId, setEditCustomerId] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");

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

  const employeeName = useMemo(() => {
    const emp = data?.employee;
    return emp?.fullName || emp?.email || "";
  }, [data?.employee]);

  const customerAddress = useMemo(() => data?.customer?.address || "", [data]);
  const customerPhone = useMemo(() => data?.customer?.phone || "", [data]);
  const customerId = useMemo(() => data?.customerId || data?.customer?.id || "", [data]);

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

  const summary = useMemo(() => {
    const t = data?.totals;
    const kmRecorded = typeof data?.kilometers === "number" ? data.kilometers : null;
    const kmFinal = typeof data?.kmFinal === "number"
      ? data.kmFinal
      : typeof data?.kilometers === "number"
        ? data.kilometers
        : null;
    return {
      planned: t?.plannedMinutes ?? 0,
      recorded: t?.recordedMinutes ?? 0,
      adjustments: t?.adjustedMinutes ?? 0,
      final: t?.finalMinutes ?? 0,
      kmRecorded,
      kmAdjustments: t?.kmAdjusted ?? data?.kmAdjusted ?? 0,
      kmFinal,
    };
  }, [data?.kilometers, data?.kmAdjusted, data?.kmFinal, data?.totals]);

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
  const isCancelled = statusU === "CANCELLED";
  const isConfirmed = statusU === "CONFIRMED";
  const isAssigned = statusU === "ASSIGNED";
  const canSign = isConfirmed || isDone;

  async function loadAssignment() {
    setLoading(true);
    setErr("");
    try {
      const endpoint = `/api/assignments/${id}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      setData(json);

      if (typeof json?.kilometers === "number") {
        setKmValue(String(json.kilometers));
        setKmLoadState("value");
      } else {
        setKmValue("");
        setKmLoadState("empty");
      }

      // initialize time entry defaults from assignment
      const startParts = splitLocalDateTime(json?.startAt);
      const endParts = splitLocalDateTime(json?.endAt);
      if (startParts.date) setTeDate(startParts.date);
      if (startParts.time) setTeStartTime(startParts.time);
      if (!startParts.date && endParts.date) setTeDate(endParts.date);
      if (endParts.time) setTeEndTime(endParts.time);
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

  async function loadAdminLists() {
    if (adminListsLoading) return;
    setAdminListsLoading(true);
    setAdminListsError("");
    try {
      const [empRes, custRes] = await Promise.all([
        fetch("/api/admin/employees", { cache: "no-store" }),
        fetch("/api/customers?limit=50", { cache: "no-store" }),
      ]);
      const empJson = await empRes.json().catch(() => []);
      const custJson = await custRes.json().catch(() => ({}));
      if (!empRes.ok) throw new Error(empJson?.message || `HTTP ${empRes.status}`);
      if (!custRes.ok) throw new Error(custJson?.message || `HTTP ${custRes.status}`);

      setAdminEmployees(Array.isArray(empJson) ? empJson : []);
      const customers = Array.isArray(custJson)
        ? custJson
        : Array.isArray(custJson?.items)
          ? custJson.items
          : [];
      setAdminCustomers(customers);
    } catch (e: any) {
      setAdminListsError(e?.message || "Listen konnten nicht geladen werden.");
      setAdminEmployees([]);
      setAdminCustomers([]);
    } finally {
      setAdminListsLoading(false);
    }
  }

  function openEditForm() {
    if (!data) return;
    setEditMode(true);
    setEditError("");
    setEditLocked(false);
    setEditCustomerId(data.customerId || data.customer?.id || "");
    setEditEmployeeId(data.employeeId || data.employee?.id || "");
    const startParts = splitLocalDateTime(data.startAt);
    const endParts = splitLocalDateTime(data.endAt);
    setEditStartDate(startParts.date);
    setEditStartTime(startParts.time);
    setEditEndDate(endParts.date);
    setEditEndTime(endParts.time);
    setEditNotes(data.notes || "");
    setEditStatus(String(data.status || "").toUpperCase());
    if (adminCustomers.length === 0 || adminEmployees.length === 0) {
      void loadAdminLists();
    }
  }

  function closeEditForm() {
    setEditMode(false);
    setEditError("");
    setEditLocked(false);
  }

  async function submitAdminEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editSaving) return;
    setEditError("");
    setEditLocked(false);

    if (!editCustomerId || !editEmployeeId || !editStartDate || !editStartTime || !editEndDate || !editEndTime) {
      setEditError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    const startIso = new Date(`${editStartDate}T${editStartTime}`).toISOString();
    const endIso = new Date(`${editEndDate}T${editEndTime}`).toISOString();
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setEditError("Endzeit muss nach der Startzeit liegen.");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: editCustomerId,
          employeeId: editEmployeeId,
          startAt: startIso,
          endAt: endIso,
          notes: editNotes.trim() || null,
          status: editStatus || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && String(json?.message || "").includes("LOCKED_AFTER_SIGNATURE")) {
          setEditLocked(true);
          setEditError("Gesperrt nach Unterschrift – nur Admin-Korrektur möglich.");
          return;
        }
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setEditSaved(true);
      await loadAssignment();
    } catch (e: any) {
      setEditError(e?.message || "Speichern fehlgeschlagen.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAdminCancel() {
    if (cancelSaving || editSaving) return;
    if (!confirm("Termin wirklich absagen?")) return;
    setEditError("");
    setEditLocked(false);
    setCancelSaving(true);
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && String(json?.message || "").includes("LOCKED_AFTER_SIGNATURE")) {
          setEditLocked(true);
          setEditError("Gesperrt nach Unterschrift – nur Admin-Korrektur möglich.");
          return;
        }
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setCancelSaved(true);
      await loadAssignment();
    } catch (e: any) {
      setEditError(e?.message || "Absagen fehlgeschlagen.");
    } finally {
      setCancelSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let admin = false;
      try {
        const meRes = await fetch("/api/users/me", { cache: "no-store" });
        const meJson = await meRes.json().catch(() => ({}));
        admin = meRes.ok && meJson?.role === "ADMIN";
      } catch {
        admin = false;
      }

      if (!cancelled) setIsAdmin(admin);

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
    if (!editSaved) return;
    const t = window.setTimeout(() => setEditSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [editSaved]);

  useEffect(() => {
    if (!cancelSaved) return;
    const t = window.setTimeout(() => setCancelSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [cancelSaved]);

  useEffect(() => {
    if (!kmDate) return;
    setKmLocked(false);
    if (typeof data?.kilometers === "number") {
      setKmValue(String(data.kilometers));
      setKmLoadState("value");
      return;
    }
    setKmValue("");
    setKmLoadState("empty");
  }, [kmDate, data?.kilometers]);

  useEffect(() => {
    if (!kmSavedAt) return;
    const t = window.setTimeout(() => setKmSavedAt(null), 2500);
    return () => window.clearTimeout(t);
  }, [kmSavedAt]);

  async function handleAddTimeEntry() {
    if (teSaving) return;
    setTeErr("");

    if (!teDate) {
      setTeErr("Bitte Datum wählen.");
      return;
    }
    if (!teStartTime || !teEndTime) {
      setTeErr("Bitte Start- und Endzeit angeben.");
      return;
    }

    const startIso = new Date(`${teDate}T${teStartTime}`).toISOString();
    const endIso = new Date(`${teDate}T${teEndTime}`).toISOString();

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
  useEffect(() => {
    function initCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const width = rect.width || canvas.clientWidth || 700;
      const height = rect.height || canvas.clientHeight || 220;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineWidth = 2 * ratio;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111";
    }

    initCanvas();

    const canvas = canvasRef.current;
    const ro = canvas ? new ResizeObserver(() => initCanvas()) : null;
    if (canvas && ro) ro.observe(canvas);

    window.addEventListener("resize", initCanvas);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", initCanvas);
      window.visualViewport.addEventListener("scroll", initCanvas);
    }

    return () => {
      window.removeEventListener("resize", initCanvas);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", initCanvas);
        window.visualViewport.removeEventListener("scroll", initCanvas);
      }
      if (ro && canvas) ro.unobserve(canvas);
    };
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const endpoint = `/api/customers/${customerId}/emergency-contacts`;
    setEcLoading(true);
    setEcError("");
    (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = await res.json().catch(() => ([]));
        if (res.status === 404) {
          if (!cancelled) {
            setEmergencyContacts([]);
            setEcError("");
          }
          return;
        }
        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        const items = Array.isArray(json) ? json : [];
        if (!cancelled) {
          setEmergencyContacts(items);
        }
      } catch (e: any) {
        if (!cancelled) {
          setEmergencyContacts([]);
          setEcError(e?.message || "Notfallkontakte konnten nicht geladen werden.");
        }
      } finally {
        if (!cancelled) setEcLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, customerId]);

  function getPos(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    const x = ((clientX ?? 0) - rect.left) * scaleX;
    const y = ((clientY ?? 0) - rect.top) * scaleY;
    return { x, y };
  }

  function startDraw(e: any) {
    if (!canvasRef.current) return;
    e.preventDefault?.();
    if (e?.currentTarget?.setPointerCapture && e?.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
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
      const res = await fetch(`/api/me/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kilometers: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && String(json?.message || "").includes("KM_EDIT_LOCKED_AFTER_SIGNATURE")) {
          setKmLocked(true);
          setIsKmLockedBySignature(true);
          return;
        }
        throw new Error(json?.message || "Fehler beim Speichern");
      }

      setKmSavedAt(Date.now());
      setIsKmLockedBySignature(false);
      await loadAssignment();
    } catch (e: any) {
      const msg = e?.message || "Fehler beim Speichern";
      if (msg.includes("KM_EDIT_LOCKED_AFTER_SIGNATURE")) {
        setKmLocked(true);
        setIsKmLockedBySignature(true);
      } else if (msg.includes("KM_EDIT_ONLY_CONFIRMED")) {
        setKmErr("Bitte bestätige zuerst den Termin, bevor Kilometer erfasst werden können.");
      } else if (msg.includes("KM_EDIT_NOT_ALLOWED_DONE")) {
        setKmErr("KM kann nach Abschluss nicht mehr geändert werden.");
      } else if (msg.includes("KM_EDIT_LOCKED_MONTH")) {
        setKmErr("Monat gesperrt – KM nur über Admin-Korrektur.");
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
        <StateNotice variant="loading" message="Lade…" />
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="min-h-screen p-4">
        <Card>
          <div className="font-semibold">Fehler</div>
          <div className="mt-1 text-sm text-gray-700">{err || "Nicht gefunden"}</div>
          <div className="mt-4">
            <Link href="/planner" className="rounded border px-3 py-2 text-sm inline-block">
              ← Zur Planung
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="space-y-6">
        {showCreated ? (
          <Alert variant="success">
            Gespeichert ✓
          </Alert>
        ) : null}
        <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{customerName}</h1>
          {customerAddress ? <div className="text-sm text-gray-700">{customerAddress}</div> : null}
          {customerPhone ? <div className="text-sm text-gray-700">{customerPhone}</div> : null}
          {employeeName ? <div className="text-sm text-gray-700">{employeeName}</div> : null}
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

      <Card variant="subtle" className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Notfallkontakte</h3>
          <div className="flex items-center">
            <Pill className="ml-2">
              {ecLoading ? "…" : emergencyContacts.length}
            </Pill>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2 rounded-md"
              onClick={() => setEmergencyOpen((prev) => !prev)}
              disabled={!customerId || (!ecLoading && emergencyContacts.length === 0)}
              aria-label={emergencyOpen ? "Ausblenden" : "Anzeigen"}
              title={emergencyOpen ? "Ausblenden" : "Anzeigen"}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center transition-transform ${emergencyOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </Button>
          </div>
        </div>

        {ecError ? <div className="mt-2 text-xs text-red-600">{ecError}</div> : null}
        {ecLoading ? <div className="mt-2 text-sm text-gray-600">Lade…</div> : null}

        {!ecLoading && !emergencyOpen && emergencyContacts.length === 1 ? (
          <div className="mt-1 text-xs text-gray-600">1 Kontakt vorhanden</div>
        ) : null}

        {!ecLoading && emergencyContacts.length === 0 ? (
          <div className="mt-2 text-sm text-gray-600">Keine Notfallkontakte hinterlegt.</div>
        ) : null}

        {emergencyOpen && emergencyContacts.length > 0 ? (
          <div className="mt-2 space-y-2">
            {emergencyContacts.map((c) => {
              const tel = c.phone?.replace(/[^\d+]/g, "");
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded border bg-white px-2 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.relation ? (
                      <div className="text-xs text-gray-600">{c.relation}</div>
                    ) : null}
                    <div className="text-xs text-gray-600">{c.phone}</div>
                  </div>
                  {tel ? (
                    <a
                      className="inline-flex h-8 w-8 items-center justify-center rounded border text-gray-700 hover:bg-gray-50"
                      href={`tel:${tel}`}
                      aria-label="Anrufen"
                      title="Anrufen"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9a16 16 0 0 0 7 7l.7-1.1a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2z" />
                      </svg>
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      {/* TOP META + ACTIONS */}
      <Card className="mt-4">
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
              <StatusPill status={data.status} />
              {isLocked ? (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-amber-100 text-amber-800 border-amber-300"
                  aria-label="Gesperrt"
                  title="Gesperrt"
                >
                  <span aria-hidden="true">🔒</span>
                </span>
              ) : null}
            </div>
            {isLocked ? (
              <div className="mt-1 text-xs text-gray-600">
                Gesperrt nach Unterschrift – Änderungen nur durch Admin-Korrektur möglich.
              </div>
            ) : null}
            {data?.updatedAt ? (
              <div className="mt-1 text-xs text-gray-500">
                Letzte Änderung: {formatDateTime(data.updatedAt)}
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

        {isAdmin ? (
          <Card className="mt-4 p-3" variant="subtle">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-semibold">Admin bearbeiten</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={editMode ? closeEditForm : openEditForm}
              >
                {editMode ? "Schließen" : "Bearbeiten"}
              </Button>
            </div>

            {editSaved ? <div className="mt-2 text-xs text-green-700">Gespeichert ✓</div> : null}
            {cancelSaved ? <div className="mt-2 text-xs text-green-700">Termin abgesagt ✓</div> : null}
            {editError ? (
              <Alert variant="error" className="mt-2 text-xs">
                {editError}
              </Alert>
            ) : null}
            {adminListsError ? (
              <Alert variant="error" className="mt-2 text-xs">
                {adminListsError}
              </Alert>
            ) : null}
            {isLocked ? (
              <div className="mt-2 text-xs text-gray-600">
                Gesperrt nach Unterschrift – nur Admin-Korrektur moeglich.
              </div>
            ) : null}

            {editMode ? (
              <form className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={submitAdminEdit}>
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Kunde</span>
                  <select
                    value={editCustomerId}
                    onChange={(e) => setEditCustomerId(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked || adminListsLoading}
                  >
                    <option value="">Bitte wählen…</option>
                    {adminCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.name || c.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Mitarbeiter</span>
                  <select
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked || adminListsLoading}
                  >
                    <option value="">Bitte wählen…</option>
                    {adminEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {(e.fullName ? `${e.fullName} · ` : "") + (e.email || e.id)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Start</span>
                  <input
                    type="date"
                    lang="de-DE"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked}
                  />
                  <select
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked}
                  >
                    <option value="">Bitte wählen…</option>
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Ende</span>
                  <input
                    type="date"
                    lang="de-DE"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked}
                  />
                  <select
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked}
                  >
                    <option value="">Bitte wählen…</option>
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs text-gray-600">Notiz</span>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Status</span>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="min-h-[40px] w-full rounded border px-3 py-2 text-sm"
                    disabled={editSaving || editLocked || isLocked}
                  >
                    <option value="PLANNED">{statusLabelDe("PLANNED")}</option>
                    <option value="ASSIGNED">{statusLabelDe("ASSIGNED")}</option>
                    <option value="CONFIRMED">{statusLabelDe("CONFIRMED")}</option>
                    <option value="DONE">{statusLabelDe("DONE")}</option>
                    <option value="CANCELLED">{statusLabelDe("CANCELLED")}</option>
                  </select>
                </label>

                <div className="sm:col-span-2 sticky bottom-0 -mx-3 mt-2 border-t bg-white px-3 pt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={closeEditForm}
                    >
                      Schließen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAdminCancel}
                      disabled={cancelSaving || editSaving || editLocked || isLocked || isCancelled || isDone}
                    >
                      {cancelSaving ? "Sage ab…" : "Termin absagen"}
                    </Button>
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={editSaving || editLocked || isLocked}
                    >
                      {editSaving ? "Speichern…" : "Speichern"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : null}
          </Card>
        ) : null}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {String(data?.status || "").toUpperCase() === "ASSIGNED" ? (
            <Button
              type="button"
              onClick={handleAcknowledge}
              disabled={ackLoading}
              variant="outline"
              size="sm"
            >
              {ackLoading ? "Bestätige…" : "Termin bestätigen"}
            </Button>
          ) : null}

          {ackErr ? <div className="text-sm text-red-600">{ackErr}</div> : null}
          {doneErr ? <div className="text-sm text-red-600">{doneErr}</div> : null}
        </div>
      </Card>

      {/* TOTALS */}
      <Card className="mt-4">
        <h2 className="text-base font-semibold mb-3">Summen</h2>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div className="col-span-2 flex items-baseline justify-between">
            <div className="text-gray-600">Geplant</div>
            <div className="font-medium">{formatMinutes(summary.planned)}</div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-gray-600">Erfasst</div>
            <div className="font-medium">{formatMinutes(summary.recorded)}</div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-gray-600">KM erfasst</div>
            <div className="font-medium">{summary.kmRecorded ?? 0}</div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-gray-600">Korrektur</div>
            <div className="font-medium">{formatSignedMinutes(summary.adjustments)}</div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-gray-600">KM Korrektur</div>
            <div className="font-medium">
              {(summary.kmAdjustments ?? 0) >= 0 ? "+" : ""}
              {summary.kmAdjustments ?? 0}
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-gray-600">Final</div>
            <div className="font-semibold">{formatMinutes(summary.final)}</div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-gray-600">KM final</div>
            <div className="font-semibold">{summary.kmFinal ?? summary.kmRecorded ?? 0}</div>
          </div>
        </div>
      </Card>

      {/* KM PER DAY */}
      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold">
            Kilometer (Tag)
            {lockAfterSignatureActive ? (
              <span className="ml-1 inline-flex items-center text-gray-600" aria-label="Gesperrt" title="Gesperrt">
                <span aria-hidden="true">🔒</span>
              </span>
            ) : null}
          </h2>
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
                  : data?.kilometers != null
                    ? String(data.kilometers)
                    : "Nicht erfasst"}
              </div>
              <span className="rounded border px-2 py-0.5 text-xs text-gray-600">Nur Anzeige</span>
            </>
          ) : isReceiptMode ? (
            <div className="text-sm text-gray-700">
              {kmLoadState === "error"
                ? "Fehler beim Laden"
                : data?.kilometers != null
                  ? String(data.kilometers)
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
                  disabled={kmSaving || isAssigned || isDone || isLocked || isKmLockedBySignature || kmLocked}
                />
              )}

              {kmLoadState !== "error" ? (
                <Button
                  type="button"
                  onClick={handleKmSave}
                  disabled={kmSaving || isAssigned || isDone || isLocked || isKmLockedBySignature || kmLocked}
                  variant="outline"
                  size="sm"
                  className={lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}
                >
                  {kmSaving ? "Speichern…" : "Speichern"}
                </Button>
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

              {kmSavedAt ? <div className="text-sm text-green-700">✓ Kilometer gespeichert</div> : null}
            </>
          )}
        </div>

        {isLocked || isKmLockedBySignature ? (
          <div className="mt-2 text-sm text-gray-600">
            Gesperrt nach Unterschrift: Kilometer (tagesbasiert) und Zeiteinträge sind nach jeder Unterschrift an diesem Tag gesperrt. Änderungen nur via Admin-Korrektur.{" "}
            {isAdmin ? (
              <>
                Bitte Admin kontaktieren: <Link href="/admin/corrections" className="underline">Admin → Korrekturen → Tag</Link>.
              </>
            ) : (
              <>Bitte Admin kontaktieren.</>
            )}
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
      </Card>

      {/* TIME ENTRIES */}
      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold">
            Zeiteinträge
            {lockAfterSignatureActive ? (
              <span className="ml-1 inline-flex items-center text-gray-600" aria-label="Gesperrt" title="Gesperrt">
                <span aria-hidden="true">🔒</span>
              </span>
            ) : null}
          </h2>
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
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-600">Datum</label>
                <input
                  type="date"
                  lang="de-DE"
                  value={teDate}
                  onChange={(e) => setTeDate(e.target.value)}
                  className={`mt-1 w-full rounded border px-2 py-2 text-sm ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={teSaving || isSigned}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Start</label>
                <select
                  value={teStartTime}
                  onChange={(e) => setTeStartTime(e.target.value)}
                  className={`mt-1 w-full rounded border px-2 py-2 text-sm ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={teSaving || isSigned}
                >
                  <option value="">Bitte wählen…</option>
                  {timeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Ende</label>
                <select
                  value={teEndTime}
                  onChange={(e) => setTeEndTime(e.target.value)}
                  className={`mt-1 w-full rounded border px-2 py-2 text-sm ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={teSaving || isSigned}
                >
                  <option value="">Bitte wählen…</option>
                  {timeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  onClick={handleAddTimeEntry}
                  disabled={teSaving || isSigned}
                  variant="outline"
                  size="sm"
                  className={`w-full ${lockAfterSignatureActive ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {teSaving ? "Speichern…" : "Zeit hinzufügen"}
                </Button>
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
            Gesperrt nach Unterschrift: Kilometer (tagesbasiert) und Zeiteinträge sind nach jeder Unterschrift an diesem Tag gesperrt. Änderungen nur via Admin-Korrektur. Bitte Admin kontaktieren.
          </div>
        ) : null}

        <div className="mt-4">
          {teLoading ? (
            <StateNotice variant="loading" message="Lade Zeiteinträge…" />
          ) : timeEntries.length === 0 ? (
            <StateNotice variant="empty" message="Noch keine Zeiteinträge." />
          ) : (
            <ul className="space-y-2">
              {timeEntries.map((t) => {
                let mins = 0;
                let leftLabel = "—";

                if (typeof t.minutes === "number") {
                  mins = Math.max(0, Math.round(t.minutes));
                  leftLabel = `Datum: ${t.date ? formatDate(t.date) : "—"}`;
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
      </Card>

      {/* SIGNATURE */}
      <Card className="mt-4">
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
                      onPointerDown={startDraw}
                      onPointerMove={moveDraw}
                      onPointerUp={endDraw}
                      onPointerLeave={endDraw}
                      onPointerCancel={endDraw}
                    />
                  </div>

                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={clearSig}>
                      Löschen
                    </Button>
                    <Button
                      type="button"
                      onClick={submitSig}
                      disabled={sigSaving}
                      variant="outline"
                      size="sm"
                    >
                      {sigSaving ? "Speichere…" : "Unterschrift speichern"}
                    </Button>
                    {sigOk ? <div className="text-sm text-green-700 flex items-center">{sigOk}</div> : null}
                  </div>

                  {sigErr ? <div className="mt-2 text-sm text-red-600">{sigErr}</div> : null}
                </>
              ) : (
                <div className="mt-2 text-sm text-gray-600">
                  Unterschrift ist möglich, sobald der Termin bestätigt wurde.
                </div>
              )}
            </>
          ) : null}
        </div>
      </Card>
    </div>
    </main>
  );
}
