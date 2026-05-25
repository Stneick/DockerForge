import { useLocation } from "react-router-dom";
import { GitBranch, Search, Wifi, WifiOff } from "lucide-react";

import { useProject } from "@/api/hooks";
import { useDaemonHealth } from "@/hooks/useDaemonHealth";
import { useFilePalette } from "@/components/FilePalette";
import { MOD_KEY, formatShortcut } from "@/lib/keyboard";

// VS Code-style bottom status strip. Sells the IDE feel and surfaces global
// state (Docker daemon health, current context) at a glance.
export function StatusBar() {
  const location = useLocation();
  const setFilePalette = useFilePalette((s) => s.setOpen);
  const projectId = location.pathname.match(/\/projects\/([0-9a-f-]{36})/)?.[1];
  const { data: project } = useProject(projectId ?? "", { enabled: !!projectId });
  const daemon = useDaemonHealth();

  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-chrome px-3 font-mono text-[11px] text-dim">
      <button
        onClick={() => setFilePalette(true)}
        className="flex items-center gap-1 text-cyan transition-colors hover:text-text"
      >
        <Search className="h-3 w-3" /> dockerforge
      </button>

      {project && (
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          {project.name}
          {project.language && <span className="text-muted">· {project.language}</span>}
        </span>
      )}

      <div className="ml-auto flex items-center gap-4">
        {daemon === "down" ? (
          <span className="flex items-center gap-1 text-fail">
            <WifiOff className="h-3 w-3" /> docker daemon down
          </span>
        ) : daemon === "ok" ? (
          <span className="flex items-center gap-1 text-ok">
            <Wifi className="h-3 w-3" /> daemon ready
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3" /> connecting…
          </span>
        )}
        <span className="hidden sm:inline">{formatShortcut(MOD_KEY, "P")} quick open</span>
      </div>
    </div>
  );
}
