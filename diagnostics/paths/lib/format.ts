const LOCALE = "de-DE";

type DateInput = string | Date | null | undefined;

type MinuteInput = number | null | undefined;

type NumberInput = number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(value: DateInput): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDayMonth(value: DateInput): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatWeekdayShort(value: DateInput): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toLocaleDateString(LOCALE, { weekday: "short" });
}

export function formatMonthYear(value: DateInput): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
}

export function formatTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toLocaleString(LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeRange(start?: DateInput, end?: DateInput): string {
  if (!start && !end) return "—";
  if (start && !end) return formatDateTime(start);
  if (!start && end) return formatDateTime(end);
  return `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

export function formatMinutes(totalMinutes: MinuteInput): string {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) return "—";
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatSignedMinutes(totalMinutes: MinuteInput): string {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) return "—";
  const abs = Math.abs(Math.round(totalMinutes));
  const sign = totalMinutes > 0 ? "+" : totalMinutes < 0 ? "-" : "";
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatKm(value: NumberInput): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
