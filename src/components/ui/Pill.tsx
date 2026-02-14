import * as React from "react";
import { cn } from "./cn";

type PillProps = React.HTMLAttributes<HTMLSpanElement>;

export function Pill({ className, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-200 px-2 text-xs font-medium text-gray-700",
        className
      )}
      {...props}
    />
  );
}
