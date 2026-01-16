// src/lib/api.ts
export const API_BASE_URL =
  process.env.API_BASE_URL || "https://api.blaueengelhaushaltshilfe.de";

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

export async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const status = res.status;
  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const err: ApiError = {
      status,
      message:
        (json && (json.message || json.error)) ||
        `Request failed with status ${status}`,
      details: json ?? text,
    };
    throw err;
  }

  return (json as T) ?? ({} as T);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
