import * as RT from "@radix-ui/react-toast";
import { create } from "zustand";
import { CheckCircle2, Info, XCircle, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let counter = 0;
const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: ++counter }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative helper usable outside React render (e.g. in mutation handlers). */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "success", title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "error", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "info", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "warning", title, description }),
};

const icons: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-ok" />,
  error: <XCircle className="h-4 w-4 text-fail" />,
  info: <Info className="h-4 w-4 text-cyan" />,
  warning: <AlertTriangle className="h-4 w-4 text-warn" />,
};

const accent: Record<ToastTone, string> = {
  success: "border-l-ok",
  error: "border-l-fail",
  info: "border-l-cyan",
  warning: "border-l-warn",
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <RT.Provider swipeDirection="right" duration={4500}>
      {toasts.map((t) => (
        <RT.Root
          key={t.id}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "panel flex items-start gap-3 border-l-2 px-4 py-3 shadow-xl",
            "data-[state=open]:animate-fade-in data-[swipe=end]:animate-out",
            accent[t.tone],
          )}
        >
          <div className="mt-0.5">{icons[t.tone]}</div>
          <div className="min-w-0 flex-1">
            <RT.Title className="text-sm font-semibold">{t.title}</RT.Title>
            {t.description && (
              <RT.Description className="mt-0.5 break-words text-xs text-muted">
                {t.description}
              </RT.Description>
            )}
          </div>
        </RT.Root>
      ))}
      <RT.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2 outline-none" />
    </RT.Provider>
  );
}
