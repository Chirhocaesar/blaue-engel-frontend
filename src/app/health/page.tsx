export default async function HealthPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Health-Check</h1>
        <p>NEXT_PUBLIC_API_BASE_URL fehlt</p>
      </main>
    );
  }

  let rootData = null;
  let healthData = null;
  let error: string | null = null;

  try {
    const rootRes = await fetch(`${baseUrl}/`, { cache: "no-store" });
    rootData = await rootRes.json();

    const healthRes = await fetch(`${baseUrl}/health`, { cache: "no-store" });
    healthData = await healthRes.json();
  } catch (e: any) {
    error = e?.message ?? "Unbekannter Fehler";
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>
        Blaue Engel – Frontend-API-Pruefung
      </h1>

      <p>API-Basis-URL: <code>{baseUrl}</code></p>

      {error && (
        <p style={{ color: "crimson", marginTop: 12 }}>
          Fehler: {error}
        </p>
      )}

      {!error && (
        <>
          <h2>GET /</h2>
          <pre>{JSON.stringify(rootData, null, 2)}</pre>

          <h2>GET /health</h2>
          <pre>{JSON.stringify(healthData, null, 2)}</pre>
        </>
      )}
    </main>
  );
}
