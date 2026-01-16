export default async function HealthPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Health</h1>
        <p>Missing NEXT_PUBLIC_API_BASE_URL</p>
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
    error = e?.message ?? "Unknown error";
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>
        Blaue Engel – Frontend API Check
      </h1>

      <p>API Base URL: <code>{baseUrl}</code></p>

      {error && (
        <p style={{ color: "crimson", marginTop: 12 }}>
          Error: {error}
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
