import { useMemo } from "react";
import { useQueries, type Query } from "@tanstack/react-query";

import { buildsApi } from "@/api/builds";
import { qk } from "@/api/queryKeys";
import type { Build, BuildListResponse, BuildStatus } from "@/types/api";

const EXPLORER_BUILDS_PARAMS = { per_page: 8 } as const;
const ACTIVE: BuildStatus[] = ["pending", "building"];
const POLL_MS = 3_000;

function hasActiveBuilds(items: Build[] | undefined): boolean {
  return items?.some((b) => ACTIVE.includes(b.status)) ?? false;
}

export type ExplorerBuildsEntry = {
  /** `null` while the initial fetch is in flight; otherwise the latest builds. */
  items: Build[] | null;
  label: (id: string) => string | undefined;
};

/** Recent builds for every project shown in the Explorer sidebar. */
export function useExplorerBuilds(projectIds: string[]) {
  const results = useQueries({
    queries: projectIds.map((pid) => ({
      queryKey: qk.builds(pid, EXPLORER_BUILDS_PARAMS),
      queryFn: () => buildsApi.list(pid, EXPLORER_BUILDS_PARAMS),
      enabled: !!pid,
      refetchInterval: (query: Query<BuildListResponse>) =>
        hasActiveBuilds(query.state.data?.items) ? POLL_MS : false,
    })),
  });

  return useMemo(() => {
    const map = new Map<string, ExplorerBuildsEntry>();
    projectIds.forEach((pid, i) => {
      const q = results[i];
      if (!q) return;

      const list = q.data?.items ?? [];
      const total = q.data?.pagination.total_items ?? 0;
      map.set(pid, {
        items: q.isPending ? null : list,
        label: (id: string) => {
          const idx = list.findIndex((b) => b.id === id);
          return idx === -1 ? undefined : `#${total - idx}`;
        },
      });
    });
    return map;
  }, [projectIds, results]);
}
