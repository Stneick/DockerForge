import { useNavigate } from "react-router-dom";
import * as Ctx from "@radix-ui/react-context-menu";
import { GitCompare, ExternalLink, RotateCw, Ban, Copy, ChevronRight } from "lucide-react";

import { useBuilds, useCancelBuild, useRetryBuild } from "@/api/hooks";
import { useBuildNumbers } from "@/hooks/useBuildNumbers";
import { ApiError } from "@/api/http";
import { cn } from "@/lib/cn";
import { shortId } from "@/lib/format";
import { StatusDot } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import type { Build } from "@/types/api";

const itemCls =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text outline-none transition-colors data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan data-[disabled]:opacity-40";

/** Right-click menu for a build: open, compare against another, retry, etc. */
export function BuildContextMenu({
  projectId,
  build,
  children,
}: {
  projectId: string;
  build: Build;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const retry = useRetryBuild(projectId);
  const cancel = useCancelBuild(projectId);
  const { data } = useBuilds(projectId, { per_page: 50 });
  const numbers = useBuildNumbers(projectId);

  const active = build.status === "pending" || build.status === "building";
  const candidates = (data?.items ?? []).filter((b) => b.id !== build.id);
  const canCompare = candidates.length > 0;

  const label = (id: string) => numbers.label(id) ?? shortId(id);

  const onRetry = () =>
    retry.mutate(build.id, {
      onSuccess: (b) => {
        toast.success("Re-running build");
        navigate(`/projects/${projectId}/builds/${b.id}`);
      },
      onError: (e) => toast.error("Retry failed", e instanceof ApiError ? e.message : undefined),
    });

  return (
    <Ctx.Root>
      <Ctx.Trigger asChild>{children}</Ctx.Trigger>
      <Ctx.Portal>
        <Ctx.Content className="z-50 w-52 overflow-hidden rounded-lg border border-line2 bg-surface2 p-1 shadow-xl animate-fade-in">
          <div className="px-2.5 py-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <StatusDot status={build.status} /> Build {label(build.id)}
            </div>
            <div className="mt-0.5 font-mono text-2xs text-dim">{shortId(build.id)}</div>
          </div>
          <Ctx.Separator className="my-1 h-px bg-line" />

          <Ctx.Item className={itemCls} onSelect={() => navigate(`/projects/${projectId}/builds/${build.id}`)}>
            <ExternalLink className="h-4 w-4" /> Open build
          </Ctx.Item>

          {/* Compare with ▸ */}
          <Ctx.Sub>
            <Ctx.SubTrigger className={itemCls} disabled={!canCompare || candidates.length === 0}>
              <GitCompare className="h-4 w-4" /> Compare with
              <ChevronRight className="ml-auto h-3.5 w-3.5" />
            </Ctx.SubTrigger>
            <Ctx.Portal>
              <Ctx.SubContent className="z-50 max-h-72 w-48 overflow-y-auto rounded-lg border border-line2 bg-surface2 p-1 shadow-xl animate-fade-in">
                {candidates.length === 0 ? (
                  <div className="px-2.5 py-2 text-2xs text-dim">No other builds</div>
                ) : (
                  candidates.map((other) => (
                    <Ctx.Item
                      key={other.id}
                      className={cn(itemCls, "font-mono text-xs")}
                      onSelect={() =>
                        navigate(`/projects/${projectId}/builds/compare?a=${build.id}&b=${other.id}`)
                      }
                    >
                      <StatusDot status={other.status} />
                      {label(other.id)}
                      <span className="ml-auto text-dim">{shortId(other.id)}</span>
                    </Ctx.Item>
                  ))
                )}
              </Ctx.SubContent>
            </Ctx.Portal>
          </Ctx.Sub>

          <Ctx.Item className={itemCls} onSelect={onRetry}>
            <RotateCw className="h-4 w-4" /> Retry build
          </Ctx.Item>

          {active && (
            <Ctx.Item
              className={itemCls}
              onSelect={() =>
                cancel.mutate(build.id, {
                  onSuccess: () => toast.info("Cancelling build…"),
                  onError: (e) => toast.error("Cancel failed", e instanceof ApiError ? e.message : undefined),
                })
              }
            >
              <Ban className="h-4 w-4" /> Cancel build
            </Ctx.Item>
          )}

          <Ctx.Separator className="my-1 h-px bg-line" />
          <Ctx.Item
            className={itemCls}
            onSelect={() => {
              void navigator.clipboard?.writeText(build.id);
              toast.success("Build ID copied");
            }}
          >
            <Copy className="h-4 w-4" /> Copy build ID
          </Ctx.Item>
        </Ctx.Content>
      </Ctx.Portal>
    </Ctx.Root>
  );
}
