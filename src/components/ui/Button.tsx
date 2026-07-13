import * as React from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white shadow-[0_8px_18px_-8px_rgba(18,18,18,.5)] hover:bg-black [&_svg]:text-accent",
  outline:
    "border border-line-strong bg-card text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-deep",
  ghost: "text-fg hover:bg-accent-soft hover:text-accent-deep",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-[12.5px]",
  md: "px-4 py-2.5 text-[13.5px]",
  lg: "px-5 py-3 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-field font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
