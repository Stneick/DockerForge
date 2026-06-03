import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { create } from "zustand";
import {
  LayoutDashboard, Plus, Settings, FolderGit2, Search, CornerDownLeft,
  FileCode2, SlidersHorizontal, Layers, Activity, PanelLeft, PanelBottom, PanelRight,
  Palette, Keyboard, Check,
} from "lucide-react";

import { useProjects } from "@/api/hooks";
import { useLayout } from "@/store/layout";
import { usePrefs } from "@/store/prefs";
import { THEMES } from "@/lib/themes";
import { projectSettingsHref } from "@/lib/projectNav";
import { cn } from "@/lib/cn";
import { langMeta } from "@/lib/languageMeta";
import { Kbd } from "@/components/ui/misc";
import { useShortcutsHelp } from "@/components/ShortcutsHelp";

// Global open/close state (F1 and click targets toggle it).
interface PaletteStore {
  open: boolean;
  setOpen: (v: boolean) => void;
}
export const useCommandPalette = create<PaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
}

const PROJECT_RE = /\/projects\/([0-9a-f-]{36})/;

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: projectsData } = useProjects({ per_page: 50, sort_by: "updated_at" });
  const layout = useLayout();
  const themeId = usePrefs((s) => s.themeId);
  const setTheme = usePrefs((s) => s.setTheme);
  const openHelp = useShortcutsHelp((s) => s.setOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const projectId = location.pathname.match(PROJECT_RE)?.[1];

  const commands = useMemo<Command[]>(() => {
    const projects = projectsData?.items ?? [];
    const go = (path: string) => () => {
      navigate(path);
      setOpen(false);
    };
    const act = (fn: () => void) => () => {
      fn();
      setOpen(false);
    };

    const list: Command[] = [];

    // Context: actions for the project you're currently in.
    if (projectId) {
      const p = projects.find((x) => x.id === projectId);
      const name = p?.name ? `· ${p.name}` : "";
      list.push(
        { group: "This project", id: "p-df", label: "Open Dockerfile", hint: name, icon: <FileCode2 className="h-4 w-4" />, run: go(`/projects/${projectId}?tab=dockerfile`) },
        { group: "This project", id: "p-cfg", label: "Configuration", icon: <SlidersHorizontal className="h-4 w-4" />, run: go(`/projects/${projectId}?tab=setup`) },
        { group: "This project", id: "p-builds", label: "Builds", icon: <Layers className="h-4 w-4" />, run: go(`/projects/${projectId}?tab=builds`) },
        { group: "This project", id: "p-stats", label: "Statistics", icon: <Activity className="h-4 w-4" />, run: go(`/projects/${projectId}?tab=stats`) },
        { group: "This project", id: "p-set", label: "Project settings", icon: <Settings className="h-4 w-4" />, run: go(projectSettingsHref(projectId, location.search)) },
      );
    }

    // Navigation.
    list.push(
      { group: "Go to", id: "dash", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, run: go("/") },
      { group: "Go to", id: "new", label: "New project", hint: "upload or clone", icon: <Plus className="h-4 w-4" />, run: go("/projects/new") },
      { group: "Go to", id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, run: go("/settings") },
    );
    for (const p of projects) {
      list.push({
        group: "Go to",
        id: `proj-${p.id}`,
        label: p.name,
        hint: [p.language, p.framework].filter(Boolean).join(" · ") || "no source yet",
        keywords: `${p.language ?? ""} ${p.framework ?? ""} project`,
        icon: p.language ? (
          <span className="grid h-5 w-5 place-items-center rounded text-2xs font-bold text-white" style={{ background: langMeta(p.language)?.color }}>
            {langMeta(p.language)?.short}
          </span>
        ) : (
          <FolderGit2 className="h-4 w-4" />
        ),
        run: go(`/projects/${p.id}`),
      });
    }

    // View / layout.
    list.push(
      { group: "View", id: "v-exp", label: `${layout.explorerOpen ? "Hide" : "Show"} Explorer`, keywords: "toggle sidebar panel", icon: <PanelLeft className="h-4 w-4" />, run: act(layout.toggleExplorer) },
      { group: "View", id: "v-dock", label: `${layout.dockOpen ? "Hide" : "Show"} Panel`, keywords: "toggle dock terminal problems", icon: <PanelBottom className="h-4 w-4" />, run: act(layout.toggleDock) },
      { group: "View", id: "v-insp", label: `${layout.inspectorOpen ? "Hide" : "Show"} Inspector`, keywords: "toggle right panel", icon: <PanelRight className="h-4 w-4" />, run: act(layout.toggleInspector) },
      { group: "View", id: "v-help", label: "Keyboard shortcuts", hint: "?", icon: <Keyboard className="h-4 w-4" />, run: act(() => openHelp(true)) },
    );

    // Theme.
    for (const t of THEMES) {
      list.push({
        group: "Theme",
        id: `theme-${t.id}`,
        label: `Theme: ${t.name}`,
        hint: themeId === t.id ? "current" : undefined,
        keywords: "color appearance",
        icon: themeId === t.id ? <Check className="h-4 w-4 text-cyan" /> : <Palette className="h-4 w-4" />,
        run: act(() => setTheme(t.id)),
      });
    }

    return list;
  }, [projectsData, projectId, location.search, navigate, setOpen, layout, themeId, setTheme, openHelp]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={() => setOpen(false)}
    >
      <div className="panel w-[min(92vw,620px)] overflow-hidden shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search… (build, theme, project)"
            className="h-12 flex-1 bg-transparent text-sm text-text placeholder:text-dim focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {filtered.length === 0 && <div className="px-3 py-8 text-center text-sm text-dim">No matches</div>}
          {filtered.map((c, i) => {
            const showHeader = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {showHeader && <div className="px-2 pb-1 pt-2.5 label-mono">{c.group}</div>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => c.run()}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    i === active ? "bg-cyan/10 text-cyan" : "text-text hover:bg-surface2",
                  )}
                >
                  <span className={cn("shrink-0", i === active ? "text-cyan" : "text-dim")}>{c.icon}</span>
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="truncate font-mono text-2xs text-dim">{c.hint}</span>}
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-cyan" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
