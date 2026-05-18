import { Check, Undo2 } from "lucide-react";

import { cn } from "@/lib/cn";

export function DiffReviewBar({
  changeCount,
  onKeepAll,
  onUndoAll,
}: {
  changeCount: number;
  onKeepAll: () => void;
  onUndoAll: () => void;
}) {
  const disabled = changeCount === 0;

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-bg2/90 px-2 py-1">
      <span className="font-mono text-2xs text-muted">
        {disabled ? "No changes from baseline" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`}
      </span>
      <div className="flex overflow-hidden rounded-md border border-line2">
        <ReviewBtn disabled={disabled} onClick={onUndoAll} title="Revert all changes to baseline">
          <Undo2 className="h-3 w-3" />
          Undo All
        </ReviewBtn>
        <ReviewBtn disabled={disabled} onClick={onKeepAll} title="Accept all changes" accent>
          <Check className="h-3 w-3" />
          Accept All
        </ReviewBtn>
      </div>
    </div>
  );
}

function ReviewBtn({
  children,
  onClick,
  disabled,
  title,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1 font-mono text-2xs font-semibold transition-colors disabled:opacity-40",
        accent ? "bg-cyan text-onaccent" : "text-muted hover:bg-surface2",
      )}
    >
      {children}
    </button>
  );
}
