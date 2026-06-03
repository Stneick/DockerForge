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
  /** Move tab to `toIndex` (0-based, clamped). */
  reorderTab: (id: string, toIndex: number) => void;
  /** Reorder draggable tabs (dashboard / pinned slots stay fixed). */
  reorderSortableTabs: (orderedSortableIds: string[]) => void;
}

// Persist the open workspace (tabs + active) so a reload reopens what you had,
// like VS Code. Status dots are transient and refresh once a page mounts.
const KEY = "df.tabs";
interface PersistedTabs {
  tabs: WorkbenchTab[];
  activeId: string | null;
}
function isShellTab(tab: WorkbenchTab) {
  return tab.kind === "dashboard" || tab.kind === "settings";
}

function tabIsLocked(tab: WorkbenchTab) {
  return !!tab.pinned;
}

function applySortableOrder(tabs: WorkbenchTab[], orderedSortableIds: string[]): WorkbenchTab[] {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  let sortableIdx = 0;
  const next = tabs.map((tab) => {
    if (tabIsLocked(tab)) return tab;
    const id = orderedSortableIds[sortableIdx++];
    return (id ? byId.get(id) : undefined) ?? tab;
  });
  return next;
}

function loadTabs(): PersistedTabs {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (data && Array.isArray(data.tabs)) {
      const tabs = data.tabs.filter((t: WorkbenchTab) => !isShellTab(t));
      const activeId =
        data.activeId && tabs.some((t: WorkbenchTab) => t.id === data.activeId)
          ? data.activeId
          : (tabs[0]?.id ?? null);
      return { tabs, activeId };
    }
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
      const tabs = [...s.tabs, tab];
      return { tabs, activeId: tab.id };
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
  reorderTab: (id, toIndex) =>
    set((s) => {
      const from = s.tabs.findIndex((t) => t.id === id);
      if (from < 0) return s;
      const tab = s.tabs[from];
      if (tabIsLocked(tab)) return s;
      const max = s.tabs.length - 1;
      const to = Math.max(0, Math.min(toIndex, max));
      if (from === to) return s;
      const tabs = [...s.tabs];
      const [item] = tabs.splice(from, 1);
      tabs.splice(to, 0, item);
      return { tabs };
    }),
  reorderSortableTabs: (orderedSortableIds) =>
    set((s) => {
      if (orderedSortableIds.length < 2) return s;
      return { tabs: applySortableOrder(s.tabs, orderedSortableIds) };
    }),
}));

// Persist on any change.
useTabsStore.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tabs: s.tabs, activeId: s.activeId }));
  } catch {
    /* ignore */
  }
});
