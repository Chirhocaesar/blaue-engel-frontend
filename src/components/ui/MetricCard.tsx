import * as React from "react";
import { cn } from "./cn";

type MetricAccent = "accent" | "ink" | "blue" | "green";

const accentBar: Record<MetricAccent, string> = {
  accent: "bg-accent",
  ink: "bg-ink",
  blue: "bg-st-blue",
  green: "bg-st-green",
};

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  foot?: React.ReactNode;
  accent?: MetricAccent;
  className?: string;
};

export function MetricCard({
  label,
  value,
  icon,
  foot,
  accent = "accent",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-card px-[18px] pb-4 pt-[18px] shadow-card",
        className
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px] opacity-90", accentBar[accent])}
      />
      <div className="flex items-center gap-[7px] text-xs font-medium text-muted">
        {icon ? <span className="text-faint [&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span> : null}
        {label}
      </div>
      <div className="mt-3 font-serif text-[34px] font-bold leading-none text-ink tabular-nums">
        {value}
      </div>
      {foot ? <div className="mt-2 text-[11.5px] text-faint">{foot}</div> : null}
    </div>
  );
}
