import * as React from "react";
import Link from "next/link";
import { cn } from "./cn";

type PanelProps = React.HTMLAttributes<HTMLElement>;

export function Panel({ className, ...props }: PanelProps) {
  return (
    <section
      className={cn("rounded-card border border-line bg-card shadow-card", className)}
      {...props}
    />
  );
}

type PanelHeadProps = {
  title: React.ReactNode;
  /** Small muted text on the right (ignored when `action` is set). */
  hint?: React.ReactNode;
  /** Right-side action link, e.g. { label: "Alle anzeigen →", href: "/assignments" }. */
  action?: { label: React.ReactNode; href: string };
  className?: string;
  titleClassName?: string;
};

export function PanelHead({ title, hint, action, className, titleClassName }: PanelHeadProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-line px-5 py-4",
        className
      )}
    >
      <h2 className={cn("font-serif text-[17px] font-bold text-ink", titleClassName)}>
        {title}
      </h2>
      {action ? (
        <Link
          href={action.href}
          className="text-[12.5px] font-semibold text-accent-deep hover:underline"
        >
          {action.label}
        </Link>
      ) : hint ? (
        <div className="text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}
