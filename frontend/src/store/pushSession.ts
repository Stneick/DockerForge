import { create } from "zustand";

import { buildsApi } from "@/api/builds";
import { ApiError } from "@/api/http";
import { openEventStream, StreamError, type StreamHandle } from "@/api/sse";
import type { PushStreamEvent } from "@/types/api";

type Phase = "pushing" | "done" | "error";

export interface PushArgs {
  projectId: string;
  buildId: string;
  repository: string;
  targetTag: string;
  username: string;
  password: string;
}

export interface PushSession extends PushArgs {
  phase: Phase;
  lines: string[];
  error?: string;
  startedAt: number;
}

interface PushState {
  current: PushSession | null;
  /** Active SSE handle — never exposed; the store manages lifecycle. */
  handle: StreamHandle | null;
  start: (args: PushArgs) => void;
  retry: () => void;
  close: () => void;
}

/**
 * Global push session — one active push at a time, decoupled from any modal so
 * it survives navigating away and so retry has a clean lifecycle (abort old
 * stream, fresh request, fresh SSE).
 */
export const usePushSession = create<PushState>((set, get) => {
  const append = (line: string) =>
    set((s) => (s.current ? { current: { ...s.current, lines: [...s.current.lines, line] } } : s));

  const setPhase = (phase: Phase, patch: Partial<PushSession> = {}) =>
    set((s) => (s.current ? { current: { ...s.current, phase, ...patch } } : s));

  const closeHandle = () => {
    const h = get().handle;
    if (h) {
      h.close();
      set({ handle: null });
    }
  };

  const openStream = (args: PushArgs) => {
    const handle = openEventStream<PushStreamEvent>(
      buildsApi.pushEventsPath(args.projectId, args.buildId),
      {
        onEvent: (evt) => {
          const text = evt.error ?? evt.message ?? evt.status;
          if (text) append(String(text));
          if (evt.error) {
            setPhase("error", { error: String(evt.error) });
            closeHandle();
          } else if (evt.dockerforge_status) {
            const ok = evt.dockerforge_status === "success";
            setPhase(ok ? "done" : "error", ok ? {} : { error: "Push failed" });
            closeHandle();
          }
        },
        onError: (e) => {
          setPhase("error", { error: e instanceof StreamError ? e.message : "Push stream interrupted" });
          set({ handle: null });
        },
      },
    );
    set({ handle });
  };

  const startInternal = async (args: PushArgs) => {
    closeHandle(); // abort any prior stream before starting fresh
    set({
      current: { ...args, phase: "pushing", lines: [], startedAt: Date.now() },
    });
    try {
      await buildsApi.push(args.projectId, args.buildId, {
        repository: args.repository,
        target_tag: args.targetTag,
        username: args.username,
        password: args.password,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Push failed to start";
      setPhase("error", { error: msg });
      return;
    }
    openStream(args);
  };

  return {
    current: null,
    handle: null,
    start: (args) => void startInternal(args),
    retry: () => {
      const cur = get().current;
      if (!cur) return;
      void startInternal({
        projectId: cur.projectId,
        buildId: cur.buildId,
        repository: cur.repository,
        targetTag: cur.targetTag,
        username: cur.username,
        password: cur.password,
      });
    },
    close: () => {
      closeHandle();
      set({ current: null });
    },
  };
});
