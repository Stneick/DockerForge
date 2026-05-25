import { useEffect } from "react";
import { create } from "zustand";

import { useLayout } from "@/store/layout";
import { useCommandPalette } from "@/components/CommandPalette";
import { useFilePalette } from "@/components/FilePalette";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/misc";
import { ALT_KEY, MOD_KEY, hasMod } from "@/lib/keyboard";

interface HelpStore {
  open: boolean;
  setOpen: (v: boolean) => void;
}
export const useShortcutsHelp = create<HelpStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Shortcut {
  keys: string[];
  label: string;
}
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "General",
    items: [
      { keys: [MOD_KEY, "P"], label: "Quick open" },
      { keys: ["F1"], label: "Command palette" },
      { keys: ["?"], label: "This shortcuts sheet" },
      { keys: ["Esc"], label: "Close palette / dialog" },
    ],
  },
  {
    title: "Layout",
    items: [
      { keys: [MOD_KEY, "B"], label: "Toggle Explorer" },
      { keys: [MOD_KEY, "J"], label: "Toggle Panel" },
      { keys: [MOD_KEY, ALT_KEY, "B"], label: "Toggle Inspector" },
    ],
  },
  {
    title: "Editor (Dockerfile)",
    items: [
      { keys: [MOD_KEY, "F"], label: "Find" },
      { keys: [MOD_KEY, "/"], label: "Toggle comment" },
      { keys: [ALT_KEY, "↑/↓"], label: "Move line" },
      { keys: [MOD_KEY, "D"], label: "Add next match to selection" },
    ],
  },
];

/** Global keybindings. Mount once (in the Shell). */
export function useGlobalShortcuts() {
  const { toggleExplorer, toggleDock, toggleInspector } = useLayout();
  const setPalette = useCommandPalette((s) => s.setOpen);
  const setFilePalette = useFilePalette((s) => s.setOpen);
  const setHelp = useShortcutsHelp((s) => s.setOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = hasMod(e);
      const el = e.target as HTMLElement | null;
      const editable =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || !!el.closest?.(".monaco-editor"));
      const key = e.key.toLowerCase();

      if (mod && key === "p") {
        e.preventDefault();
        setPalette(false);
        setFilePalette(!useFilePalette.getState().open);
      } else if (mod && e.altKey && key === "b") {
        e.preventDefault();
        toggleInspector();
      } else if (mod && key === "b") {
        e.preventDefault();
        toggleExplorer();
      } else if (mod && key === "j") {
        e.preventDefault();
        toggleDock();
      } else if (e.key === "F1") {
        e.preventDefault();
        setFilePalette(false);
        setPalette(true);
      } else if (e.key === "?" && !mod && !editable) {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [toggleExplorer, toggleDock, toggleInspector, setPalette, setFilePalette, setHelp]);
}

export function ShortcutsHelp() {
  const { open, setOpen } = useShortcutsHelp();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Keyboard shortcuts" className="w-[min(94vw,520px)]">
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h4 className="label-mono mb-2">{g.title}</h4>
              <div className="space-y-1.5">
                {g.items.map((s) => (
                  <div key={s.label + s.keys.join()} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          {i > 0 && <span className="text-2xs text-dim">+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
