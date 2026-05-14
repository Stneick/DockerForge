import { create } from "zustand";

// Visibility + sizing of the IDE chrome regions (like VS Code's sidebar/panel
// toggles). Persisted to localStorage so the workspace feels stable.
interface LayoutState {
  explorerOpen: boolean;
  inspectorOpen: boolean;
  dockOpen: boolean;
  dockHeight: number; // px
  toggleExplorer: () => void;
  toggleInspector: () => void;
  toggleDock: () => void;
  setDockOpen: (v: boolean) => void;
  setDockHeight: (h: number) => void;
}

const KEY = "df.layout";
type Persisted = Pick<LayoutState, "explorerOpen" | "inspectorOpen" | "dockOpen" | "dockHeight">;

function load(): Persisted {
  const fallback: Persisted = { explorerOpen: true, inspectorOpen: true, dockOpen: true, dockHeight: 220 };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return fallback;
  }
}

function persist(s: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const useLayout = create<LayoutState>((set, get) => ({
  ...load(),
  toggleExplorer: () => {
    set({ explorerOpen: !get().explorerOpen });
    persist(snapshot(get()));
  },
  toggleInspector: () => {
    set({ inspectorOpen: !get().inspectorOpen });
    persist(snapshot(get()));
  },
  toggleDock: () => {
    set({ dockOpen: !get().dockOpen });
    persist(snapshot(get()));
  },
  setDockOpen: (v) => {
    set({ dockOpen: v });
    persist(snapshot(get()));
  },
  setDockHeight: (h) => {
    const dockHeight = Math.min(560, Math.max(120, h));
    set({ dockHeight });
    persist(snapshot(get()));
  },
}));

function snapshot(s: LayoutState): Persisted {
  return {
    explorerOpen: s.explorerOpen,
    inspectorOpen: s.inspectorOpen,
    dockOpen: s.dockOpen,
    dockHeight: s.dockHeight,
  };
}
