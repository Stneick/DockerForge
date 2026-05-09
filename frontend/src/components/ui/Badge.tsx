import { cn } from "@/lib/cn";
import type { BuildStatus } from "@/types/api";

type Tone = "default" | "cyan" | "docker" | "ok" | "fail" | "warn" | "lang";

const tones: Record<Tone, string> = {
  default: "text-muted border-line2 bg-surface2",
  cyan: "text-cyan border-cyan-dim bg-cyan/10",
  docker: "text-docker border-docker/40 bg-docker/10",
  ok: "text-ok border-ok/40 bg-ok/10",
  fail: "text-fail border-fail/40 bg-fail/10",
  warn: "text-warn border-warn/40 bg-warn/10",
  lang: "text-warn border-warn/30 bg-warn/[0.07]",
};

export function Badge({
  tone = "default",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-2xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<BuildStatus, Tone> = {
  pending: "warn",
  building: "cyan",
  success: "ok",
  failed: "fail",
  cancelled: "default",
};

const statusLabel: Record<BuildStatus, string> = {
  pending: "pending",
  building: "building",
  success: "success",
  failed: "failed",
  cancelled: "cancelled",
};

/** Animated status dot used in tabs, explorer, build headers. */
export function StatusDot({ status, className }: { status: BuildStatus; className?: string }) {
  const color: Record<BuildStatus, string> = {
    pending: "bg-warn",
    building: "bg-cyan animate-blink",
    success: "bg-ok shadow-[0_0_8px_rgb(var(--ok))]",
    failed: "bg-fail",
    cancelled: "bg-dim",
  };
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color[status], className)} />;
}

export function StatusBadge({ status }: { status: BuildStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      <StatusDot status={status} />
      {statusLabel[status]}
    </Badge>
  );
}
