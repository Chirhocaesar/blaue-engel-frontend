export type HessenHoliday = {
  date: string; // YYYY-MM-DD
  label: string;
};

// Gesetzliche Feiertage in Hessen, 2026 (extend later if needed)
export const HESSEN_HOLIDAYS_2026: HessenHoliday[] = [
  { date: "2026-01-01", label: "Neujahr" },
  { date: "2026-04-03", label: "Karfreitag" },
  { date: "2026-04-06", label: "Ostermontag" },
  { date: "2026-05-01", label: "Tag der Arbeit" },
  { date: "2026-05-14", label: "Christi Himmelfahrt" },
  { date: "2026-05-25", label: "Pfingstmontag" },
  { date: "2026-06-04", label: "Fronleichnam" },
  { date: "2026-10-03", label: "Tag der Deutschen Einheit" },
  { date: "2026-12-25", label: "1. Weihnachtstag" },
  { date: "2026-12-26", label: "2. Weihnachtstag" },
];

export function isHessenHoliday(date: Date): string | null {
  const iso = date.toISOString().slice(0, 10);
  const h = HESSEN_HOLIDAYS_2026.find((x) => x.date === iso);
  return h ? h.label : null;
}

export function getUpcomingHessenHolidays(from: Date, limit = 5): HessenHoliday[] {
  const fromIso = from.toISOString().slice(0, 10);
  return HESSEN_HOLIDAYS_2026
    .filter((h) => h.date >= fromIso)
    .slice(0, limit);
}

export function getHessenHolidayLabelByIsoDate(isoDate: string): string | null {
  const h = HESSEN_HOLIDAYS_2026.find((x) => x.date === isoDate);
  return h ? h.label : null;
}
