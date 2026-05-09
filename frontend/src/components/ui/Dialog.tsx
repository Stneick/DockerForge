import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <RD.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2",
          "panel p-5 shadow-2xl data-[state=open]:animate-fade-in",
          className,
        )}
      >
        {(title || description) && (
          <div className="mb-4 pr-8">
            {title && <RD.Title className="text-base font-bold tracking-tight">{title}</RD.Title>}
            {description && (
              <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description>
            )}
          </div>
        )}
        {children}
        <RD.Close className="absolute right-4 top-4 rounded-md p-1 text-dim transition-colors hover:bg-surface2 hover:text-text">
          <X className="h-4 w-4" />
        </RD.Close>
      </RD.Content>
    </RD.Portal>
  );
}
