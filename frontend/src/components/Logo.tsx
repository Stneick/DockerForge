import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-5 w-5", className)}>
      <path d="M3 9h4v4H3zM8 9h4v4H8zM13 9h4v4h-4zM8 4h4v4H8z" fill="rgb(var(--cyan))" />
      <path
        d="M18 9c2 0 3 1.5 3 3s-2 4-6 4H3c0-3 1-7 5-7"
        stroke="rgb(var(--docker))"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}

export function LogoBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-line2 shadow-glow",
        "bg-gradient-to-br from-[#16222e] to-[#0c1218]",
        className,
      )}
    >
      <LogoMark />
    </div>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[15px] font-extrabold tracking-tight", className)}>
      docker<span className="text-cyan">forge</span>
    </span>
  );
}
