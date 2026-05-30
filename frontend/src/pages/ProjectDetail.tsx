import { lazy, Suspense } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { useProject } from "@/api/hooks";
import { langMeta } from "@/lib/languageMeta";
import { useWorkbenchTab } from "@/components/workbench/useWorkbenchTab";
import { CenteredSpinner } from "@/components/ui/Skeleton";
import { SetupDoc } from "@/components/project/SetupDoc";
import { StatsView } from "@/components/project/StatsView";
import { ProjectSettings } from "@/components/project/ProjectSettings";
import { BuildsList } from "@/components/project/BuildsList";
import type { Project } from "@/types/api";

// Monaco is heavy — load the Forge (and Monaco) only when the Dockerfile opens.
const Forge = lazy(() => import("@/components/forge/Forge").then((m) => ({ default: m.Forge })));

type TabKey = "dockerfile" | "setup" | "builds" | "stats" | "settings";

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const { data: project, isLoading } = useProject(id, { enabled: !!id });
  useWorkbenchTab({ kind: "project", title: project?.name ?? "Project", id: `/projects/${id}` });

  const [params] = useSearchParams();

  if (isLoading) return <CenteredSpinner label="loading project…" />;
  if (!project) return <CenteredSpinner label="project not found" />;

  const requested = params.get("tab") as TabKey | null;
  const hasSource = project.source_uploaded || project.source_type !== "none";
  const tab: TabKey = requested ?? (hasSource && project.language ? "dockerfile" : "setup");
  const file = params.get("file");

  // The Forge owns the full center + dock + inspector.
  if (tab === "dockerfile") {
    return (
      <Suspense fallback={<CenteredSpinner label="loading editor…" />}>
        <Forge project={project} activeFile={file === "dockerignore" ? "dockerignore" : "dockerfile"} />
      </Suspense>
    );
  }

  // Form-style "documents" scroll in the center with a breadcrumb strip.
  const crumbLabel =
    tab === "setup" ? "Configuration" : tab === "builds" ? "Builds" : tab === "stats" ? "Statistics" : "Settings";
  return (
    <div className="flex h-full flex-col">
      <Breadcrumb project={project} leaf={crumbLabel} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {tab === "setup" && <SetupDoc project={project} />}
        {tab === "builds" && <BuildsList projectId={project.id} />}
        {tab === "stats" && <StatsView projectId={project.id} />}
        {tab === "settings" && <ProjectSettings project={project} />}
      </div>
    </div>
  );
}

function Breadcrumb({ project, leaf }: { project: Project; leaf: string }) {
  const meta = langMeta(project.language);
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-bg2/60 px-4 py-2 text-xs text-dim">
      {meta && (
        <span className="grid h-4 w-4 place-items-center rounded text-[9px] font-bold text-white" style={{ background: meta.color }}>
          {meta.short}
        </span>
      )}
      <span className="text-muted">{project.name}</span>
      <ChevronRight className="h-3 w-3" />
      <span className="text-text">{leaf}</span>
    </div>
  );
}
