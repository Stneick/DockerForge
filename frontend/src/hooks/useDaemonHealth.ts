import { useHealthStore } from "@/store/health";
import type { DaemonHealth } from "@/store/health";

/** Current Docker daemon health, inferred from API traffic. */
export function useDaemonHealth(): DaemonHealth {
  return useHealthStore((s) => s.daemon);
}
