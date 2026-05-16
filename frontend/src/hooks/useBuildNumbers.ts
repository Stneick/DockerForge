import { useMemo } from "react";

import { useBuilds } from "@/api/hooks";

// Builds have UUIDs, not sequential numbers — but the list is ordered newest
// first (created_at desc), so a build's number is total_items minus its index.
// We fetch the newest 100 (one cached query) to map id → number; older builds
// beyond that fall back to their short hash.
export function useBuildNumbers(projectId: string) {
  const { data } = useBuilds(projectId, { per_page: 100 }, { enabled: !!projectId });

  return useMemo(() => {
    const map = new Map<string, number>();
    const total = data?.pagination.total_items ?? 0;
    data?.items.forEach((b, i) => map.set(b.id, total - i));
    return {
      total,
      numberOf: (id: string) => map.get(id),
      /** "#8" when known, otherwise null. */
      label: (id: string) => {
        const n = map.get(id);
        return n != null ? `#${n}` : null;
      },
    };
  }, [data]);
}
