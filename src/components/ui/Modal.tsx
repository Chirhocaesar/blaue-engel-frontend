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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full rounded-xl bg-white p-4 shadow-lg max-h-[85vh] overflow-y-auto",
          sizeClasses[size],
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-2">
            {title ? <h3 className="text-base font-semibold">{title}</h3> : <div />}
            {onClose ? (
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
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
