import { lazy, Suspense } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, HardDrive, Clock, Layers as LayersIcon, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

import { useCompareBuilds } from "@/api/hooks";
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
import type { BuildDetail } from "@/types/api";

const CodeDiff = lazy(() =>
  import("@/components/forge/MonacoView").then((m) => ({ default: m.CodeDiff })),
);

export function BuildComparePage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";

  useWorkbenchTab({ kind: "compare", title: "compare builds", id: `/projects/${id}/builds/compare` });

  const { data, isLoading, isError, error } = useCompareBuilds(id, a, b);
  const numbers = useBuildNumbers(id);
  const lbl = (bid: string) => numbers.label(bid) ?? shortId(bid);

  if (!a || !b) return <EmptyState title="Pick two builds to compare" description="Right-click a build in the Explorer and choose “Compare with…”." />;
  if (isLoading) return <CenteredSpinner label="comparing builds…" />;
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Banner tone="warning">
          {error instanceof ApiError ? error.message : "Comparison failed. Both builds must be successful."}
        </Banner>
      </div>
    );
  }

  const { build_a, build_b } = data;
  const sameDockerfile = (build_a.dockerfile_content ?? "") === (build_b.dockerfile_content ?? "");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-bg2/60 px-4 py-2 text-xs">
        <span className="text-muted">compare</span>
        <ChevronRight className="h-3 w-3 text-dim" />
        <span className="font-mono font-bold text-text">{lbl(build_a.id)}</span>
        <span className="text-dim">↔</span>
        <span className="font-mono font-bold text-cyan">{lbl(build_b.id)}</span>
      </div>

      {/* center: dockerfile diff */}
      <div className="min-h-0 flex-1">
        {sameDockerfile ? (
          <EmptyState title="No differences" description="Both builds used an identical Dockerfile." />
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 border-b border-line bg-chrome font-mono text-2xs">
              <span className="flex-1 border-r border-line px-3 py-1.5 text-muted">A · {lbl(build_a.id)}</span>
              <span className="flex-1 px-3 py-1.5 text-cyan">B · {lbl(build_b.id)}</span>
            </div>
            <div className="min-h-0 flex-1">
              <Suspense fallback={<CenteredSpinner label="loading diff…" />}>
                <CodeDiff original={build_a.dockerfile_content ?? ""} modified={build_b.dockerfile_content ?? ""} language="dockerfile" sideBySide />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* DOCK: layer comparison */}
      <Dock
        defaultTab="layers"
        tabs={[
          {
            id: "layers",
            label: "Layer diff",
            badge: data.layer_comparison.length || undefined,
            content: (
              <div className="h-full overflow-y-auto p-3">
                <LayerCompareChart layers={data.layer_comparison} />
              </div>
            ),
          },
        ]}
      />

      {/* INSPECTOR: deltas */}
      <Inspector>
        <InspectorSection title="Summary">
          <div className="space-y-2">
            <BuildChip build={build_a} label="A" num={lbl(build_a.id)} />
            <BuildChip build={build_b} label="B" num={lbl(build_b.id)} />
          </div>
        </InspectorSection>
        <InspectorSection title="Deltas">
          <div className="space-y-3">
            <Delta icon={<HardDrive className="h-4 w-4" />} label="Image size" a={formatBytes(build_a.image_size_bytes)} b={formatBytes(build_b.image_size_bytes)} delta={data.size_diff_human} direction={data.size_diff_bytes} />
            <Delta icon={<Clock className="h-4 w-4" />} label="Duration" a={formatDuration(build_a.duration_seconds)} b={formatDuration(build_b.duration_seconds)} delta={`${data.duration_diff_seconds > 0 ? "+" : ""}${formatDuration(Math.abs(data.duration_diff_seconds))}`} direction={data.duration_diff_seconds} />
            <Delta icon={<LayersIcon className="h-4 w-4" />} label="Layers" a={`${build_a.layers?.length ?? 0}`} b={`${build_b.layers?.length ?? 0}`} delta={`${(build_b.layers?.length ?? 0) - (build_a.layers?.length ?? 0)}`} direction={(build_b.layers?.length ?? 0) - (build_a.layers?.length ?? 0)} neutral />
          </div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}

function BuildChip({ build, label, num }: { build: BuildDetail; label: string; num: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line2 bg-surface2 px-2.5 py-1.5">
      <span className="font-mono text-2xs font-bold text-dim">{label}</span>
      <span className="font-mono text-xs font-bold">{num}</span>
      <span className="font-mono text-2xs text-dim">{shortId(build.id)}</span>
      <span className="ml-auto"><StatusBadge status={build.status} /></span>
    </div>
  );
}

function Delta({ icon, label, a, b, delta, direction, neutral }: { icon: React.ReactNode; label: string; a: string; b: string; delta: string; direction: number; neutral?: boolean }) {
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
