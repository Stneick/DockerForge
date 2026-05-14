import { useNavigate } from "react-router-dom";
import { Plus, Layers, Clock, Github, Upload, Boxes } from "lucide-react";

import { useProjects } from "@/api/hooks";
import { useAuthStore } from "@/store/auth";
import { langMeta } from "@/lib/languageMeta";
import { timeAgo } from "@/lib/format";
import { useWorkbenchTab } from "@/components/workbench/useWorkbenchTab";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Project } from "@/types/api";

export function DashboardPage() {
  useWorkbenchTab({ kind: "dashboard", title: "Dashboard", pinned: true, id: "/" });
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useProjects({ per_page: 24, sort_by: "updated_at" });
  const navigate = useNavigate();

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="grid-tex pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(circle_at_70%_0%,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-8 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-2xs uppercase tracking-[0.18em] text-cyan">workbench</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Welcome back, {user?.username}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {data ? `${data.pagination.total_items} project${data.pagination.total_items === 1 ? "" : "s"}` : "—"}
              {" · "}
              {user?.total_builds ?? 0} builds forged
            </p>
          </div>
          <Button variant="primary" size="lg" onClick={() => navigate("/projects/new")}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          ) : data && data.items.length > 0 ? (
            <>
              {data.items.map((p) => (
                <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
              ))}
              <button
                onClick={() => navigate("/projects/new")}
                className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line2 text-dim transition-colors hover:border-cyan-dim hover:text-muted"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-dim bg-cyan/10 text-cyan">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">New project</span>
                <span className="font-mono text-2xs text-dim">upload · or · clone repo</span>
              </button>
            </>
          ) : (
            <div className="col-span-full">
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title="No projects yet"
                description="Create your first project, then upload source or clone a repo — DockerForge detects the stack and forges a Dockerfile for you."
                action={
                  <Button variant="primary" onClick={() => navigate("/projects/new")}>
                    <Plus className="h-4 w-4" /> Create project
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const meta = langMeta(project.language);
  return (
    <Card interactive onClick={onClick} className="flex min-h-36 flex-col p-4">
      <div className="flex items-start gap-3">
        {meta ? (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
            style={{ background: meta.color }}
          >
            {meta.short}
          </span>
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface3 text-dim">
            {project.source_type === "git" ? <Github className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{project.name}</h3>
          <p className="truncate text-xs text-muted">{project.description || "No description"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.language && <Badge tone="lang">{meta?.label ?? project.language}</Badge>}
        {project.framework && <Badge tone="cyan">{project.framework}</Badge>}
        {!project.source_uploaded && <Badge tone="warn">no source</Badge>}
      </div>

      <div className="mt-auto flex items-center gap-4 pt-3 font-mono text-2xs text-dim">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" /> {project.total_builds} builds
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {project.last_build_at ? timeAgo(project.last_build_at) : "never built"}
        </span>
      </div>
    </Card>
  );
}
