import * as React from "react";
import { cn } from "./cn";

type AlertVariant = "error" | "info" | "success" | "warn";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

const variantClasses: Record<AlertVariant, string> = {
  error: "border-red-300 bg-red-50 text-red-700",
  info: "border-blue-300 bg-blue-50 text-blue-700",
  success: "border-green-300 bg-green-50 text-green-700",
  warn: "border-yellow-300 bg-yellow-50 text-yellow-800",
};

export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return (
    <div
      className={cn("rounded-xl border px-3 py-2 text-sm", variantClasses[variant], className)}
      {...props}
    />
  );
}
