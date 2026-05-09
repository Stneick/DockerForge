import { forwardRef } from "react";

import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-lg border border-line2 bg-bg2 px-3 py-2 text-sm text-text placeholder:text-dim " +
  "transition-colors focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, mono, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(fieldBase, mono && "font-mono", invalid && "border-fail focus:border-fail focus:ring-fail/40", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "resize-y", mono && "font-mono", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-fail">{children}</p>;
}
