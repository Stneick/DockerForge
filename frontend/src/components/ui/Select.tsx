import * as RS from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  mono,
}: {
  value?: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <RS.Root value={value} onValueChange={onValueChange}>
      <RS.Trigger
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-line2 bg-bg2 px-3 py-2 text-sm",
          "text-text transition-colors hover:border-cyan-dim focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/40",
          "data-[placeholder]:text-dim",
          mono && "font-mono",
          className,
        )}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon>
          <ChevronDown className="h-4 w-4 text-dim" />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line2 bg-surface2 shadow-xl animate-fade-in"
        >
          <RS.Viewport className="p-1">
            {options.map((opt) => (
              <RS.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 pr-8 text-sm text-text outline-none",
                  "data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan",
                  mono && "font-mono",
                )}
              >
                <RS.ItemText>{opt.label}</RS.ItemText>
                <RS.ItemIndicator className="absolute right-2">
                  <Check className="h-4 w-4 text-cyan" />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
