import { CheckCircle2, AlertTriangle, XCircle, Info, Sparkle } from "lucide-react";

import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Skeleton";
import type { LintIssue, LintLevel } from "@/types/api";

const levelMeta: Record<LintLevel, { icon: React.ReactNode; color: string }> = {
  error: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-fail" },
  warning: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-warn" },
  info: { icon: <Info className="h-3.5 w-3.5" />, color: "text-cyan" },
  style: { icon: <Sparkle className="h-3.5 w-3.5" />, color: "text-dim" },
};

export function LintPanel({
  issues,
  loading,
  onJump,
}: {
  issues: LintIssue[];
  loading: boolean;
  onJump?: (line: number, column: number) => void;
}) {
  if (loading && issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-dim">
        <Spinner /> linting with hadolint…
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-ok">
        <CheckCircle2 className="h-4 w-4" /> No issues — hadolint is happy.
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {issues.map((issue, i) => {
        const meta = levelMeta[issue.level];
        return (
          <button
            key={`${issue.code}-${issue.line}-${i}`}
            onClick={() => onJump?.(issue.line, issue.column)}
            className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface2"
          >
            <span className={cn("mt-0.5 shrink-0", meta.color)}>{meta.icon}</span>
            <span className={cn("shrink-0 font-mono text-xs font-bold", meta.color)}>{issue.code}</span>
            <span className="min-w-0 flex-1 text-muted">{issue.message}</span>
            <span className="shrink-0 font-mono text-2xs text-dim">
              L{issue.line}:{issue.column}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function lintSummary(issues: LintIssue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning" || i.level === "style" || i.level === "info").length,
  };
}
