import * as React from "react";
import { cn } from "./cn";

type CardVariant = "default" | "subtle";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
  default: "border border-line bg-card shadow-card",
  subtle: "border border-line bg-tint",
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-card p-4", variantClasses[variant], className)}
      {...props}
    />
  );
}
