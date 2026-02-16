"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { statusLabelDe } from "@/lib/status";

type Status = "PLANNED" | "ASSIGNED" | "CONFIRMED" | "DONE" | "CANCELLED";

export function EmployeeActions({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: Status | string;
}) {
  const s = status as Status;

  const [busy, setBusy] = useState<null | "confirm" | "decline" | "sign">(null);
  const [error, setError] = useState<string | null>(null);

  // Decline UX
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const signatureAllowed = s === "DONE";
  const ackAllowed = s === "ASSIGNED"; // confirm/decline only when assigned

  const statusHint = useMemo(() => {
    if (s === "CANCELLED") return "Diese Leistung wurde storniert. Keine Aktionen möglich.";
    if (s === "PLANNED") return "Noch nicht zugewiesen.";
    if (s === "ASSIGNED") return "Bitte bestätigen oder ablehnen.";
    if (s === "CONFIRMED") return `Bestätigt. Bitte nach Durchführung unterschreiben (Status: ${statusLabelDe("DONE")}).`;
    if (s === "DONE") return "Erledigt. Unterschrift möglich.";
    return `Status: ${statusLabelDe(status)}`;
  }, [s, status]);

  useEffect(() => {
    function initCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const width = rect.width || canvas.clientWidth || 600;
      const height = rect.height || canvas.clientHeight || 180;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineWidth = 2 * ratio;
      ctx.lineCap = "round";
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

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function getPoint(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    return {
      x: ((clientX ?? 0) - rect.left) * scaleX,
      y: ((clientY ?? 0) - rect.top) * scaleY,
    };
  }

  function startDraw(e: any) {
    if (!signatureAllowed) return;
    if (e?.preventDefault) e.preventDefault();
    if (e?.currentTarget?.setPointerCapture && e?.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const ctx = getCtx();
    if (!ctx) return;

    drawing.current = true;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e: any) {
    if (!drawing.current) return;
    if (e?.preventDefault) e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;

    const p = getPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function postJson(path: string, body: any, busyKey: typeof busy) {
    setError(null);
    setBusy(busyKey);

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? `Anfrage fehlgeschlagen (${res.status})`);

      window.location.reload();
    } catch (e: any) {
      setError(e?.message ?? "Etwas ist schiefgelaufen");
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    await postJson(`/api/me/assignments/${assignmentId}/ack`, { action: "CONFIRM" }, "confirm");
  }

  async function decline() {
    await postJson(
      `/api/me/assignments/${assignmentId}/ack`,
      { action: "DECLINE", reason: declineReason || undefined },
      "decline"
    );
  }

  async function submitSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL("image/png");
    if (!signatureData || signatureData.length < 50) {
      setError("Bitte unterschreiben (nicht leer).");
      return;
    }

    await postJson(
      `/api/me/assignments/${assignmentId}/signatures`,
      { signatureData },
      "sign"
    );
  }

  return (
    <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Aktionen</h2>
      <div style={{ fontSize: 13, opacity: 0.75 }}>{statusHint}</div>

      {error ? (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #ffcccc", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      {/* ACK actions */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={confirm}
          disabled={!ackAllowed || !!busy}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
        >
          {busy === "confirm" ? "Bitte warten…" : "Bestätigen"}
        </button>

        <button
          onClick={() => setShowDecline((v) => !v)}
          disabled={!ackAllowed || !!busy}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
        >
          Ablehnen…
        </button>

        {s === "CONFIRMED" ? (
          <div style={{ padding: "10px 0", fontSize: 13, opacity: 0.75 }}>
            Bereits bestätigt ✅
          </div>
        ) : null}
      </div>

      {showDecline && ackAllowed ? (
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Grund (optional)"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", minWidth: 260 }}
            disabled={!!busy}
          />
          <button
            onClick={decline}
            disabled={!!busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            {busy === "decline" ? "Bitte warten…" : "Ablehnen bestätigen"}
          </button>
        </div>
      ) : null}

      {/* Signature */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Unterschrift</div>

        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 12,
            overflow: "hidden",
            opacity: signatureAllowed ? 1 : 0.5,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: 180, display: "block", touchAction: "none" }}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            onPointerCancel={endDraw}
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={clearSignature}
            disabled={!signatureAllowed || !!busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            Löschen
          </button>

          <button
            onClick={submitSignature}
            disabled={!signatureAllowed || !!busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            {busy === "sign" ? "Bitte warten…" : "Unterschrift senden"}
          </button>
        </div>
      </div>
    </section>
  );
}

