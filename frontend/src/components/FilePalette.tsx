import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { create } from "zustand";
import {
  Activity,
  CornerDownLeft,
  FileCode2,
  FileX2,
  FolderGit2,
  LayoutDashboard,
  Layers,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

import { useProjects } from "@/api/hooks";
import { useExplorerBuilds } from "@/hooks/useExplorerBuilds";
import { cn } from "@/lib/cn";
import { langMeta } from "@/lib/languageMeta";
import { projectSettingsHref } from "@/lib/projectNav";
import { shortId } from "@/lib/format";
import { Kbd } from "@/components/ui/misc";
import { StatusDot } from "@/components/ui/Badge";

interface FilePaletteStore {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const useFilePalette = create<FilePaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface FileEntry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function FilePalette() {
  const { open, setOpen } = useFilePalette();
  const navigate = useNavigate();
  const { data: projectsData } = useProjects({ per_page: 50, sort_by: "updated_at" });
  const projectIds = useMemo(
    () => projectsData?.items.map((p) => p.id) ?? [],
    [projectsData?.items],
  );
  const buildsByProject = useExplorerBuilds(projectIds);
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

  const entries = useMemo<FileEntry[]>(() => {
    const projects = projectsData?.items ?? [];
    const go = (path: string) => () => {
      navigate(path);
      setOpen(false);
    };

    const list: FileEntry[] = [
      {
        id: "dash",
        group: "Workspace",
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: go("/"),
      },
      {
        id: "new",
        group: "Workspace",
        label: "New project",
        hint: "upload or clone",
        icon: <Plus className="h-4 w-4" />,
        run: go("/projects/new"),
      },
      {
        id: "settings",
        group: "Workspace",
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
        run: go("/settings"),
      },
    ];

    for (const p of projects) {
      const group = p.name;
      const langIcon = p.language ? (
        <span
          className="grid h-5 w-5 place-items-center rounded text-2xs font-bold text-white"
          style={{ background: langMeta(p.language)?.color }}
        >
          {langMeta(p.language)?.short}
        </span>
      ) : (
        <FolderGit2 className="h-4 w-4" />
      );

      list.push(
        {
          id: `${p.id}-dockerfile`,
          group,
          label: "Dockerfile",
          keywords: "dockerfile forge",
          icon: <FileCode2 className="h-4 w-4" />,
          run: go(`/projects/${p.id}?tab=dockerfile`),
        },
        {
          id: `${p.id}-dockerignore`,
          group,
          label: ".dockerignore",
          keywords: "dockerignore",
          icon: <FileX2 className="h-4 w-4" />,
          run: go(`/projects/${p.id}?tab=dockerfile&file=dockerignore`),
        },
        {
          id: `${p.id}-setup`,
          group,
          label: "Configuration",
          keywords: "setup config source",
          icon: <SlidersHorizontal className="h-4 w-4" />,
          run: go(`/projects/${p.id}?tab=setup`),
        },
        {
          id: `${p.id}-builds-tab`,
          group,
          label: "Builds",
          keywords: "builds list",
          icon: <Layers className="h-4 w-4" />,
          run: go(`/projects/${p.id}?tab=builds`),
        },
        {
          id: `${p.id}-stats`,
          group,
          label: "Statistics",
          keywords: "stats",
          icon: <Activity className="h-4 w-4" />,
          run: go(`/projects/${p.id}?tab=stats`),
        },
        {
          id: `${p.id}-settings`,
          group,
          label: "Project settings",
          keywords: "settings",
          icon: <Settings className="h-4 w-4" />,
          run: go(projectSettingsHref(p.id)),
        },
      );

      const builds = buildsByProject.get(p.id)?.items ?? [];
      for (const b of builds) {
        const label = buildsByProject.get(p.id)?.label(b.id) ?? shortId(b.id);
        list.push({
          id: `${p.id}-build-${b.id}`,
          group: `${p.name} · builds`,
          label,
          hint: b.status,
          keywords: `build ${b.image_tag ?? ""}`,
          icon: <StatusDot status={b.status} />,
          run: go(`/projects/${p.id}/builds/${b.id}`),
        });
      }

      // Project root as navigable target
      list.push({
        id: `${p.id}-root`,
        group,
        label: p.name,
        hint: [p.language, p.framework].filter(Boolean).join(" · ") || undefined,
        keywords: `${p.language ?? ""} ${p.framework ?? ""} project`,
        icon: langIcon,
        run: go(`/projects/${p.id}`),
      });
    }

    return list;
  }, [projectsData?.items, buildsByProject, navigate, setOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.label} ${e.hint ?? ""} ${e.keywords ?? ""} ${e.group}`.toLowerCase().includes(q),
    );
  }, [entries, query]);

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
      <div
        className="panel w-[min(92vw,620px)] overflow-hidden shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Go to file… (Dockerfile, build, project tab)"
            className="h-12 flex-1 bg-transparent text-sm text-text placeholder:text-dim focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-dim">No matches</div>
          )}
          {filtered.map((e, i) => {
            const showHeader = e.group !== lastGroup;
            lastGroup = e.group;
            return (
              <div key={e.id}>
                {showHeader && <div className="px-2 pb-1 pt-2.5 label-mono">{e.group}</div>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => e.run()}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    i === active ? "bg-cyan/10 text-cyan" : "text-text hover:bg-surface2",
                  )}
                >
                  <span className={cn("shrink-0", i === active ? "text-cyan" : "text-dim")}>
                    {e.icon}
                  </span>
                  <span className="flex-1 truncate">{e.label}</span>
                  {e.hint && (
                    <span className="truncate font-mono text-2xs text-dim">{e.hint}</span>
                  )}
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
