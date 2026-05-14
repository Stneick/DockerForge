import { useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";

import { cn } from "@/lib/cn";
import { useLayout } from "@/store/layout";
import { useGlobalShortcuts } from "@/components/ShortcutsHelp";
import { Explorer } from "./Explorer";
import { TabBar } from "./TabBar";
import { StatusBar } from "./StatusBar";
import { PanelsProvider, usePanels } from "./panels";

/**
 * IDE workspace frame:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ TabBar (logo · open docs · layout · ⌘P ⌘K · me) │
 *   ├──────────┬───────────────────────────┬──────────┤
 *   │ Explorer │  editor region (Outlet)   │ Inspector│
 *   │          ├───────────────────────────┤          │
 *   │          │  Dock (logs/problems/…)    │          │
 *   ├──────────┴───────────────────────────┴──────────┤
 *   │ StatusBar                                        │
 *   └───────────────────────────────────────────────┘
 *
 * Explorer/Inspector/Dock are collapsible; routes fill Inspector + Dock via the
 * <Inspector> / <Dock> portals (see panels.tsx).
 */
export function Shell() {
  return (
    <PanelsProvider>
      <ShellFrame />
    </PanelsProvider>
  );
}

function ShellFrame() {
  const panels = usePanels();
  const { explorerOpen, inspectorOpen, dockOpen, dockHeight, setDockHeight } = useLayout();
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  useGlobalShortcuts();

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startY: e.clientY, startH: dockHeight };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setDockHeight(dragRef.current.startH + (dragRef.current.startY - ev.clientY));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
      };
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [dockHeight, setDockHeight],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <TabBar />
      <div className="flex min-h-0 flex-1">
        {explorerOpen && <Explorer />}

        {/* center column: editor region + dock */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>

          {/* dock region — host stays mounted so portals always have a target */}
          <div
            className={cn(
              "flex shrink-0 flex-col border-t border-line bg-deep",
              !panels.hasDock && "hidden",
            )}
            style={panels.hasDock && dockOpen ? { height: dockHeight } : undefined}
          >
            {panels.hasDock && dockOpen && (
              <div
                onMouseDown={onResizeStart}
                className="h-1 shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-cyan-dim"
              />
            )}
            <div ref={panels.setDockEl} className="min-h-0 flex-1" />
          </div>
        </div>

        {/* inspector — host stays mounted; hidden when closed/empty */}
        <aside
          className={cn(
            "w-[280px] shrink-0 overflow-y-auto border-l border-line bg-chrome",
            (!panels.hasInspector || !inspectorOpen) && "hidden",
          )}
        >
          <div ref={panels.setInspectorEl} />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}
