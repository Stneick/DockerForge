import { cn } from "@/lib/cn";

/** Keyboard key chip. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "rounded border border-line2 bg-bg2 px-1.5 py-0.5 font-mono text-2xs font-semibold text-cyan",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line2 bg-surface2 text-dim">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type BannerTone = "info" | "warning" | "success";

const bannerTones: Record<BannerTone, string> = {
  info: "border-cyan-dim/60 bg-cyan/[0.06] text-cyan",
  warning: "border-warn/40 bg-warn/[0.07] text-warn",
  success: "border-ok/40 bg-ok/[0.07] text-ok",
};

/** Inline contextual banner (framework notes, warnings). */
export function Banner({
  tone = "info",
  icon,
  children,
  className,
}: {
  tone?: BannerTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", bannerTones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

/** Small uppercase mono section heading with a trailing rule. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="label-mono">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
