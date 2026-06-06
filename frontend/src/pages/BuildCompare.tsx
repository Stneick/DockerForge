import { lazy, Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  HardDrive,
  Clock,
  Layers as LayersIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

import { useCompareBuildConfig, useCompareBuilds } from "@/api/hooks";
import { useBuildNumbers } from "@/hooks/useBuildNumbers";
import { ApiError } from "@/api/http";
import { cn } from "@/lib/cn";
import { formatBytes, formatDuration, shortId } from "@/lib/format";
import { useWorkbenchTab } from "@/components/workbench/useWorkbenchTab";
import { StatusBadge } from "@/components/ui/Badge";
import { Banner, EmptyState } from "@/components/ui/misc";
import { CenteredSpinner } from "@/components/ui/Skeleton";
import { Dock, Inspector, InspectorSection } from "@/components/workbench/panels";
import { LayerCompareChart } from "@/components/build/LayerCompareChart";
import type { BuildConfigChange, BuildConfigComparisonResponse, BuildComparisonResponse, BuildDetail } from "@/types/api";

const CodeDiff = lazy(() =>
  import("@/components/forge/MonacoView").then((m) => ({ default: m.CodeDiff })),
);

export function BuildComparePage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";

  useWorkbenchTab({ kind: "compare", title: "compare builds", id: `/projects/${id}/builds/compare` });

  const configQuery = useCompareBuildConfig(id, a, b);
  const bothSuccess =
    configQuery.data?.build_a.status === "success" && configQuery.data?.build_b.status === "success";
  const artifactQuery = useCompareBuilds(id, a, b, bothSuccess);

  const numbers = useBuildNumbers(id);
  const lbl = (bid: string) => numbers.label(bid) ?? shortId(bid);

  if (!a || !b) {
    return (
      <EmptyState
        title="Pick two builds to compare"
        description="Right-click a build in the Explorer and choose “Compare with…”."
      />
    );
  }
  if (configQuery.isLoading) return <CenteredSpinner label="comparing builds…" />;
  if (configQuery.isError || !configQuery.data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Banner tone="warning">
          {configQuery.error instanceof ApiError ? configQuery.error.message : "Comparison failed."}
        </Banner>
      </div>
    );
  }

  return (
    <CompareView
      config={configQuery.data}
      artifact={artifactQuery.data}
      artifactLoading={bothSuccess && artifactQuery.isLoading}
      lbl={lbl}
    />
  );
}

function CompareView({
  config,
  artifact,
  artifactLoading,
  lbl,
}: {
  config: BuildConfigComparisonResponse;
  artifact: BuildComparisonResponse | undefined;
  artifactLoading: boolean;
  lbl: (bid: string) => string;
}) {
  const { build_a, build_b } = config;
  const configOnly = !artifact;

  const dockTabs = useMemo(() => {
    const tabs: Parameters<typeof Dock>[0]["tabs"] = [];

    if (!config.dockerignore_changed) {
      tabs.push({
        id: "dockerignore",
        label: ".dockerignore",
        content: (
          <EmptyState title="No differences" description="Both builds used an identical .dockerignore." />
        ),
      });
    } else {
      tabs.push({
        id: "dockerignore",
        label: ".dockerignore",
        badge: 1,
        content: (
          <DiffPane
            labelA={lbl(build_a.id)}
            labelB={lbl(build_b.id)}
            original={build_a.dockerignore_content ?? ""}
            modified={build_b.dockerignore_content ?? ""}
            language="plaintext"
          />
        ),
      });
    }

    if (config.config_changes.length > 0) {
      tabs.push({
        id: "config",
        label: "Build config",
        badge: config.config_changes.length,
        content: (
          <div className="h-full overflow-y-auto p-3">
            <ConfigChangesTable changes={config.config_changes} />
          </div>
        ),
      });
    }

    if (artifact) {
      tabs.push({
        id: "layers",
        label: "Layer diff",
        badge: artifact.layer_comparison.length || undefined,
        content: (
          <div className="h-full overflow-y-auto p-3">
            <LayerCompareChart layers={artifact.layer_comparison} />
          </div>
        ),
      });
    } else if (artifactLoading) {
      tabs.push({
        id: "layers",
        label: "Layer diff",
        content: <CenteredSpinner label="loading layer diff…" />,
      });
    }

    return tabs;
  }, [artifact, artifactLoading, build_a, build_b, config, lbl]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-bg2/60 px-4 py-2 text-xs">
        <span className="text-muted">compare</span>
        <ChevronRight className="h-3 w-3 text-dim" />
        <span className="font-mono font-bold text-text">{lbl(build_a.id)}</span>
        <span className="text-dim">↔</span>
        <span className="font-mono font-bold text-cyan">{lbl(build_b.id)}</span>
      </div>

      {configOnly && (
        <div className="shrink-0 border-b border-line px-4 py-2">
          <Banner tone="info">
            {artifactLoading
              ? "Comparing build inputs. Image layer and size diffs are loading…"
              : "Comparing build inputs. Image layer and size diffs require both builds to succeed."}
          </Banner>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {!config.dockerfile_changed ? (
          <EmptyState title="No differences" description="Both builds used an identical Dockerfile." />
        ) : (
          <DiffPane
            labelA={lbl(build_a.id)}
            labelB={lbl(build_b.id)}
            original={build_a.dockerfile_content ?? ""}
            modified={build_b.dockerfile_content ?? ""}
            language="dockerfile"
          />
        )}
      </div>

      {dockTabs.length > 0 && <Dock defaultTab={dockTabs[0]?.id} tabs={dockTabs} />}

      <Inspector>
        <InspectorSection title="Summary">
          <div className="space-y-2">
            <BuildChip build={build_a} label="A" num={lbl(build_a.id)} />
            <BuildChip build={build_b} label="B" num={lbl(build_b.id)} />
          </div>
        </InspectorSection>
        <InspectorSection title="Deltas">
          <div className="space-y-3">
            {artifact ? (
              <>
                <Delta
                  icon={<HardDrive className="h-4 w-4" />}
                  label="Image size"
                  a={formatBytes(build_a.image_size_bytes)}
                  b={formatBytes(build_b.image_size_bytes)}
                  delta={artifact.size_diff_human}
                  direction={artifact.size_diff_bytes}
                />
                <Delta
                  icon={<Clock className="h-4 w-4" />}
                  label="Duration"
                  a={formatDuration(build_a.duration_seconds)}
                  b={formatDuration(build_b.duration_seconds)}
                  delta={`${artifact.duration_diff_seconds > 0 ? "+" : ""}${formatDuration(Math.abs(artifact.duration_diff_seconds))}`}
                  direction={artifact.duration_diff_seconds}
                />
                <Delta
                  icon={<LayersIcon className="h-4 w-4" />}
                  label="Layers"
                  a={`${build_a.layers?.length ?? 0}`}
                  b={`${build_b.layers?.length ?? 0}`}
                  delta={`${(build_b.layers?.length ?? 0) - (build_a.layers?.length ?? 0)}`}
                  direction={(build_b.layers?.length ?? 0) - (build_a.layers?.length ?? 0)}
                  neutral
                />
              </>
            ) : (
              <Delta
                icon={<Clock className="h-4 w-4" />}
                label="Duration"
                a={formatDuration(build_a.duration_seconds)}
                b={formatDuration(build_b.duration_seconds)}
                delta={formatDuration(
                  Math.abs((build_b.duration_seconds ?? 0) - (build_a.duration_seconds ?? 0)),
                )}
                direction={(build_b.duration_seconds ?? 0) - (build_a.duration_seconds ?? 0)}
              />
            )}
          </div>
        </InspectorSection>
        {config.config_changes.length > 0 && (
          <InspectorSection title="Config changes">
            <ConfigChangesTable changes={config.config_changes} compact />
          </InspectorSection>
        )}
      </Inspector>
    </div>
  );
}

function DiffPane({
  labelA,
  labelB,
  original,
  modified,
  language,
}: {
  labelA: string;
  labelB: string;
  original: string;
  modified: string;
  language: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-line bg-chrome font-mono text-2xs">
        <span className="flex-1 border-r border-line px-3 py-1.5 text-muted">A · {labelA}</span>
        <span className="flex-1 px-3 py-1.5 text-cyan">B · {labelB}</span>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<CenteredSpinner label="loading diff…" />}>
          <CodeDiff original={original} modified={modified} language={language} sideBySide />
        </Suspense>
      </div>
    </div>
  );
}

function ConfigChangesTable({
  changes,
  compact,
}: {
  changes: BuildConfigChange[];
  compact?: boolean;
}) {
  const fmt = (v: unknown) => {
    if (v == null) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className={cn("overflow-x-auto", compact && "text-2xs")}>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-line text-left text-dim">
            <th className="pb-2 pr-3 font-semibold text-2xs">Key</th>
            <th className="pb-2 pr-3 font-semibold">A</th>
            <th className="pb-2 font-semibold">B</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((row) => (
            <tr key={row.key} className="border-b border-line/60 last:border-0">
              <td className="py-2 pr-3 align-top font-semibold text-cyan">{row.key}</td>
              <td className="py-2 pr-3 align-top break-all text-muted">{fmt(row.value_a)}</td>
              <td className="py-2 align-top break-all text-text">{fmt(row.value_b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BuildChip({ build, label, num }: { build: BuildDetail; label: string; num: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line2 bg-surface2 px-2.5 py-1.5">
      <span className="font-mono text-2xs font-bold text-dim">{label}</span>
      <span className="font-mono text-xs font-bold">{num}</span>
      <span className="font-mono text-2xs text-dim">{shortId(build.id)}</span>
      <span className="ml-auto">
        <StatusBadge status={build.status} />
      </span>
    </div>
  );
}

function Delta({
  icon,
  label,
  a,
  b,
  delta,
  direction,
  neutral,
}: {
  icon: React.ReactNode;
  label: string;
  a: string;
  b: string;
  delta: string;
  direction: number;
  neutral?: boolean;
}) {
  const tone = neutral || direction === 0 ? "text-dim" : direction > 0 ? "text-fail" : "text-ok";
  const Icon = direction === 0 ? Minus : direction > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-lg border border-line bg-bg2 p-3">
      <div className="flex items-center gap-1.5 label-mono">
        <span className="text-cyan">{icon}</span>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-xs text-muted">{a}</span>
        <span className="text-dim">→</span>
        <span className="font-mono text-sm font-bold">{b}</span>
        <span className={cn("ml-auto flex items-center gap-0.5 font-mono text-2xs font-semibold", tone)}>
          <Icon className="h-3 w-3" />
          {delta}
        </span>
      </div>
    </div>
  );
}
