import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, GitCompare, Hammer, Clock, HardDrive, X } from "lucide-react";

import { useBuilds } from "@/api/hooks";
import { cn } from "@/lib/cn";
import { formatDuration, shortId, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/Skeleton";
import { BuildContextMenu } from "@/components/build/BuildContextMenu";
import type { Build, BuildStatus } from "@/types/api";

const PER_PAGE = 15;

const STATUS_FILTERS: (BuildStatus | "all")[] = [
  "all",
  "success",
  "failed",
  "building",
  "pending",
  "cancelled",
];

export function BuildsList({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BuildStatus | "all">("all");
  const [compare, setCompare] = useState<string[]>([]);

  const { data, isLoading } = useBuilds(projectId, {
    page,
    per_page: PER_PAGE,
    status: status === "all" ? undefined : status,
  });
  // Build number = total minus the build's global (desc) index. Only exact when
  // unfiltered; with a status filter the index isn't global, so we hide numbers.
  const numbered = status === "all" && data;

  const toggleCompare = (id: string) => {
    setCompare((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : [cur[1], id],
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-2xs font-semibold uppercase tracking-wide transition-colors",
                status === s ? "bg-cyan/15 text-cyan" : "text-dim hover:bg-surface2 hover:text-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-2xs text-dim">
          {data ? `${data.pagination.total_items} builds` : ""}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-line">
            {data.items.map((b, i) => (
              <BuildContextMenu key={b.id} projectId={projectId} build={b}>
                <BuildRow
                  build={b}
                  number={numbered ? data.pagination.total_items - ((page - 1) * PER_PAGE + i) : null}
                  first={i === 0}
                  selected={compare.includes(b.id)}
                  onOpen={() => navigate(`/projects/${projectId}/builds/${b.id}`)}
                  onToggleCompare={() => toggleCompare(b.id)}
                />
              </BuildContextMenu>
            ))}
          </div>

          {data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="font-mono text-2xs text-dim">
                page {data.pagination.page} / {data.pagination.total_pages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={page >= data.pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Hammer className="h-6 w-6" />}
          title="No builds yet"
          description="Forge a Dockerfile and trigger your first build to see it here."
        />
      )}

      {/* compare tray */}
      {compare.length > 0 && (
        <div className="sticky bottom-3 flex items-center gap-3 rounded-xl border border-cyan-dim bg-surface2/95 px-4 py-2.5 shadow-dock backdrop-blur">
          <GitCompare className="h-4 w-4 text-cyan" />
          <span className="text-sm">
            {compare.length === 1 ? "Select one more build to compare" : "2 builds selected"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCompare([])}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={compare.length !== 2}
              onClick={() =>
                navigate(`/projects/${projectId}/builds/compare?a=${compare[0]}&b=${compare[1]}`)
              }
            >
              Compare →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface BuildRowProps extends React.HTMLAttributes<HTMLDivElement> {
  build: Build;
  number: number | null;
  first: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleCompare: () => void;
}

const BuildRow = forwardRef<HTMLDivElement, BuildRowProps>(
  ({ build, number, first, selected, onOpen, onToggleCompare, ...rest }, ref) => (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface2",
        !first && "border-t border-line",
        selected && "bg-cyan/[0.06]",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleCompare}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 shrink-0 cursor-pointer accent-cyan"
        title="Select to compare"
      />
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-9 shrink-0 font-mono text-xs font-bold text-text">
          {number != null ? `#${number}` : shortId(build.id)}
        </span>
        <StatusBadge status={build.status} />
        <span className="truncate font-mono text-xs text-muted">{build.image_tag ?? "—"}</span>
        {build.trigger_type === "retry" && (
          <span className="rounded bg-surface3 px-1.5 py-0.5 font-mono text-[10px] text-dim">retry</span>
        )}
        {build.no_cache && (
          <span className="rounded bg-surface3 px-1.5 py-0.5 font-mono text-[10px] text-dim">no-cache</span>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-4 font-mono text-2xs text-dim">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatDuration(build.duration_seconds)}
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <HardDrive className="h-3 w-3" />
          {build.image_cleaned_at ? "cleaned" : "—"}
        </span>
        <span className="w-16 text-right">{timeAgo(build.created_at)}</span>
      </div>
    </div>
  ),
);
BuildRow.displayName = "BuildRow";
