import { StatusBadge } from "@/components/ui/StatusBadge";

type StatusPillProps = {
  status?: string | null;
  className?: string;
};

/**
 * Legacy wrapper kept for existing screens — renders the design-system
 * StatusBadge. Prefer importing StatusBadge directly in new code.
 */
export default function StatusPill({ status, className }: StatusPillProps) {
  return <StatusBadge status={status ?? undefined} className={className} />;
}
