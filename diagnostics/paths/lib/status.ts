export type NormalizedStatus = "ASSIGNED" | "CONFIRMED" | "DONE" | "CANCELLED" | "PLANNED" | "";

export function normalizeStatus(input: any): NormalizedStatus {
  if (!input) return "";
  const raw = String(input).toUpperCase();
  switch (raw) {
    case "ASSIGNED":
      return "ASSIGNED";
    case "CONFIRMED":
      return "CONFIRMED";
    case "DONE":
    case "COMPLETED":
      return "DONE";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "PLANNED":
      return "PLANNED";
    default:
      return "";
  }
}

export function statusLabelDe(status?: string | null): string {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "ASSIGNED":
      return "Zugewiesen";
    case "CONFIRMED":
      return "Bestätigt";
    case "DONE":
      return "Erledigt";
    case "CANCELLED":
      return "Abgesagt";
    case "PLANNED":
      return "Geplant";
    default:
      return "—";
  }
}

export function statusPillClass(status?: string | null): string {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "ASSIGNED":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "DONE":
      return "bg-green-100 text-green-800 border-green-300";
    case "CANCELLED":
      return "bg-gray-100 text-gray-700 border-gray-300";
    case "PLANNED":
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}
