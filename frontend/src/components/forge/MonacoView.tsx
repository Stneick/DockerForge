import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { DiffEditor, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

// Configure Monaco (local, slim) as a side effect when this chunk loads. Because
// the Forge is lazy-loaded, this keeps Monaco out of the initial app bundle.
import "@/lib/monacoLoader";

import {
  defineForgeTheme,
  editorBaseOptions,
  FORGE_THEME,
  lintToMarkers,
  registerDockerfileCompletions,
} from "@/lib/monaco";
import { revertAllChanges } from "@/lib/diffReview";
import { useEditorOptions } from "@/store/prefs";
import { Spinner } from "@/components/ui/Skeleton";
import type { LintIssue } from "@/types/api";
import { DiffReviewBar } from "./DiffReviewBar";
import { attachDiffReviewViewZones } from "./diffReviewViewZones";

const loadingEl = (
  <div className="flex h-full items-center justify-center bg-editor">
    <Spinner className="h-5 w-5" />
  </div>
);

function beforeMount(monaco: Monaco) {
  defineForgeTheme(monaco);
  registerDockerfileCompletions(monaco);
}

/** Single-file editable editor with hadolint markers applied to its model. */
export function CodeEditor({
  value,
  language,
  issues,
  readOnly,
  onChange,
  onReady,
}: {
  value: string;
  language: string;
  issues?: LintIssue[];
  readOnly?: boolean;
  onChange?: (v: string) => void;
  onReady?: (ed: editor.IStandaloneCodeEditor) => void;
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const prefs = useEditorOptions();

  const applyMarkers = () => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, "hadolint", issues ? lintToMarkers(issues) : []);
  };

  useEffect(applyMarkers, [issues]);

  return (
    <Editor
      language={language}
      theme={FORGE_THEME}
      value={value}
      beforeMount={beforeMount}
      onMount={(ed, monaco) => {
        editorRef.current = ed;
        monacoRef.current = monaco;
        applyMarkers();
        onReady?.(ed);
      }}
      onChange={(v) => onChange?.(v ?? "")}
      loading={loadingEl}
      options={{ ...editorBaseOptions, ...prefs, readOnly }}
    />
  );
}

/** Diff editor: read-only original vs (optionally editable) modified. */
export function CodeDiff({
  original,
  modified,
  language,
  sideBySide,
  modifiedEditable,
  issues,
  onChange,
  onKeepAll,
  showReviewActions = true,
}: {
  original: string;
  modified: string;
  language: string;
  sideBySide: boolean;
  modifiedEditable?: boolean;
  issues?: LintIssue[];
  onChange?: (v: string) => void;
  /** Called when the user keeps all changes (e.g. exit diff review). */
  onKeepAll?: () => void;
  showReviewActions?: boolean;
}) {
  const diffRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const detachZonesRef = useRef<{
    dispose: () => void;
    clearDismissed: () => void;
    acceptAll: () => void;
  } | null>(null);
  const prefs = useEditorOptions();
  const [changeCount, setChangeCount] = useState(0);

  const reviewEnabled = showReviewActions && !!modifiedEditable;

  const syncChangeCount = useCallback(() => {
    const diff = diffRef.current;
    if (!diff) return;
    setChangeCount(diff.getLineChanges()?.length ?? 0);
  }, []);

  const applyMarkers = () => {
    const diff = diffRef.current;
    const monaco = monacoRef.current;
    if (!diff || !monaco) return;
    const model = diff.getModel()?.modified;
    if (!model) return;
    monaco.editor.setModelMarkers(model, "hadolint", issues ? lintToMarkers(issues) : []);
  };

  useEffect(applyMarkers, [issues]);

  useEffect(() => {
    return () => detachZonesRef.current?.dispose();
  }, []);

  const handleUndoAll = () => {
    const diff = diffRef.current;
    if (!diff) return;
    const next = revertAllChanges(diff);
    detachZonesRef.current?.clearDismissed();
    if (next != null) onChange?.(next);
    syncChangeCount();
  };

  const handleKeepAll = () => {
    detachZonesRef.current?.acceptAll();
    onKeepAll?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {reviewEnabled && (
        <DiffReviewBar
          changeCount={changeCount}
          onUndoAll={handleUndoAll}
          onKeepAll={handleKeepAll}
        />
      )}
      <div className="relative min-h-0 flex-1">
        <DiffEditor
          language={language}
          theme={FORGE_THEME}
          original={original}
          modified={modified}
          beforeMount={beforeMount}
          onMount={(diff, monaco) => {
            diffRef.current = diff;
            monacoRef.current = monaco;
            applyMarkers();
            syncChangeCount();

            if (reviewEnabled) {
              detachZonesRef.current?.dispose();
              const zones = attachDiffReviewViewZones(diff, monaco, () => {
                onChange?.(diff.getModifiedEditor().getValue());
                syncChangeCount();
              });
              const diffListener = diff.onDidUpdateDiff(syncChangeCount);
              detachZonesRef.current = {
                ...zones,
                dispose: () => {
                  zones.dispose();
                  diffListener.dispose();
                },
              };
            }

            if (onChange) {
              diff.getModifiedEditor().onDidChangeModelContent(() => {
                onChange(diff.getModifiedEditor().getValue());
              });
            }
          }}
          loading={loadingEl}
          options={{
            ...editorBaseOptions,
            ...prefs,
            renderIndicators: true,
            renderSideBySide: sideBySide,
            useInlineViewWhenSpaceIsLimited: true,
            readOnly: !modifiedEditable,
            originalEditable: false,
            enableSplitViewResizing: true,
          }}
        />
      </div>
    </div>
  );
}
