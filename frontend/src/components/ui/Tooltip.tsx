import * as RT from "@radix-ui/react-tooltip";

import { cn } from "@/lib/cn";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <RT.Provider delayDuration={300}>{children}</RT.Provider>;
}

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-lg border border-line2 bg-surface2 px-2.5 py-1.5 text-xs text-text shadow-lg",
            "animate-fade-in",
            className,
          )}
        >
          {content}
          <RT.Arrow className="fill-surface2" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
