export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { EmployeeActions } from "./EmployeeActions";
import { TimeEntriesBox } from "./TimeEntriesBox";

const API_BASE =
  process.env.API_BASE_URL ?? "https://api.blaueengelhaushaltshilfe.de";

  function mapsLink(address?: string | null) {
  if (!address) return null;
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}


async function apiFetch(path: string, accessToken: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);

  return res.json();
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id;
  if (!id) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;
  if (!token) redirect("/login");

  const me = await apiFetch("/users/me", token);
  if (!me) notFound();

  const assignment =
    me.role === "ADMIN"
      ? await apiFetch(`/assignments/${id}`, token)
      : await apiFetch(`/me/assignments/${id}`, token);

  if (!assignment) notFound();

  const navUrl = mapsLink(assignment?.customer?.address ?? null);

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Assignment</h1>
          <div style={{ opacity: 0.7, fontSize: 14 }}>{assignment.id}</div>
        </div>
        <Link href="/assignments" style={{ textDecoration: "underline" }}>
          Back to list
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Status</div>
            <div>{assignment.status}</div>
          </div>

          <div>
  <div style={{ fontWeight: 600 }}>Customer</div>
  <div>{assignment.customer?.name ?? "—"}</div>

  {assignment.customer?.address ? (
    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
      {assignment.customer.address}
    </div>
  ) : null}

  {navUrl ? (
    <a
      href={navUrl}
      rel="noopener noreferrer"
      style={{
        display: "inline-block",
        marginTop: 8,
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #111",
        background: "#111",
        color: "#fff",
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      📍 Navigation öffnen
    </a>
  ) : null}
</div>

          <div>
            <div style={{ fontWeight: 600 }}>Start</div>
            <div>{new Date(assignment.startAt).toLocaleString()}</div>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>End</div>
            <div>{new Date(assignment.endAt).toLocaleString()}</div>
          </div>
        </div>

        {assignment.notes ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600 }}>Notes</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{assignment.notes}</div>
          </div>
        ) : null}
      </div>

      {me.role === "ADMIN" ? (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Zeiteinträge
          </h2>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Admin view – Zeiteinträge für dieses Assignment.
          </div>

          <TimeEntriesAdmin assignmentId={assignment.id} />
        </div>
      ) : null}


      {me.role === "ADMIN" ? (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Signatures
          </h2>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Admin view – stored signatures for this assignment.
          </div>

          <SignaturesAdmin assignmentId={assignment.id} />
        </div>
      ) : null}

      {me.role === "EMPLOYEE" ? (
        <TimeEntriesBox
          assignmentId={assignment.id}
          defaultDateISO={assignment.startAt}
          assignmentStatus={assignment.status}
        />
      ) : null}

      {me.role === "EMPLOYEE" ? (
        <EmployeeActions assignmentId={assignment.id} status={assignment.status} />
      ) : null}
    </div>
  );
}

async function SignaturesAdmin({ assignmentId }: { assignmentId: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;
  if (!token) return <div>Nicht angemeldet.</div>;

  const res = await fetch(`${API_BASE}/assignments/${assignmentId}/signatures`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return (
      <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
        {JSON.stringify({ status: res.status, data }, null, 2)}
      </pre>
    );
  }

  const items: any[] = Array.isArray(data) ? data : [];
  if (items.length === 0) {
    return <div style={{ marginTop: 10 }}>Keine Unterschriften vorhanden.</div>;
  }

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
      {items.map((s) => (
        <div
          key={s.id}
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, wordBreak: "break-all" }}>
            <div>
              <b>ID:</b> {s.id}
            </div>
            {s.createdAt ? (
              <div>
                <b>Created:</b> {new Date(s.createdAt).toLocaleString("de-DE")}
              </div>
            ) : null}
          </div>

          {typeof s.signatureData === "string" && s.signatureData.startsWith("data:image") ? (
            <div style={{ marginTop: 10 }}>
              <img
                src={s.signatureData}
                alt="Signature"
                style={{
                  width: "100%",
                  maxWidth: 520,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "white",
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
              Signature data is not an image data URL.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
async function TimeEntriesAdmin({ assignmentId }: { assignmentId: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;
  if (!token) return <div>Nicht angemeldet.</div>;

  const url = `${API_BASE}/admin/time-entries?assignmentId=${encodeURIComponent(
    assignmentId
  )}&limit=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return (
      <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
        {JSON.stringify({ status: res.status, data }, null, 2)}
      </pre>
    );
  }

  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  if (items.length === 0) {
    return <div style={{ marginTop: 10 }}>Keine Zeiteinträge vorhanden.</div>;
  }

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {items.map((t) => (
        <div
          key={t.id}
          style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {new Date(t.date).toLocaleDateString("de-DE")} – {t.minutes} min
          </div>

          {(t.startTime || t.endTime) ? (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {t.startTime ? `Start: ${t.startTime}` : null}
              {t.startTime && t.endTime ? " · " : null}
              {t.endTime ? `Ende: ${t.endTime}` : null}
            </div>
          ) : null}

          {t.user ? (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
              <b>Mitarbeiter:</b> {t.user.fullName ?? "—"} ({t.user.email})
            </div>
          ) : null}

          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, wordBreak: "break-all" }}>
            {t.id}
          </div>
        </div>
      ))}
    </div>
  );
}
