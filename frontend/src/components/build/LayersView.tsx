import { Layers } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatBytes, prettyInstruction } from "@/lib/format";
import { EmptyState } from "@/components/ui/misc";
import type { ImageLayer } from "@/types/api";

// Color the instruction keyword so the layer list reads at a glance.
function keywordOf(instruction: string): string {
  return instruction.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
}
const KEYWORD_COLOR: Record<string, string> = {
  FROM: "text-docker",
  RUN: "text-cyan",
  COPY: "text-ok",
  ADD: "text-ok",
  CMD: "text-warn",
  ENTRYPOINT: "text-warn",
  ENV: "text-[#e879f9]",
  WORKDIR: "text-muted",
  EXPOSE: "text-warn",
};

export function LayersView({ layers }: { layers: ImageLayer[] | null }) {
  if (!layers || layers.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-6 w-6" />}
        title="No layer data"
        description="Layer breakdown is available for successful builds whose image hasn't been cleaned up."
      />
    );
  }

  const max = Math.max(...layers.map((l) => l.size_bytes), 1);
  const total = layers.reduce((s, l) => s + l.size_bytes, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{layers.length} layers</span>
        <span className="font-mono text-cyan">{formatBytes(total)} total</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        {layers.map((layer, i) => {
          const pretty = prettyInstruction(layer.instruction);
          const kw = keywordOf(pretty);
          const pct = (layer.size_bytes / max) * 100;
          const heavy = layer.size_bytes >= max * 0.66;
          return (
            <div key={i} className={cn("px-3 py-2.5", i > 0 && "border-t border-line")}>
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-right font-mono text-2xs text-dim">{i + 1}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  <span className={cn("font-bold", KEYWORD_COLOR[kw] ?? "text-muted")}>{kw}</span>
                  <span className="text-[#aab8c5]">{pretty.slice(kw.length)}</span>
                </code>
                <span className={cn("shrink-0 font-mono text-2xs", heavy ? "text-warn" : "text-dim")}>
                  {layer.size_human || formatBytes(layer.size_bytes)}
                </span>
              </div>
              <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg2">
                <div
                  className={cn(
                    "h-full rounded-full",
                    heavy ? "bg-gradient-to-r from-warn to-[#a87a12]" : "bg-gradient-to-r from-cyan to-cyan-dim",
                  )}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
