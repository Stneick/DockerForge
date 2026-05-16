import { useLayoutEffect, useRef } from "react";
import { ArrowDownToLine, CheckCircle2, RotateCw, UploadCloud, X, XCircle } from "lucide-react";

import { dockerLineColor, isPlain, parseAnsi } from "@/lib/ansi";
import { usePushSession } from "@/store/pushSession";

const DEFAULT_FG = "rgb(var(--termfg))";

/** Push log terminal — renders the global push session for a specific build,
 *  with retry/close affordances. Lives inside the build's Dock as a "Push" tab. */
export function PushTerminal({ buildId }: { buildId: string }) {
  const session = usePushSession((s) => s.current);
  const retry = usePushSession((s) => s.retry);
  const close = usePushSession((s) => s.close);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isThis = session && session.buildId === buildId;
  const live = isThis && session.phase === "pushing";

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [session?.lines.length]);

  if (!isThis || !session) {
    return (
      <div className="grid h-full place-items-center bg-deep p-6 text-center font-mono text-xs text-dim">
        No push in progress. Use the Push button to send this image to a registry.
      </div>
    );
  }

  const target = `${session.repository}:${session.targetTag}`;

  return (
    <div className="flex h-full flex-col bg-deep">
      <div className="flex items-center gap-2.5 border-b border-line bg-bg2 px-3 py-2 font-mono text-2xs">
        {session.phase === "pushing" && (
          <span className="flex items-center gap-1.5 font-bold text-cyan">
            <span className="h-2 w-2 rounded-full bg-cyan animate-pulse-ring" /> PUSHING
          </span>
        )}
        {session.phase === "done" && (
          <span className="flex items-center gap-1.5 font-bold text-ok">
            <CheckCircle2 className="h-3 w-3" /> PUSHED
          </span>
        )}
        {session.phase === "error" && (
          <span className="flex items-center gap-1.5 font-bold text-fail">
            <XCircle className="h-3 w-3" /> FAILED
          </span>
        )}
        <UploadCloud className="h-3 w-3 text-dim" />
        <span className="truncate text-muted">{target}</span>
        <span className="ml-auto flex items-center gap-1">
          {session.phase === "error" && (
            <button
              onClick={() => retry()}
              className="flex items-center gap-1 rounded-md border border-cyan-dim bg-cyan/10 px-2 py-0.5 text-2xs font-semibold text-cyan transition-colors hover:bg-cyan/20"
            >
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          )}
          {(session.phase === "done" || session.phase === "error") && (
            <button
              onClick={() => close()}
              className="grid h-5 w-5 place-items-center rounded text-dim transition-colors hover:bg-surface2 hover:text-text"
              title="Close push log"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 font-mono text-xs leading-relaxed">
        {session.lines.length === 0 ? (
          <div className="py-4 text-center text-dim">{live ? "connecting…" : ""}</div>
        ) : (
          session.lines.map((l, i) => <LogLine key={i} text={l} />)
        )}
        {live && (
          <div className="flex">
            <span className="inline-block h-3.5 w-2 animate-blink bg-cyan align-middle" />
          </div>
        )}
        {session.phase === "error" && session.error && (
          <div className="mt-2 rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-fail">{session.error}</div>
        )}
      </div>

      {session.phase === "error" && (
        <div className="flex shrink-0 items-center gap-2 border-t border-line bg-bg2 px-3 py-1.5 text-2xs">
          <ArrowDownToLine className="h-3 w-3 text-dim" />
          <span className="text-muted">Retry will re-send with the same credentials.</span>
        </div>
      )}
    </div>
  );
}

function LogLine({ text }: { text: string }) {
  const segs = parseAnsi(text);
  if (isPlain(segs)) {
    const t = segs[0]?.text ?? "";
    const color = dockerLineColor(t) ?? DEFAULT_FG;
    return <div className="whitespace-pre-wrap break-all" style={{ color }}>{t || " "}</div>;
  }
  return (
    <div className="whitespace-pre-wrap break-all">
      {segs.map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color ?? DEFAULT_FG,
            fontWeight: s.bold ? 700 : undefined,
            opacity: s.dim ? 0.6 : undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
}
