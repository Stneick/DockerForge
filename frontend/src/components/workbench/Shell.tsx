import { useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";

import { cn } from "@/lib/cn";
import { useLayout } from "@/store/layout";
import { useGlobalShortcuts } from "@/components/ShortcutsHelp";
import { Explorer } from "./Explorer";
import { TabBar } from "./TabBar";
import { StatusBar } from "./StatusBar";
import { PanelsProvider, usePanels } from "./panels";


export function Shell() {
  return (
    <PanelsProvider>
      <ShellFrame />
    </PanelsProvider>
  );
}

function ShellFrame() {
  const panels = usePanels();
  const {
    explorerOpen,
    explorerWidth,
    inspectorOpen,
    inspectorWidth,
    dockOpen,
    dockHeight,
    setDockHeight,
    setExplorerWidth,
    setInspectorWidth,
  } = useLayout();
  const dockDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const explorerDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const inspectorDragRef = useRef<{ startX: number; startW: number } | null>(null);
  useGlobalShortcuts();

  const onExplorerResizeStart = useCallback(
    (e: React.MouseEvent) => {
      explorerDragRef.current = { startX: e.clientX, startW: explorerWidth };
      const onMove = (ev: MouseEvent) => {
        if (!explorerDragRef.current) return;
        setExplorerWidth(
          explorerDragRef.current.startW +
            (ev.clientX - explorerDragRef.current.startX),
        );
      };
      const onUp = () => {
        explorerDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [explorerWidth, setExplorerWidth],
  );

  const onInspectorResizeStart = useCallback(
    (e: React.MouseEvent) => {
      inspectorDragRef.current = { startX: e.clientX, startW: inspectorWidth };
      const onMove = (ev: MouseEvent) => {
        if (!inspectorDragRef.current) return;
        setInspectorWidth(
          inspectorDragRef.current.startW +
            (inspectorDragRef.current.startX - ev.clientX),
        );
      };
      const onUp = () => {
        inspectorDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [inspectorWidth, setInspectorWidth],
  );

  const onDockResizeStart = useCallback(
    (e: React.MouseEvent) => {
      dockDragRef.current = { startY: e.clientY, startH: dockHeight };
      const onMove = (ev: MouseEvent) => {
        if (!dockDragRef.current) return;
        setDockHeight(
          dockDragRef.current.startH +
            (dockDragRef.current.startY - ev.clientY),
        );
      };
      const onUp = () => {
        dockDragRef.current = null;
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
        {explorerOpen && (
          <div className="flex shrink-0">
            <Explorer />
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize explorer"
              onMouseDown={onExplorerResizeStart}
              className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-cyan-dim"
            />
          </div>
        )}

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
                onMouseDown={onDockResizeStart}
                className="h-1 shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-cyan-dim"
              />
            )}
            <div ref={panels.setDockEl} className="min-h-0 flex-1" />
          </div>
        </div>

        {/* inspector — host stays mounted; hidden when closed/empty */}
        <div
          className={cn(
            "flex shrink-0",
            (!panels.hasInspector || !inspectorOpen) && "hidden",
          )}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
            onMouseDown={onInspectorResizeStart}
            className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-cyan-dim"
          />
          <aside
            className="shrink-0 overflow-y-auto border-l border-line bg-chrome"
            style={{ width: inspectorWidth }}
          >
            <div ref={panels.setInspectorEl} />
          </aside>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
