import { create } from "zustand";

export type DaemonHealth = "unknown" | "ok" | "down";

interface HealthState {
  daemon: DaemonHealth;
  setDaemon: (v: DaemonHealth) => void;
}

// Docker daemon health is inferred from API traffic: a 503 (DockerDaemonUnavailable)
// flips it "down", any success flips it "ok". Fed by the http layer (see main.tsx).
export const useHealthStore = create<HealthState>((set, get) => ({
  daemon: "unknown",
  setDaemon: (v) => {
    if (get().daemon !== v) set({ daemon: v });
  },
}));
