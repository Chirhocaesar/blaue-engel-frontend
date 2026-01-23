function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isoToDeDate(iso?: string | null): string {
  if (!iso) return "";
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return `${pad2(day)}.${pad2(month)}.${year}`;
}

export function deDateToIso(de?: string | null): string | null {
  if (!de) return null;
  const match = String(de).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function normalizeDeTime(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const normalized = raw.replace(/[\.\s]/g, ":");
  const parts = normalized.split(":").filter(Boolean);

  let hours: number | null = null;
  let minutes: number | null = null;

  if (parts.length === 1) {
    const digits = parts[0];
    if (!/^\d{1,4}$/.test(digits)) return null;
    if (digits.length <= 2) {
      hours = Number(digits);
      minutes = 0;
    } else {
      const h = digits.slice(0, digits.length - 2);
      const m = digits.slice(-2);
      hours = Number(h);
      minutes = Number(m);
    }
  } else if (parts.length === 2) {
    if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[1])) return null;
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  } else {
    return null;
  }

  if (hours === null || minutes === null) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function makeTimeOptions(stepMinutes: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const step = Math.max(1, Math.floor(stepMinutes));
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const value = `${pad2(h)}:${pad2(m)}`;
    options.push({ value, label: value });
  }
  return options;
}
