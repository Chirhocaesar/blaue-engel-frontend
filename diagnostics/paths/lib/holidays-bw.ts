export type BwHoliday = {
  date: string; // YYYY-MM-DD
  label: string;
};

// MVP: static list for 2026 (extend later if needed)
export const BW_HOLIDAYS_2026: BwHoliday[] = [
  { date: "2026-01-01", label: "Neujahr" },
  { date: "2026-01-06", label: "Heilige Drei Könige" },
  { date: "2026-04-03", label: "Karfreitag" },
  { date: "2026-04-06", label: "Ostermontag" },
  { date: "2026-05-01", label: "Tag der Arbeit" },
  { date: "2026-05-14", label: "Christi Himmelfahrt" },
  { date: "2026-05-25", label: "Pfingstmontag" },
  { date: "2026-06-04", label: "Fronleichnam" },
  { date: "2026-10-03", label: "Tag der Deutschen Einheit" },
  { date: "2026-11-01", label: "Allerheiligen" },
  { date: "2026-12-25", label: "1. Weihnachtstag" },
  { date: "2026-12-26", label: "2. Weihnachtstag" },
];

export function isBwHoliday(date: Date): string | null {
  const iso = date.toISOString().slice(0, 10);
  const h = BW_HOLIDAYS_2026.find((x) => x.date === iso);
  return h ? h.label : null;
}

export function getUpcomingBwHolidays(from: Date, limit = 5): BwHoliday[] {
  const fromIso = from.toISOString().slice(0, 10);
  return BW_HOLIDAYS_2026
    .filter((h) => h.date >= fromIso)
    .slice(0, limit);
}
export function getBwHolidayLabelByIsoDate(isoDate: string): string | null {
  const h = BW_HOLIDAYS_2026.find((x) => x.date === isoDate);
  return h ? h.label : null;
}
