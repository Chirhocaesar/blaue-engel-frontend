import * as React from "react";
import { cn } from "@/components/ui/cn";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 flex-wrap", className)}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}
