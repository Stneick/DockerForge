import * as RS from "@radix-ui/react-switch";

import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  className,
}: {
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  className?: string;
}) {
  return (
    <RS.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border border-line2 bg-bg2 transition-colors",
        "data-[state=checked]:border-cyan-dim data-[state=checked]:bg-cyan/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40",
        className,
      )}
    >
      <RS.Thumb className="block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-muted transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-cyan" />
    </RS.Root>
  );
}
