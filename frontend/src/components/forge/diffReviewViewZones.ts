import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

import { revertLineChange } from "@/lib/diffReview";

const BAR_HEIGHT = 22;

function changeKey(change: editor.ILineChange): string {
  return [
    change.originalStartLineNumber,
    change.originalEndLineNumber,
    change.modifiedStartLineNumber,
    change.modifiedEndLineNumber,
  ].join(":");
}

function hunkAnchorLine(change: editor.ILineChange): number {
  if (change.modifiedStartLineNumber > 0) return change.modifiedStartLineNumber;
  return Math.max(1, change.originalStartLineNumber);
}

function buildHunkBar(
  diff: editor.IStandaloneDiffEditor,
  change: editor.ILineChange,
  dismissed: Set<string>,
  onUpdate: () => void,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "df-diff-hunk-bar";

  const actions = document.createElement("div");
  actions.className = "df-diff-hunk-bar-actions";

  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "df-diff-hunk-action df-diff-hunk-action--accept";
  accept.textContent = "Accept Change";
  accept.title = "Keep this change";

  const sep = document.createElement("span");
  sep.className = "df-diff-hunk-sep";
  sep.textContent = "|";
  sep.setAttribute("aria-hidden", "true");

  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "df-diff-hunk-action";
  undo.textContent = "Undo Change";
  undo.title = "Revert this change to baseline";

  const onAccept = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    dismissed.add(changeKey(change));
    onUpdate();
  };

  const onUndo = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    revertLineChange(diff, change);
    dismissed.delete(changeKey(change));
    onUpdate();
  };

  accept.addEventListener("mousedown", onAccept);
  accept.addEventListener("click", onAccept);
  undo.addEventListener("mousedown", onUndo);
  undo.addEventListener("click", onUndo);

  actions.append(accept, sep, undo);
  bar.append(actions);
  return bar;
}

type HunkEntry = {
  zoneId: string;
  overlay: editor.IOverlayWidget;
  bar: HTMLElement;
  top: number;
};

function layoutBar(modifiedEd: editor.IStandaloneCodeEditor, bar: HTMLElement, top: number) {
  const { contentWidth, contentLeft } = modifiedEd.getLayoutInfo();
  bar.style.position = "absolute";
  bar.style.top = `${top}px`;
  bar.style.left = `${contentLeft}px`;
  bar.style.width = `${contentWidth}px`;
  bar.style.height = `${BAR_HEIGHT}px`;
  bar.style.zIndex = "11";
  bar.style.pointerEvents = "auto";
}

/** Spacer view zones + overlay widgets (view-zone DOM is under the text layer and not clickable). */
export function attachDiffReviewViewZones(
  diff: editor.IStandaloneDiffEditor,
  _monaco: Monaco,
  onChange?: () => void,
): { dispose: () => void; clearDismissed: () => void; acceptAll: () => void } {
  const modifiedEd = diff.getModifiedEditor();
  const dismissed = new Set<string>();
  const entries: HunkEntry[] = [];
  let syncPending = false;

  const relayoutAll = () => {
    for (const entry of entries) {
      layoutBar(modifiedEd, entry.bar, entry.top);
    }
  };

  const sync = () => {
    modifiedEd.changeViewZones((accessor) => {
      for (const entry of entries) {
        accessor.removeZone(entry.zoneId);
        modifiedEd.removeOverlayWidget(entry.overlay);
      }
      entries.length = 0;

      const changes = diff.getLineChanges();
      if (!changes?.length) return;

      for (const change of changes) {
        if (dismissed.has(changeKey(change))) continue;

        const line = hunkAnchorLine(change);
        const bar = buildHunkBar(diff, change, dismissed, () => {
          onChange?.();
          scheduleSync();
        });

        const overlay: editor.IOverlayWidget = {
          getId: () => `df-diff-overlay-${entries.length}`,
          getDomNode: () => bar,
          getPosition: () => null,
        };
        modifiedEd.addOverlayWidget(overlay);

        const entry: HunkEntry = { zoneId: "", overlay, bar, top: -10000 };
        entry.zoneId = accessor.addZone({
          afterLineNumber: Math.max(0, line - 1),
          heightInPx: BAR_HEIGHT,
          domNode: document.createElement("div"),
          onDomNodeTop: (top) => {
            entry.top = top;
            layoutBar(modifiedEd, bar, top);
          },
          onComputedHeight: (height) => {
            bar.style.height = `${height}px`;
          },
        });
        entries.push(entry);
      }
    });
  };

  const scheduleSync = () => {
    if (syncPending) return;
    syncPending = true;
    requestAnimationFrame(() => {
      syncPending = false;
      sync();
    });
  };

  const d1 = diff.onDidUpdateDiff(scheduleSync);
  const d2 = modifiedEd.onDidChangeModelContent(scheduleSync);
  const d3 = modifiedEd.onDidLayoutChange(relayoutAll);
  sync();

  return {
    clearDismissed: () => dismissed.clear(),
    acceptAll: () => {
      for (const change of diff.getLineChanges() ?? []) {
        dismissed.add(changeKey(change));
      }
      scheduleSync();
    },
    dispose: () => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      dismissed.clear();
      for (const entry of entries) {
        modifiedEd.removeOverlayWidget(entry.overlay);
      }
      modifiedEd.changeViewZones((accessor) => {
        for (const entry of entries) {
          accessor.removeZone(entry.zoneId);
        }
      });
      entries.length = 0;
    },
  };
}
