import * as React from "react";
import { cn } from "./cn";

type CardVariant = "default" | "subtle";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
  default: "border bg-white",
  subtle: "border border-gray-200 bg-gray-50",
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl p-4", variantClasses[variant], className)}
      {...props}
    />
  );
}
