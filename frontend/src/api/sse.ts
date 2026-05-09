// SSE reader built on fetch + ReadableStream rather than EventSource.
//
// Why not EventSource: it can't send credentials reliably cross-context and
// gives us no access to the HTTP status (we need to detect 404 = stream expired
// so we can fall back to the static logs endpoint). This reader streams the
// text/event-stream body, parses `data:` frames, and invokes onEvent per frame.

import { API_BASE } from "./http";

export interface StreamHandle {
  /** Abort the underlying fetch and stop reading. */
  close: () => void;
}

export interface StreamCallbacks<T> {
  onEvent: (data: T) => void;
  onError?: (err: StreamError) => void;
  /** Fired when the stream ends normally (server closed the connection). */
  onDone?: () => void;
}

export class StreamError extends Error {
  status?: number;
  /** True when the stream is gone (e.g. Redis TTL expired) → use static logs. */
  expired: boolean;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "StreamError";
    this.status = status;
    this.expired = status === 404 || status === 410;
  }
}

/**
 * Open an SSE connection to an API path and parse JSON `data:` frames.
 * Returns a handle whose `close()` aborts the stream.
 */
export function openEventStream<T>(
  path: string,
  { onEvent, onError, onDone }: StreamCallbacks<T>,
): StreamHandle {
  const controller = new AbortController();

  (async () => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        onError?.(new StreamError((e as Error)?.message ?? "Stream connection failed"));
      }
      return;
    }

    if (!res.ok || !res.body) {
      onError?.(new StreamError(`Stream failed (${res.status})`, res.status));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          dispatchFrame(frame, onEvent);
        }
      }
      // Flush any trailing frame.
      if (buffer.trim()) dispatchFrame(buffer, onEvent);
      onDone?.();
    } catch (e) {
      if (!controller.signal.aborted) {
        onError?.(new StreamError((e as Error)?.message ?? "Stream read error"));
      }
    }
  })();

  return { close: () => controller.abort() };
}

function dispatchFrame<T>(frame: string, onEvent: (data: T) => void) {
  // Concatenate all `data:` lines in the frame (SSE allows multiple).
  const dataLines = frame
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).replace(/^\s/, ""));
  if (dataLines.length === 0) return;
  const payload = dataLines.join("\n");
  try {
    onEvent(JSON.parse(payload) as T);
  } catch {
    /* ignore keep-alive / non-JSON frames */
  }
}
