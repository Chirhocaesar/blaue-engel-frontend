import { normalizeStatus, statusLabelDe, statusPillClass } from "@/lib/status";

type StatusPillProps = {
  status?: string | null;
  className?: string;
};

export default function StatusPill({ status, className }: StatusPillProps) {
  const normalized = normalizeStatus(status);
  const label = normalized ? statusLabelDe(normalized) : "—";
  const baseClass = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
  const statusClass = statusPillClass(normalized);
  const extra = className ? ` ${className}` : "";

  return <span className={`${baseClass} ${statusClass}${extra}`}>{label}</span>;
}
