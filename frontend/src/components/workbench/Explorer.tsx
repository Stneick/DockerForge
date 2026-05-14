import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  FileCode2,
  FileX2,
  SlidersHorizontal,
  BarChart3,
  Settings as SettingsIcon,
  Layers,
  Plus,
  Search,
  LayoutDashboard,
  Github,
  Upload,
  FolderGit2,
} from "lucide-react";

import { useBuilds, useProject, useProjects } from "@/api/hooks";
import { useBuildNumbers } from "@/hooks/useBuildNumbers";
import { cn } from "@/lib/cn";
import { langMeta } from "@/lib/languageMeta";
import { shortId, timeAgo } from "@/lib/format";
import { useCommandPalette } from "@/components/CommandPalette";
import { BuildContextMenu } from "@/components/build/BuildContextMenu";
import { StatusDot } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Project } from "@/types/api";

export function Explorer() {
  const { data, isLoading } = useProjects({ per_page: 50, sort_by: "updated_at" });
  const setPaletteOpen = useCommandPalette((s) => s.setOpen);
  const navigate = useNavigate();
  const { id: activeId } = useParams();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-chrome">
      <button
        onClick={() => setPaletteOpen(true)}
        className="m-2 flex items-center gap-2 rounded-lg border border-line2 bg-bg2 px-2.5 py-1.5 text-xs text-dim transition-colors hover:border-cyan-dim"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="font-mono text-2xs text-cyan">⌘K</kbd>
      </button>

      <nav className="px-2 pb-1">
        <NavRow to="/" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
      </nav>

      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="label-mono">Explorer</span>
        <button
          onClick={() => navigate("/projects/new")}
          className="rounded p-0.5 text-dim transition-colors hover:bg-surface2 hover:text-cyan"
          title="New project"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {isLoading ? (
          <div className="space-y-1.5 px-1 py-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          data.items.map((p) => <ProjectNode key={p.id} project={p} activeId={activeId} />)
        ) : (
          <button
            onClick={() => navigate("/projects/new")}
            className="mt-2 flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-line2 px-3 py-5 text-center text-xs text-dim transition-colors hover:border-cyan-dim hover:text-muted"
          >
            <FolderGit2 className="h-5 w-5" />
            No projects yet
            <span className="text-cyan">Create one →</span>
          </button>
        )}
      </div>

      {activeId && <SourceFooter projectId={activeId} />}
    </aside>
  );
}

function NavRow({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <button
      onClick={() => navigate(to)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active ? "bg-cyan/10 text-cyan" : "text-muted hover:bg-surface2 hover:text-text",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

const FILE_NODES = [
  { tab: "dockerfile", label: "Dockerfile", icon: FileCode2 },
  { tab: "dockerfile", label: ".dockerignore", icon: FileX2, ignore: true },
  { tab: "setup", label: "Configuration", icon: SlidersHorizontal },
  { tab: "stats", label: "Statistics", icon: BarChart3 },
  { tab: "settings", label: "Settings", icon: SettingsIcon },
] as const;

function ProjectNode({ project, activeId }: { project: Project; activeId?: string }) {
  const isActive = activeId === project.id;
  const [expanded, setExpanded] = useState(isActive);
  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const navigate = useNavigate();
  const location = useLocation();
  const meta = langMeta(project.language);
  const currentTab = new URLSearchParams(location.search).get("tab") ?? "dockerfile";
  const onProjectRoot = location.pathname === `/projects/${project.id}`;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
          isActive ? "bg-cyan/[0.08]" : "hover:bg-surface2",
        )}
      >
        <button onClick={() => setExpanded((e) => !e)} className="grid h-7 w-5 place-items-center text-dim">
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <button
          onClick={() => navigate(`/projects/${project.id}`)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          {meta ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-2xs font-bold text-white" style={{ background: meta.color }}>
              {meta.short}
            </span>
          ) : (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface3 text-dim">
              {project.source_type === "git" ? <Github className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
            </span>
          )}
          <span className={cn("truncate text-sm", isActive ? "font-semibold text-cyan" : "text-text")}>
            {project.name}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="ml-[18px] border-l border-line pl-1.5">
          {FILE_NODES.map((node) => {
            const Icon = node.icon;
            const isIgnore = "ignore" in node && node.ignore;
            const currentFile = new URLSearchParams(location.search).get("file");
            const selected = onProjectRoot && currentTab === node.tab && (isIgnore ? currentFile === "dockerignore" : currentFile !== "dockerignore");
            return (
              <LeafRow
                key={node.label}
                icon={<Icon className="h-3.5 w-3.5" />}
                label={node.label}
                selected={selected}
                onClick={() => navigate(`/projects/${project.id}?tab=${node.tab}${isIgnore ? "&file=dockerignore" : ""}`)}
              />
            );
          })}
          <BuildsBranch projectId={project.id} active={isActive} />
        </div>
      )}
    </div>
  );
}

function BuildsBranch({ projectId, active }: { projectId: string; active: boolean }) {
  const [open, setOpen] = useState(active);
  const { data, isLoading } = useBuilds(projectId, { per_page: 8 }, { enabled: open });
  const numbers = useBuildNumbers(projectId);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <div className="flex items-center rounded-md text-xs text-muted transition-colors hover:bg-surface2">
        <button onClick={() => setOpen((o) => !o)} className="grid h-7 w-5 place-items-center text-dim">
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        </button>
        <button
          onClick={() => navigate(`/projects/${projectId}?tab=builds`)}
          className="flex flex-1 items-center gap-2 py-1.5 text-left hover:text-text"
        >
          <Layers className="h-3.5 w-3.5 text-dim" />
          <span className="flex-1">builds</span>
        </button>
      </div>
      {open && (
        <div className="ml-3.5 border-l border-line pl-1.5">
          {isLoading ? (
            <div className="px-2 py-1"><Skeleton className="h-5 w-full" /></div>
          ) : data && data.items.length > 0 ? (
            data.items.map((b) => {
              const isActive = location.pathname === `/projects/${projectId}/builds/${b.id}`;
              return (
                <BuildContextMenu key={b.id} projectId={projectId} build={b}>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/builds/${b.id}`)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-mono text-2xs transition-colors",
                      isActive ? "bg-cyan/[0.08] text-cyan" : "text-muted hover:bg-surface2 hover:text-text",
                    )}
                  >
                    <StatusDot status={b.status} />
                    <span className="flex-1">{numbers.label(b.id) ?? shortId(b.id)}</span>
                    <span className="text-dim">{timeAgo(b.created_at)}</span>
                  </button>
                </BuildContextMenu>
              );
            })
          ) : (
            <div className="px-2 py-1 font-mono text-2xs text-dim">no builds</div>
          )}
        </div>
      )}
    </div>
  );
}

function LeafRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        selected ? "bg-cyan/[0.08] text-cyan" : "text-muted hover:bg-surface2 hover:text-text",
      )}
    >
      <span className={selected ? "text-cyan" : "text-dim"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function SourceFooter({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId, { enabled: !!projectId });
  if (!project) return null;
  const hasSource = project.source_uploaded || project.source_type !== "none";
  return (
    <div className="border-t border-line px-3.5 py-3">
      <div className="label-mono mb-2">Source · detected</div>
      <div className="space-y-1 font-mono text-2xs">
        <Row k="src" v={project.source_type} />
        <Row k="lang" v={project.language ?? "—"} accent={!!project.language} />
        <Row k="fw" v={project.framework ?? "—"} accent={!!project.framework} />
        <Row k="deps" v={project.dependency_file ?? "—"} />
        {!hasSource && <div className="pt-1 text-warn">⚠ no source yet</div>}
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-9 shrink-0 text-dim">{k}</span>
      <span className={cn("truncate", accent ? "text-cyan" : "text-muted")}>{v}</span>
    </div>
  );
}
