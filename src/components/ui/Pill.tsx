import * as React from "react";
import { cn } from "./cn";

type PillProps = React.HTMLAttributes<HTMLSpanElement>;

export function Pill({ className, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-st-gray-bg px-2 text-xs font-medium text-st-gray",
        className
      )}
      {...props}
    />
  );
}
