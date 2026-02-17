import * as React from "react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";

type StateVariant = "empty" | "error" | "loading";

type StateNoticeProps = {
  variant: StateVariant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

const variantToAlert: Record<StateVariant, "error" | "info"> = {
  empty: "info",
  loading: "info",
  error: "error",
};

export default function StateNotice({
  variant,
  message,
  actionLabel,
  onAction,
  className,
}: StateNoticeProps) {
  return (
    <Alert variant={variantToAlert[variant]} className={cn("flex items-center justify-between gap-3", className)}>
      <span>{message}</span>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Alert>
  );
}
