import * as React from "react";
import { cn } from "./cn";

type AlertVariant = "error" | "info" | "success" | "warn";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

const variantClasses: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-st-blue/20 bg-st-blue-bg text-st-blue",
  success: "border-st-green/20 bg-st-green-bg text-st-green",
  warn: "border-st-amber/20 bg-st-amber-bg text-st-amber",
};

export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-field border px-3 py-2 text-sm",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
