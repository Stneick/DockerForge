import type { ListBuildsParams } from "./builds";
import type { ListProjectsParams } from "./projects";

/** Centralized React Query keys so invalidation stays consistent. */
export const qk = {
  me: ["me"] as const,
  languages: ["languages"] as const,
  settings: ["settings"] as const,

  projects: (params?: ListProjectsParams) =>
    params ? (["projects", params] as const) : (["projects"] as const),
  project: (id: string) => ["project", id] as const,
  projectStats: (id: string) => ["project", id, "stats"] as const,

  builds: (pid: string, params?: ListBuildsParams) =>
    params ? (["builds", pid, params] as const) : (["builds", pid] as const),
  build: (pid: string, bid: string) => ["build", pid, bid] as const,
  buildLogs: (pid: string, bid: string) => ["build", pid, bid, "logs"] as const,
  compare: (pid: string, a: string, b: string) => ["compare", pid, a, b] as const,
};
