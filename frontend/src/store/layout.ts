import { create } from "zustand";

import {
  EXPLORER_WIDTH_DEFAULT,
  EXPLORER_WIDTH_MAX,
  EXPLORER_WIDTH_MIN,
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
} from "@/components/workbench/constants";

// Visibility + sizing of the IDE chrome regions (like VS Code's sidebar/panel
// toggles). Persisted to localStorage so the workspace feels stable.
interface LayoutState {
  explorerOpen: boolean;
  explorerWidth: number;
  inspectorOpen: boolean;
  inspectorWidth: number;
  dockOpen: boolean;
  dockHeight: number; // px
  toggleExplorer: () => void;
  toggleInspector: () => void;
  toggleDock: () => void;
  setDockOpen: (v: boolean) => void;
  setDockHeight: (h: number) => void;
  setExplorerWidth: (w: number) => void;
  setInspectorWidth: (w: number) => void;
}

const KEY = "df.layout";
type Persisted = Pick<
  LayoutState,
  | "explorerOpen"
  | "explorerWidth"
  | "inspectorOpen"
  | "inspectorWidth"
  | "dockOpen"
  | "dockHeight"
>;

function load(): Persisted {
  const fallback: Persisted = {
    explorerOpen: true,
    explorerWidth: EXPLORER_WIDTH_DEFAULT,
    inspectorOpen: true,
    inspectorWidth: INSPECTOR_WIDTH_DEFAULT,
    dockOpen: true,
    dockHeight: 220,
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Persisted>;
    const explorerWidth = Math.min(
      EXPLORER_WIDTH_MAX,
      Math.max(EXPLORER_WIDTH_MIN, parsed.explorerWidth ?? EXPLORER_WIDTH_DEFAULT),
    );
    const inspectorWidth = Math.min(
      INSPECTOR_WIDTH_MAX,
      Math.max(INSPECTOR_WIDTH_MIN, parsed.inspectorWidth ?? INSPECTOR_WIDTH_DEFAULT),
    );
    return { ...fallback, ...parsed, explorerWidth, inspectorWidth };
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
  setExplorerWidth: (w) => {
    const explorerWidth = Math.min(
      EXPLORER_WIDTH_MAX,
      Math.max(EXPLORER_WIDTH_MIN, Math.round(w)),
    );
    set({ explorerWidth });
    persist(snapshot(get()));
  },
  setInspectorWidth: (w) => {
    const inspectorWidth = Math.min(
      INSPECTOR_WIDTH_MAX,
      Math.max(INSPECTOR_WIDTH_MIN, Math.round(w)),
    );
    set({ inspectorWidth });
    persist(snapshot(get()));
  },
}));

function snapshot(s: LayoutState): Persisted {
  return {
    explorerOpen: s.explorerOpen,
    explorerWidth: s.explorerWidth,
    inspectorOpen: s.inspectorOpen,
    inspectorWidth: s.inspectorWidth,
    dockOpen: s.dockOpen,
    dockHeight: s.dockHeight,
  };
}
