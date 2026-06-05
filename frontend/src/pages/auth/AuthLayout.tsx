import { memo } from "react";

import { AuthLogo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { Backdrop } from "./backdrops";

const PersistentBackdrop = memo(Backdrop);

/** Split auth shell: brand panel + Dockerfile backdrop (stable across sign-in ↔ sign-up). */
export function AuthLayout({
  children,
  cardTop,
  cardClassName,
}: {
  children: React.ReactNode;
  /** Pixels from viewport top — anchors card so only the bottom expands on mode switch */
  cardTop?: number;
  cardClassName?: string;
}) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      {/* brand side */}
      <div className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="grid-tex absolute inset-0 opacity-50 [mask-image:radial-gradient(circle_at_40%_30%,black,transparent_75%)]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 500px at 70% 10%, rgb(var(--cyan)/0.08), transparent 60%), radial-gradient(700px 500px at 10% 100%, rgb(var(--docker)/0.07), transparent 60%)",
          }}
        />
        <div className="relative h-full p-12">
          <div className="absolute left-5 top-12">
            <AuthLogo sizeClassName="h-32" iconClassName="h-36" />
          </div>

          <div className="flex h-full flex-col justify-center">
            <div className="max-w-md">
              <div className="mb-4 font-mono text-2xs uppercase tracking-[0.18em] text-cyan">
                self-hosted image foundry
              </div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
                From source to a shipped image, forged in one place.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
                Upload code, let DockerForge detect the stack, tune the Dockerfile with live
                hadolint, then build and watch the logs stream in real time.
              </p>
            </div>
          </div>

          <div className="absolute bottom-12 left-12 flex gap-6 font-mono text-2xs text-dim">
            <span>● detect</span>
            <span>● forge</span>
            <span>● build</span>
            <span>● compare</span>
            <span>● push</span>
          </div>
        </div>
      </div>

      {/* form side — top anchored from sign-in height; form region grows downward */}
      <div className="relative min-h-screen overflow-hidden px-6">
        <PersistentBackdrop />
        <div
          className={cn(
            "absolute left-1/2 z-10 w-full max-w-sm -translate-x-1/2 transition-opacity duration-150",
            cardTop == null && "top-1/2 -translate-y-1/2 opacity-0",
          )}
          style={cardTop != null ? { top: cardTop, opacity: 1 } : undefined}
        >
          <div
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border border-line2/70 bg-bg2/55 p-7 shadow-2xl backdrop-blur-xl",
              "animate-auth-card-in transition-[border-color,box-shadow] duration-300 ease-out",
              "hover:border-cyan/25 hover:shadow-[0_0_0_1px_rgb(var(--cyan)/0.12),0_28px_56px_-16px_rgb(0_0_0/0.55)]",
              cardClassName,
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-transparent via-cyan/70 to-transparent animate-auth-accent-in"
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
