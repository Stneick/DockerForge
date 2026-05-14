import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, PanelRightClose } from "lucide-react";

import { cn } from "@/lib/cn";
import { useLayout } from "@/store/layout";

// The Shell exposes two host elements (the right Inspector column and the bottom
// Dock). Routes portal content into them via <Inspector> / <Dock>, so the IDE
// chrome stays fixed while the active document drives what's inside.
interface PanelsCtx {
  inspectorEl: HTMLElement | null;
  dockEl: HTMLElement | null;
  hasInspector: boolean;
  hasDock: boolean;
  setInspectorEl: (el: HTMLElement | null) => void;
  setDockEl: (el: HTMLElement | null) => void;
  bumpInspector: (d: number) => void;
  bumpDock: (d: number) => void;
}

const Ctx = createContext<PanelsCtx | null>(null);
export const usePanels = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanels must be used within PanelsProvider");
  return c;
};

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null);
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null);
  const [inspectorCount, setInspectorCount] = useState(0);
  const [dockCount, setDockCount] = useState(0);

  const value: PanelsCtx = {
    inspectorEl,
    dockEl,
    hasInspector: inspectorCount > 0,
    hasDock: dockCount > 0,
    setInspectorEl,
    setDockEl,
    bumpInspector: (d) => setInspectorCount((n) => Math.max(0, n + d)),
    bumpDock: (d) => setDockCount((n) => Math.max(0, n + d)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Fill the right inspector column for the current route. */
export function Inspector({ children }: { children: ReactNode }) {
  const { inspectorEl, bumpInspector } = usePanels();
  useEffect(() => {
    bumpInspector(1);
    return () => bumpInspector(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return inspectorEl ? createPortal(children, inspectorEl) : null;
}

export function InspectorSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line p-3.5", className)}>
      <h4 className="label-mono mb-3">{title}</h4>
      {children}
    </div>
  );
}

export interface DockTab {
  id: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
}

/** Fill the bottom dock for the current route (Logs / Layers / Problems …).
 *  Provide `activeId`/`onActiveChange` for controlled mode (e.g. so the caller
 *  can auto-switch tabs when a push session starts). */
export function Dock({
  tabs,
  headerRight,
  defaultTab,
  activeId,
  onActiveChange,
}: {
  tabs: DockTab[];
  headerRight?: ReactNode;
  defaultTab?: string;
  activeId?: string;
  onActiveChange?: (id: string) => void;
}) {
  const { dockEl, bumpDock } = usePanels();
  const { dockOpen, toggleDock } = useLayout();
  const [internal, setInternal] = useState(defaultTab ?? tabs[0]?.id);
  const active = activeId ?? internal;
  const setActive = (id: string) => {
    if (onActiveChange) onActiveChange(id);
    else setInternal(id);
  };

  useEffect(() => {
    bumpDock(1);
    return () => bumpDock(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dockEl) return null;
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return createPortal(
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line bg-bg2 px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActive(t.id);
              if (!dockOpen) toggleDock();
            }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-1.5 font-mono text-2xs font-semibold uppercase tracking-wide transition-colors",
              active === t.id && dockOpen
                ? "border-cyan text-cyan"
                : "border-transparent text-dim hover:text-muted",
            )}
          >
            {t.label}
            {t.badge != null && <span className="text-muted">{t.badge}</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-1">
          {headerRight}
          <button
            onClick={toggleDock}
            className="rounded p-1 text-dim transition-colors hover:bg-surface2 hover:text-text"
            title={dockOpen ? "Collapse panel" : "Expand panel"}
          >
            {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5 rotate-90" />}
          </button>
        </div>
      </div>
      {dockOpen && <div className="min-h-0 flex-1 overflow-hidden">{activeTab?.content}</div>}
    </div>,
    dockEl,
  );
}
