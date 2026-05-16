import { useEffect, useRef, useState } from "react";

import { buildsApi } from "@/api/builds";
import { openEventStream, StreamError } from "@/api/sse";
import type { BuildStatus, BuildStreamEvent, LogEntry } from "@/types/api";

export type StreamPhase = "connecting" | "streaming" | "done" | "static" | "error";

interface UseBuildStreamResult {
  logs: LogEntry[];
  status: BuildStatus | null;
  phase: StreamPhase;
  error: string | null;
}

const TERMINAL: BuildStatus[] = ["success", "failed", "cancelled"];

// Normalize a streamed log into a complete LogEntry. The backend should send
// {line, message, stream, timestamp}, but we tolerate a bare string or missing
// fields so a malformed frame never crashes the terminal.
function normalizeLog(raw: unknown, fallbackLine: number): LogEntry {
  if (typeof raw === "string") {
    return { line: fallbackLine, message: raw, stream: "stdout", timestamp: new Date().toISOString() };
  }
  const o = (raw ?? {}) as Partial<LogEntry>;
  return {
    line: typeof o.line === "number" ? o.line : fallbackLine,
    message: o.message ?? "",
    stream: o.stream === "stderr" ? "stderr" : "stdout",
    timestamp: o.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Stream a build's logs.
 *
 * - For active builds: connects to the SSE events endpoint, which replays prior
 *   lines then streams live until a terminal status arrives.
 * - If the stream is unavailable/expired (404/410) or the build is already
 *   terminal, falls back to the static logs endpoint.
 */
export function useBuildStream(
  projectId: string,
  buildId: string,
  initialStatus: BuildStatus | undefined,
): UseBuildStreamResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<BuildStatus | null>(initialStatus ?? null);
  const [phase, setPhase] = useState<StreamPhase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const lineRef = useRef(0);

  useEffect(() => {
    let active = true;
    setLogs([]);
    setError(null);
    lineRef.current = 0;

    const loadStatic = async (reason?: string) => {
      try {
        const res = await buildsApi.logs(projectId, buildId);
        if (!active) return;
        setLogs(res.logs);
        setStatus(res.status);
        setPhase("static");
        if (reason) setError(reason);
      } catch {
        if (active) {
          setPhase("error");
          setError("Could not load logs.");
        }
      }
    };

    // Already finished before we mounted → just fetch the stored logs.
    if (initialStatus && TERMINAL.includes(initialStatus)) {
      void loadStatic();
      return () => {
        active = false;
      };
    }

    setPhase("connecting");
    const handle = openEventStream<BuildStreamEvent>(
      buildsApi.eventsPath(projectId, buildId),
      {
        onEvent: (evt) => {
          if (!active) return;
          setPhase("streaming");
          if (evt.status) setStatus(evt.status);
          if (evt.log) {
            const log = normalizeLog(evt.log, lineRef.current + 1);
            setLogs((prev) => [...prev, log]);
            lineRef.current = Math.max(lineRef.current, log.line);
          }
          if (evt.status && TERMINAL.includes(evt.status)) {
            setPhase("done");
            handle.close();
          }
        },
        onError: (err) => {
          if (!active) return;
          // Stream gone (expired/not found) → fall back to whatever's stored.
          if (err instanceof StreamError && err.expired) {
            void loadStatic();
          } else {
            void loadStatic("Live stream interrupted — showing stored logs.");
          }
        },
        onDone: () => {
          if (active && phase === "streaming") setPhase("done");
        },
      },
    );

    return () => {
      active = false;
      handle.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, buildId]);

  return { logs, status, phase, error };
}
