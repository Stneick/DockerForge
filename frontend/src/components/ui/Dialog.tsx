import { createContext, useContext, useState } from "react";
import * as RD from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

const DialogOpenContext = createContext(false);

const contentEase = [0.22, 1, 0.36, 1] as const;

export function Dialog({
  open: openProp,
  onOpenChange,
  defaultOpen,
  children,
  ...props
}: RD.DialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isOpen = openProp ?? internalOpen;

  const handleOpenChange = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <DialogOpenContext.Provider value={isOpen}>
      <RD.Root open={isOpen} onOpenChange={handleOpenChange} {...props}>
        {children}
      </RD.Root>
    </DialogOpenContext.Provider>
  );
}

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
  const open = useContext(DialogOpenContext);
  const reduceMotion = useReducedMotion();

  const overlayTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: contentEase };

  const panelVariants = {
    hidden: {
      opacity: 0,
      scale: 0.92,
      x: "-50%",
      y: "calc(-50% + 18px)",
    },
    visible: {
      opacity: 1,
      scale: 1,
      x: "-50%",
      y: "-50%",
      transition: { duration: 0.45, ease: contentEase },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      x: "-50%",
      y: "calc(-50% + 8px)",
      transition: { duration: 0.3, ease: contentEase },
    },
  };

  return (
    <AnimatePresence>
      {open ? (
        <RD.Portal forceMount>
          <RD.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={overlayTransition}
            />
          </RD.Overlay>
          <RD.Content asChild forceMount>
            <motion.div
              className={cn(
                "fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] panel p-5 shadow-2xl focus:outline-none",
                className,
              )}
              {...(reduceMotion
                ? {
                    initial: false,
                    animate: { opacity: 1, x: "-50%", y: "-50%" },
                  }
                : {
                    variants: panelVariants,
                    initial: "hidden",
                    animate: "visible",
                    exit: "exit",
                  })}
            >
              {(title || description) && (
                <div className="mb-4 pr-8">
                  {title && (
                    <RD.Title className="text-base font-bold tracking-tight">
                      {title}
                    </RD.Title>
                  )}
                  {description && (
                    <RD.Description className="mt-1 text-sm text-muted">
                      {description}
                    </RD.Description>
                  )}
                </div>
              )}
              {children}
              <RD.Close className="absolute right-4 top-4 rounded-md p-1 text-dim transition-colors hover:bg-surface2 hover:text-text">
                <X className="h-4 w-4" />
              </RD.Close>
            </motion.div>
          </RD.Content>
        </RD.Portal>
      ) : null}
    </AnimatePresence>
  );
}
