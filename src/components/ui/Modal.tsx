import * as React from "react";
import { cn } from "./cn";

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  size?: ModalSize;
  className?: string;
  children: React.ReactNode;
};

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  className,
  children,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "max-h-[85vh] w-full overflow-y-auto rounded-card border border-line bg-card p-5 shadow-card",
          sizeClasses[size],
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-2">
            {title ? (
              <h3 className="font-serif text-[17px] font-bold text-ink">{title}</h3>
            ) : (
              <div />
            )}
            {onClose ? (
              <button
                type="button"
                className="rounded-field border border-line-strong px-2 py-1 text-sm hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
                onClick={onClose}
                aria-label="Schliessen"
              >
                Schliessen
              </button>
            ) : null}
          </div>
        )}
        <div className={title || onClose ? "mt-3" : ""}>{children}</div>
      </div>
    </div>
  );
}
