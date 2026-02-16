"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMinutes } from "@/lib/format";
import { deDateToIso, isoToDeDate } from "@/lib/datetime-de";
import { useNativePickers } from "@/lib/useNativePickers";
import { statusLabelDe } from "@/lib/status";

type TimeEntry = {
  id: string;
  date: string;
  minutes: number;
  startTime?: string | null;
  endTime?: string | null;
  customerId?: string | null;
  assignmentId?: string | null;
  createdAt?: string;
};

export function TimeEntriesBox({
  assignmentId,
  defaultDateISO,
  assignmentStatus,
}: {
  assignmentId: string;
  defaultDateISO: string;
  assignmentStatus: string;
}) {

  const [items, setItems] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDate = useMemo(() => {
    const d = new Date(defaultDateISO);
    if (Number.isNaN(d.getTime())) return "";
    // yyyy-mm-dd for <input type="date">
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [defaultDateISO]);

  const [date, setDate] = useState("");
  const [dateDe, setDateDe] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const showNativeInputs = useNativePickers();

  useEffect(() => {
    setDate(defaultDate);
    setDateDe(isoToDeDate(defaultDate));
  }, [defaultDate]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/me/time-entries?assignmentId=${encodeURIComponent(assignmentId)}&limit=50`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? `Laden fehlgeschlagen (${res.status})`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message ?? "Konnte Zeiteinträge nicht laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  async function submit() {
    setError(null);

    const m = parseInt(minutes, 10);
    if (showNativeInputs) {
      if (!date) return setError("Bitte Datum wählen.");
    } else {
      const parsed = deDateToIso(dateDe);
      if (!parsed) return setError("Bitte Datum im Format TT.MM.JJJJ angeben.");
      if (parsed !== date) setDate(parsed);
    }
    if (!Number.isFinite(m) || m <= 0) return setError("Minuten müssen > 0 sein.");

    setSubmitting(true);
    try {
      const payload: any = {
        assignmentId,
        date,
        minutes: m,
      };

      // optional fields
      if (startTime.trim()) payload.startTime = startTime.trim();
      if (endTime.trim()) payload.endTime = endTime.trim();

      const res = await fetch(`/api/me/time-entries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? `Erstellen fehlgeschlagen (${res.status})`);

      // refresh list
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erstellen fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/me/time-entries?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? `Löschen fehlgeschlagen (${res.status})`);

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  const canAdd = assignmentStatus === "CONFIRMED" || assignmentStatus === "DONE";

  const totalMinutes = useMemo(() => {
    return items.reduce((sum, t) => sum + (Number.isFinite(t.minutes) ? t.minutes : 0), 0);
  }, [items]);

  return (
    <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Zeiteinträge</h2>
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Diese Einträge sind direkt mit dem Einsatz verbunden.
      </div>

      {error ? (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #ffcccc", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      {!canAdd ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ fontWeight: 700 }}>Zeiteintrag aktuell nicht möglich</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            Bitte zuerst den Einsatz bestätigen (Status: {statusLabelDe("CONFIRMED")}) oder abschließen (Status: {statusLabelDe("DONE")}).
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Datum</span>
              {showNativeInputs ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const nextIso = e.target.value;
                    setDate(nextIso);
                    setDateDe(isoToDeDate(nextIso));
                  }}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                  disabled={submitting}
                />
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="TT.MM.JJJJ"
                  value={dateDe}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDateDe(next);
                    const nextIso = deDateToIso(next);
                    setDate(nextIso || "");
                  }}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                  disabled={submitting}
                />
              )}
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Minuten</span>
              <input
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                disabled={submitting}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Start (optional)</span>
              <input
                placeholder="09:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                disabled={submitting}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Ende (optional)</span>
              <input
                placeholder="10:30"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                disabled={submitting}
              />
            </label>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            {submitting ? "Bitte warten…" : "Zeiteintrag hinzufügen"}
          </button>
        </div>
      )}


      <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Vorhandene Einträge</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Gesamt: {formatMinutes(totalMinutes)}</div>
        </div>

        {loading ? (
          <div style={{ opacity: 0.7 }}>Lade…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Noch keine Zeiteinträge.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((t) => (
              <div
                key={t.id}
                style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}
              >
                <div style={{ fontSize: 13 }}>
                  <b>{t.date ? formatDate(t.date) : "—"}</b>{" "}
                  – {formatMinutes(Number.isFinite(t.minutes) ? t.minutes : 0)}
                </div>

                {(t.startTime || t.endTime) ? (
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {t.startTime ? `Start: ${t.startTime}` : null}
                    {t.startTime && t.endTime ? " · " : null}
                    {t.endTime ? `Ende: ${t.endTime}` : null}
                  </div>
                ) : null}

                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      if (confirm("Zeiteintrag wirklich löschen?")) remove(t.id);
                    }}
                    disabled={submitting}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ccc",
                      fontSize: 13,
                    }}
                  >
                    Löschen
                  </button>

                  <div style={{ fontSize: 11, opacity: 0.6, wordBreak: "break-all" }}>
                    {t.id}
                  </div>
                </div>

                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, wordBreak: "break-all" }}>
                  {t.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
