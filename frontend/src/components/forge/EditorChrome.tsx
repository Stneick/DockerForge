import { cn } from "@/lib/cn";

/** Top bar above Monaco — shared by Forge and read-only build Dockerfile views. */
export function EditorToolbar({
  tabs,
  right,
}: {
  tabs: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-bg2 px-2 py-1.5">
      {tabs}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function FileTab({
  active,
  onClick,
  icon,
  edited,
  children,
}: {
  active: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  edited?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-colors",
        active ? "bg-bg text-text" : "text-muted hover:bg-surface2",
        !onClick && "cursor-default",
      )}
    >
      <span className={active ? "text-cyan" : "text-dim"}>{icon}</span>
      {children}
      {edited && <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
    </button>
  );
}

export function SegBtn({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex items-center px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
        active ? "bg-cyan text-onaccent" : "text-muted hover:bg-surface2",
      )}
    >
      {children}
    </button>
  );
}
