import { create } from "zustand";

// The Workbench keeps a set of open "tabs" (like an IDE). Each tab maps to a
// route. Opening a route that's already open just re-activates its tab.
export type TabKind =
  | "dashboard"
  | "project"
  | "build"
  | "compare"
  | "settings"
  | "new-project";

export interface WorkbenchTab {
  id: string; // stable key, usually the path
  kind: TabKind;
  title: string;
  path: string;
  /** Optional status dot (e.g. live build). */
  status?: "building" | "success" | "failed" | "pending" | "cancelled";
  /** Dashboard/settings tabs can't be closed. */
  pinned?: boolean;
}

interface TabsState {
  tabs: WorkbenchTab[];
  activeId: string | null;
  openTab: (tab: WorkbenchTab) => void;
  closeTab: (id: string) => string | null; // returns next path to navigate to
  setActive: (id: string) => void;
  updateTab: (id: string, patch: Partial<WorkbenchTab>) => void;
}

// Persist the open workspace (tabs + active) so a reload reopens what you had,
// like VS Code. Status dots are transient and refresh once a page mounts.
const KEY = "df.tabs";
interface PersistedTabs {
  tabs: WorkbenchTab[];
  activeId: string | null;
}
function loadTabs(): PersistedTabs {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (data && Array.isArray(data.tabs)) return { tabs: data.tabs, activeId: data.activeId ?? null };
  } catch {
    /* ignore */
  }
  return { tabs: [], activeId: null };
}

const initial = loadTabs();

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: initial.tabs,
  activeId: initial.activeId,

  openTab: (tab) =>
    set((s) => {
      const existing = s.tabs.find((t) => t.id === tab.id);
      if (existing) {
        // refresh title/status but keep position
        return {
          activeId: tab.id,
          tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, ...tab } : t)),
        };
      }
      return { tabs: [...s.tabs, tab], activeId: tab.id };
    }),

  closeTab: (id) => {
    const { tabs, activeId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const next = tabs.filter((t) => t.id !== id);
    let nextPath: string | null = null;
    if (activeId === id) {
      const neighbor = next[idx] ?? next[idx - 1] ?? null;
      nextPath = neighbor?.path ?? null;
      set({ tabs: next, activeId: neighbor?.id ?? null });
    } else {
      set({ tabs: next });
    }
    return nextPath;
  },

  setActive: (id) => set({ activeId: id }),
  updateTab: (id, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
}));

// Persist on any change.
useTabsStore.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tabs: s.tabs, activeId: s.activeId }));
  } catch {
    /* ignore */
  }
});
