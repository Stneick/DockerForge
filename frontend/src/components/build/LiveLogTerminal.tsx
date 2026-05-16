import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownToLine, TerminalSquare } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatElapsed } from "@/lib/format";
import { dockerLineColor, isPlain, parseAnsi } from "@/lib/ansi";
import type { BuildStatus, LogEntry } from "@/types/api";
import type { StreamPhase } from "@/hooks/useBuildStream";

const DEFAULT_FG = "rgb(var(--termfg))";

/** One log line: ANSI colors if present, else content-based Docker coloring. */
function LogLine({ entry }: { entry: LogEntry }) {
  const segments = parseAnsi(entry.message ?? "");
  const stderr = entry.stream === "stderr";

  if (isPlain(segments)) {
    const text = segments[0]?.text ?? "";
    const color = stderr ? "#f87171" : (dockerLineColor(text) ?? DEFAULT_FG);
    return <span style={{ color }}>{text || " "}</span>;
  }

  return (
    <span>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            color: seg.color ?? (stderr ? "#f87171" : DEFAULT_FG),
            fontWeight: seg.bold ? 700 : undefined,
            opacity: seg.dim ? 0.6 : undefined,
          }}
        >
          {seg.text}
        </span>
      ))}
    </span>
  );
}

export function LiveLogTerminal({
  logs,
  status,
  phase,
  startedAt,
  finishedAt,
  embedded,
}: {
  logs: LogEntry[];
  status: BuildStatus | null;
  phase: StreamPhase;
  startedAt: string | null;
  finishedAt: string | null;
  embedded?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true); // auto-follow bottom
  const live = status === "building" || status === "pending" || phase === "streaming";

  // Auto-scroll to bottom while following.
  useLayoutEffect(() => {
    if (stuck && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, stuck]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStuck(nearBottom);
  };

  // Tick elapsed while live.
  const [, force] = useState(0);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden bg-deep", !embedded && "rounded-xl border border-line")}>
      <div className="flex items-center gap-2.5 border-b border-line bg-bg2 px-3 py-2">
        <TerminalSquare className="h-4 w-4 text-dim" />
        {live ? (
          <span className="flex items-center gap-2 font-mono text-2xs font-bold text-cyan">
            <span className="h-2 w-2 rounded-full bg-cyan animate-pulse-ring" /> LIVE
          </span>
        ) : (
          <span className="font-mono text-2xs font-semibold uppercase text-dim">
            {phase === "static" ? "stored logs" : "logs"}
          </span>
        )}
        <span className="font-mono text-2xs text-dim">{logs.length} lines</span>
        <span className="ml-auto font-mono text-2xs text-cyan">
          ⏱ {formatElapsed(startedAt, live ? null : finishedAt)}
        </span>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <div className="py-6 text-center text-dim">
            {live ? "waiting for output…" : "no logs"}
          </div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex gap-3 whitespace-pre-wrap break-all">
              <span className="w-9 shrink-0 select-none text-right text-[#2f3f4d]">{l.line || i + 1}</span>
              <span className="flex-1">
                <LogLine entry={l} />
              </span>
            </div>
          ))
        )}
        {live && (
          <div className="flex gap-3">
            <span className="w-9 shrink-0" />
            <span className="inline-block h-3.5 w-2 animate-blink bg-cyan align-middle" />
          </div>
        )}
      </div>

      {!stuck && (
        <button
          onClick={() => setStuck(true)}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-cyan-dim bg-surface2/90 px-3 py-1.5 font-mono text-2xs text-cyan shadow-lg backdrop-blur transition-colors hover:bg-surface3"
        >
          <ArrowDownToLine className="h-3 w-3" /> follow
        </button>
      )}
    </div>
  );
}
