import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

export type AuthMode = "signin" | "signup";

const MODES: { id: AuthMode; label: string; hint: string }[] = [
  { id: "signin", label: "Sign in", hint: "Master" },
  { id: "signup", label: "Create account", hint: "Apprentice" },
];

export function AuthModeToggle({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative mb-6 grid grid-cols-2 rounded-xl border border-line2 bg-bg/80 p-1"
      role="tablist"
      aria-label="Authentication mode"
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "relative z-10 flex flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 text-center transition-colors duration-200",
              active ? "text-cyan" : "text-muted hover:text-text",
            )}
          >
            {active && (
              <motion.div
                layoutId={reduceMotion ? undefined : "auth-mode-pill"}
                aria-hidden
                className="absolute inset-0 rounded-lg bg-cyan/15 shadow-[0_0_0_1px_rgb(var(--cyan)/0.25),inset_0_1px_0_rgb(255_255_255/0.04)]"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 480, damping: 34, mass: 0.75 }
                }
              />
            )}
            <span className="relative text-sm font-semibold tracking-tight">{m.label}</span>
            <span className="relative font-mono text-2xs uppercase tracking-[0.14em] text-dim">{m.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
