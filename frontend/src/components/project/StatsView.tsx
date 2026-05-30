import {
  Activity,
  Clock,
  DatabaseZap,
  HardDrive,
  Package,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";

import { useProjectStats } from "@/api/hooks";
import { cn } from "@/lib/cn";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatPercent,
  timeAgo,
} from "@/lib/format";
import { CenteredSpinner } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/misc";
import type { CacheBucketStats, ProjectStats } from "@/types/api";

const OUTCOME_SEGMENTS: {
  key: keyof Pick<
    ProjectStats,
    "successful_builds" | "failed_builds" | "cancelled_builds" | "pending_builds" | "building_builds"
  >;
  label: string;
  color: string;
}[] = [
  { key: "successful_builds", label: "Success", color: "bg-ok" },
  { key: "failed_builds", label: "Failed", color: "bg-fail" },
  { key: "cancelled_builds", label: "Cancelled", color: "bg-dim" },
  { key: "pending_builds", label: "Pending", color: "bg-warn" },
  { key: "building_builds", label: "Building", color: "bg-cyan animate-pulse" },
];

export function StatsView({ projectId }: { projectId: string }) {
  const { data: stats, isLoading } = useProjectStats(projectId);

  if (isLoading) return <CenteredSpinner label="loading stats…" />;
  if (!stats || stats.total_builds === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No build data yet"
        description="Stats appear after your first build."
      />
    );
  }

  const pct = Math.round(stats.success_rate * 100);
  const activeCount = stats.pending_builds + stats.building_builds;
  const cacheDelta =
    stats.cached_builds.avg_duration_seconds != null &&
    stats.no_cache_builds.avg_duration_seconds != null
      ? stats.no_cache_builds.avg_duration_seconds - stats.cached_builds.avg_duration_seconds
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {/* summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SuccessCard pct={pct} stats={stats} />
        <OutcomesCard stats={stats} />
        <ActivityCard stats={stats} activeCount={activeCount} />
      </div>

      {/* duration */}
      <Section title="Build performance" icon={<Clock className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Average" value={formatDuration(stats.avg_duration_seconds)} />
          <Metric label="Fastest" value={formatDuration(stats.fastest_build_seconds)} tone="ok" />
          <Metric label="Slowest" value={formatDuration(stats.slowest_build_seconds)} tone="warn" />
          <Metric
            label="Cached avg"
            value={formatDuration(stats.cached_builds.avg_duration_seconds)}
            hint={`${stats.cached_builds.count} builds`}
          />
          <Metric
            label="No-cache avg"
            value={formatDuration(stats.no_cache_builds.avg_duration_seconds)}
            hint={`${stats.no_cache_builds.count} builds`}
          />
        </div>
      </Section>

      {/* images */}
      <Section title="Image storage" icon={<HardDrive className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Average size" value={formatBytes(stats.avg_image_size_bytes)} />
          <Metric label="Smallest" value={formatBytes(stats.min_image_size_bytes)} tone="ok" />
          <Metric label="Largest" value={formatBytes(stats.max_image_size_bytes)} tone="warn" />
          <Metric
            label="Active on disk"
            value={formatBytes(stats.total_active_image_size_bytes)}
            hint="uncleaned images"
          />
          <Metric
            label="Cleaned up"
            value={String(stats.cleaned_builds_count)}
            hint="images removed"
            tone={stats.cleaned_builds_count > 0 ? "muted" : undefined}
          />
        </div>
      </Section>

      {/* cache */}
      <Section
        title="Cache effectiveness"
        icon={<DatabaseZap className="h-4 w-4" />}
        aside={
          cacheDelta != null && cacheDelta > 0 ? (
            <span className="font-mono text-2xs text-ok">
              ~{formatDuration(cacheDelta)} saved per cached build
            </span>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CacheCard title="With cache" accent="text-cyan" bucket={stats.cached_builds} />
          <CacheCard title="No cache" accent="text-warn" bucket={stats.no_cache_builds} />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  aside,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-cyan">{icon}</span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SuccessCard({ pct, stats }: { pct: number; stats: ProjectStats }) {
  return (
    <div className="panel flex flex-col items-center gap-5 overflow-visible p-6 sm:flex-row sm:items-center">
      <SuccessRing pct={pct} />
      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
        <div className="text-3xl font-extrabold tabular-nums">{stats.total_builds}</div>
        <div className="font-mono text-2xs text-dim">total builds</div>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Pill tone="ok">{stats.successful_builds} passed</Pill>
          {stats.failed_builds > 0 && <Pill tone="fail">{stats.failed_builds} failed</Pill>}
        </div>
      </div>
    </div>
  );
}

function SuccessRing({ pct }: { pct: number }) {
  const ring = 152;
  const stroke = 11;
  const bleed = 24;
  const canvas = ring + bleed * 2;
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const center = canvas / 2;

  return (
    <div
      className="relative shrink-0 overflow-visible"
      style={{ width: canvas, height: canvas }}
      aria-label={`${pct}% success rate`}
    >
      {/* glow sits inside the bleed zone so blur isn't clipped */}
      <div
        className="pointer-events-none absolute rounded-full opacity-35 blur-2xl"
        style={{
          top: bleed + stroke,
          left: bleed + stroke,
          width: ring - stroke * 2,
          height: ring - stroke * 2,
          background: `conic-gradient(from -90deg, rgb(var(--ok)) ${pct}%, transparent ${pct}%)`,
        }}
      />

      <svg
        width={canvas}
        height={canvas}
        viewBox={`0 0 ${canvas} ${canvas}`}
        className="overflow-visible"
        aria-hidden
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgb(var(--surface3))"
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgb(var(--ok))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            style={{ transition: "stroke-dasharray 700ms ease-out" }}
          />
        </g>
      </svg>

      <div
        className="absolute flex items-center justify-center"
        style={{ top: bleed, left: bleed, width: ring, height: ring }}
      >
        <div className="grid h-[68%] w-[68%] place-items-center rounded-full border border-line2/80 bg-bg2/90 shadow-[inset_0_1px_0_rgb(var(--text)/0.04)]">
          <div className="text-center">
            <div className="text-[2rem] font-extrabold leading-none tabular-nums tracking-tight">
              {pct}
              <span className="text-lg text-muted">%</span>
            </div>
            <div className="mt-1.5 font-mono text-2xs uppercase tracking-wider text-dim">
              success
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomesCard({ stats }: { stats: ProjectStats }) {
  const segments = OUTCOME_SEGMENTS.map((s) => ({
    ...s,
    count: stats[s.key],
  })).filter((s) => s.count > 0);

  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-mono">Outcomes</span>
        <span className="font-mono text-2xs text-dim">{formatPercent(stats.success_rate, 1)} pass rate</span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface3">
        {segments.map((s) => (
          <div
            key={s.key}
            className={cn("h-full min-w-[2px] transition-all", s.color)}
            style={{ width: `${(s.count / stats.total_builds) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {OUTCOME_SEGMENTS.map((s) => {
          const count = stats[s.key];
          if (count === 0) return null;
          return (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", s.color.replace(" animate-pulse", ""))} />
              <span className="text-muted">{s.label}</span>
              <span className="ml-auto font-mono font-semibold tabular-nums">{count}</span>
              <span className="w-10 text-right font-mono text-2xs text-dim">
                {Math.round((count / stats.total_builds) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityCard({ stats, activeCount }: { stats: ProjectStats; activeCount: number }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="label-mono">Activity</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-cyan/15 px-2 py-0.5 font-mono text-2xs font-semibold text-cyan">
            {activeCount} in progress
          </span>
        )}
      </div>
      <dl className="space-y-3">
        <ActivityRow
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Last build"
          value={formatDateTime(stats.last_build_at)}
          hint={timeAgo(stats.last_build_at)}
        />
        <ActivityRow
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Last success"
          value={formatDateTime(stats.last_successful_build_at)}
          hint={timeAgo(stats.last_successful_build_at)}
        />
        <ActivityRow
          icon={<Tag className="h-3.5 w-3.5" />}
          label="Latest image tag"
          value={stats.last_successful_image_tag ?? "—"}
          mono
        />
      </dl>
    </div>
  );
}

function ActivityRow({
  icon,
  label,
  value,
  hint,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-dim">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="font-mono text-2xs text-dim">{label}</dt>
        <dd className={cn("truncate text-sm font-medium", mono && "font-mono")}>{value}</dd>
        {hint && hint !== "—" && <dd className="font-mono text-2xs text-dim">{hint}</dd>}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "muted";
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="label-mono">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-extrabold tabular-nums",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "muted" && "text-muted",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 font-mono text-2xs text-dim">{hint}</div>}
    </div>
  );
}

function CacheCard({
  title,
  accent,
  bucket,
}: {
  title: string;
  accent: string;
  bucket: CacheBucketStats;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-semibold", accent)}>{title}</span>
        <span className="flex items-center gap-1.5 font-mono text-2xs text-dim">
          <Package className="h-3 w-3" />
          {bucket.count} builds
        </span>
      </div>
      {bucket.count === 0 ? (
        <p className="mt-4 font-mono text-2xs text-dim">No builds in this bucket yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini label="avg" value={formatDuration(bucket.avg_duration_seconds)} />
          <Mini label="min" value={formatDuration(bucket.min_duration_seconds)} />
          <Mini label="max" value={formatDuration(bucket.max_duration_seconds)} />
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg2 px-2 py-2.5 text-center">
      <div className="font-mono text-sm font-bold tabular-nums">{value}</div>
      <div className="font-mono text-2xs text-dim">{label}</div>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "fail" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-mono text-2xs font-semibold",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "fail" && "bg-fail/15 text-fail",
      )}
    >
      {children}
    </span>
  );
}
