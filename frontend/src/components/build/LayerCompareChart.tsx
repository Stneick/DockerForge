import { cn } from "@/lib/cn";
import { formatBytes, formatBytesDelta, prettyInstruction } from "@/lib/format";
import type { LayerComparison, LayerDiffStatus } from "@/types/api";

const STATUS_META: Record<LayerDiffStatus, { label: string; color: string; dot: string }> = {
  unchanged: { label: "unchanged", color: "text-dim", dot: "bg-line2" },
  changed: { label: "changed", color: "text-warn", dot: "bg-warn" },
  added: { label: "added in B", color: "text-ok", dot: "bg-ok" },
  removed: { label: "removed in B", color: "text-fail", dot: "bg-fail" },
};

/** Dual horizontal bars per layer: build A (cyan) vs build B (docker-blue). */
export function LayerCompareChart({ layers }: { layers: LayerComparison[] }) {
  const max = Math.max(1, ...layers.flatMap((l) => [l.size_a ?? 0, l.size_b ?? 0]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-2xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-cyan" /> Build A</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-docker" /> Build B</span>
        <span className="ml-auto font-mono">{layers.length} layers compared</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        {layers.map((layer, i) => {
          const meta = STATUS_META[layer.status];
          const pretty = prettyInstruction(layer.instruction);
          return (
            <div key={i} className={cn("px-3 py-2.5", i > 0 && "border-t border-line")}>
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-[#aab8c5]">{pretty}</code>
                <span className={cn("shrink-0 font-mono text-2xs font-semibold", meta.color)}>
                  {layer.status === "unchanged"
                    ? formatBytes(layer.size_a)
                    : formatBytesDelta(layer.diff_bytes)}
                </span>
              </div>
              <div className="ml-3.5 mt-1.5 space-y-1">
                <Bar value={layer.size_a} max={max} color="bg-cyan" />
                <Bar value={layer.size_b} max={max} color="bg-docker" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ value, max, color }: { value: number | null; max: number; color: string }) {
  const pct = value != null ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg2">
        {value != null && (
          <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(pct, value ? 2 : 0)}%` }} />
        )}
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[10px] text-dim">
        {value != null ? formatBytes(value) : "—"}
      </span>
    </div>
  );
}
