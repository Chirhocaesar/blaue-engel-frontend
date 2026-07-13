import * as React from "react";
import { cn } from "./cn";
import { normalizeStatus, statusLabelDe } from "@/lib/status";

export type BadgeTone = "amber" | "blue" | "green" | "gray";

const toneClasses: Record<BadgeTone, string> = {
  amber: "text-st-amber bg-st-amber-bg",
  blue: "text-st-blue bg-st-blue-bg",
  green: "text-st-green bg-st-green-bg",
  gray: "text-st-gray bg-st-gray-bg",
};

/** Maps an assignment status (raw or normalized) to its badge tone. */
export function statusTone(status?: string | null): BadgeTone {
  switch (normalizeStatus(status)) {
    case "ASSIGNED":
    case "PLANNED":
      return "amber";
    case "CONFIRMED":
      return "blue";
    case "DONE":
      return "green";
    case "CANCELLED":
    default:
      return "gray";
  }
}

type StatusBadgeProps = {
  /** Explicit tone; overrides `status`. */
  tone?: BadgeTone;
  /** Assignment status — derives tone and (if no children) the German label. */
  status?: string | null;
  className?: string;
  children?: React.ReactNode;
};

export function StatusBadge({ tone, status, className, children }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusTone(status);
  const label = children ?? (status !== undefined ? statusLabelDe(status) : null);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[resolvedTone],
        className
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
