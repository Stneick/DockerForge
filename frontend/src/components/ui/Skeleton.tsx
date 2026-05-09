import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

/** Shimmering placeholder block. Prefer over spinners for layout-stable loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-surface2", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-cyan", className)} />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 py-16 text-dim">
      <Spinner className="h-6 w-6" />
      {label && <span className="font-mono text-xs">{label}</span>}
    </div>
  );
}
