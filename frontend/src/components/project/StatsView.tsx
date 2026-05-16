import { Activity, Clock, Zap, Timer, HardDrive, DatabaseZap } from "lucide-react";

import { useProjectStats } from "@/api/hooks";
import { formatBytes, formatDuration } from "@/lib/format";
import { CenteredSpinner } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/misc";
import type { CacheBucketStats } from "@/types/api";

export function StatsView({ projectId }: { projectId: string }) {
  const { data: stats, isLoading } = useProjectStats(projectId);

  if (isLoading) return <CenteredSpinner label="loading stats…" />;
  if (!stats || stats.total_builds === 0) {
    return <EmptyState icon={<Activity className="h-6 w-6" />} title="No build data yet" description="Stats appear after your first build." />;
  }

  const pct = Math.round(stats.success_rate * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
        {/* success ring */}
        <div className="panel flex items-center gap-5 p-5">
          <div
            className="relative grid h-28 w-28 place-items-center rounded-full"
            style={{
              background: `radial-gradient(closest-side, rgb(var(--bg2)) 78%, transparent 79%), conic-gradient(rgb(var(--cyan)) ${pct}%, rgb(var(--surface3)) 0)`,
            }}
          >
            <div className="text-center">
              <div className="text-2xl font-extrabold">{pct}%</div>
              <div className="font-mono text-2xs text-dim">success</div>
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <Legend color="bg-ok" label="success" value={stats.successful_builds} />
            <Legend color="bg-fail" label="failed" value={stats.failed_builds} />
            <Legend color="bg-dim" label="cancelled" value={stats.cancelled_builds} />
            <div className="pt-1 font-mono text-2xs text-dim">{stats.total_builds} total builds</div>
          </div>
        </div>

        {/* duration / size cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Metric icon={<Clock className="h-4 w-4" />} label="Avg duration" value={formatDuration(stats.avg_duration_seconds)} />
          <Metric icon={<HardDrive className="h-4 w-4" />} label="Avg image size" value={formatBytes(stats.avg_image_size_bytes)} />
          <Metric icon={<Zap className="h-4 w-4" />} label="Fastest" value={formatDuration(stats.fastest_build_seconds)} tone="ok" />
          <Metric icon={<Timer className="h-4 w-4" />} label="Slowest" value={formatDuration(stats.slowest_build_seconds)} tone="warn" />
        </div>
      </div>

      {/* cache effectiveness */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <DatabaseZap className="h-4 w-4 text-cyan" /> Cache effectiveness
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CacheCard title="Cached builds" accent="text-cyan" bucket={stats.cached_builds} />
          <CacheCard title="No-cache builds" accent="text-warn" bucket={stats.no_cache_builds} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-mono font-semibold">{value}</span>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-1.5 label-mono">
        <span className="text-cyan">{icon}</span>
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-extrabold ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : ""}`}>{value}</div>
    </div>
  );
}

function CacheCard({ title, accent, bucket }: { title: string; accent: string; bucket: CacheBucketStats }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${accent}`}>{title}</span>
        <span className="font-mono text-2xs text-dim">{bucket.count} builds</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mini label="avg" value={formatDuration(bucket.avg_duration_seconds)} />
        <Mini label="min" value={formatDuration(bucket.min_duration_seconds)} />
        <Mini label="max" value={formatDuration(bucket.max_duration_seconds)} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg2 py-2">
      <div className="font-mono text-sm font-bold">{value}</div>
      <div className="font-mono text-2xs text-dim">{label}</div>
    </div>
  );
}
