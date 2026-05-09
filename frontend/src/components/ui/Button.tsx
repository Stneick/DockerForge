import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-cyan/15 text-cyan border border-cyan-dim hover:bg-cyan/25 hover:shadow-glow-sm active:bg-cyan/30",
  secondary:
    "bg-surface2 text-text border border-line2 hover:border-cyan-dim hover:bg-surface3",
  ghost: "text-muted hover:text-text hover:bg-surface2 border border-transparent",
  danger:
    "bg-fail/10 text-fail border border-fail/40 hover:bg-fail/20",
  outline: "text-muted border border-line2 hover:border-cyan-dim hover:text-text",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
