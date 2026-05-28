import type { editor } from "monaco-editor";

import { cn } from "@/lib/cn";

export type DiffSummary = {
  added: number;
  removed: number;
  changed: number;
};

export function summarizeDiffChanges(changes: editor.ILineChange[] | null): DiffSummary {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const c of changes ?? []) {
    if (c.originalEndLineNumber === 0) added++;
    else if (c.modifiedEndLineNumber === 0) removed++;
    else changed++;
  }
  return { added, removed, changed };
}

export function DiffSummaryBar({ summary }: { summary: DiffSummary }) {
  const { added, removed, changed } = summary;
  const empty = added === 0 && removed === 0 && changed === 0;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-bg2/90 px-3 py-1.5 font-mono text-2xs">
      {empty ? (
        <span className="text-muted">No changes from baseline</span>
      ) : (
        <>
          <span className="text-dim">Changes</span>
          {added > 0 && <SummaryChip tone="add" label={`+${added} added`} />}
          {removed > 0 && <SummaryChip tone="remove" label={`−${removed} removed`} />}
          {changed > 0 && <SummaryChip tone="change" label={`~${changed} modified`} />}
        </>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  tone,
}: {
  label: string;
  tone: "add" | "remove" | "change";
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-semibold",
        tone === "add" && "bg-ok/15 text-ok",
        tone === "remove" && "bg-fail/15 text-fail",
        tone === "change" && "bg-warn/15 text-warn",
      )}
    >
      {label}
    </span>
  );
}
