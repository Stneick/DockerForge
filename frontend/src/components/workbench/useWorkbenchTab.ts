import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useTabsStore, type TabKind, type WorkbenchTab } from "@/store/tabs";

interface RegisterOptions {
  kind: TabKind;
  title: string;
  status?: WorkbenchTab["status"];
  pinned?: boolean;
  /** Override the tab id (defaults to current path incl. search). */
  id?: string;
}

/**
 * Register the current route as an open Workbench tab. Pages call this so the
 * top tab bar reflects what's open — like files in an editor. Re-runs when the
 * title/status changes (e.g. a build's live status) to keep the tab in sync.
 */
export function useWorkbenchTab({ kind, title, status, pinned, id }: RegisterOptions) {
  const location = useLocation();
  const path = location.pathname + location.search;
  const tabId = id ?? path;
  const openTab = useTabsStore((s) => s.openTab);

  useEffect(() => {
    openTab({ id: tabId, kind, title, path, status, pinned });
  }, [openTab, tabId, kind, title, path, status, pinned]);
}
