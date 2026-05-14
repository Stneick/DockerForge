import { useEffect, useRef } from "react";
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
import { useEditorOptions } from "@/store/prefs";
import { Spinner } from "@/components/ui/Skeleton";
import type { LintIssue } from "@/types/api";

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
}: {
  original: string;
  modified: string;
  language: string;
  sideBySide: boolean;
  modifiedEditable?: boolean;
  issues?: LintIssue[];
  onChange?: (v: string) => void;
}) {
  const diffRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const prefs = useEditorOptions();

  const applyMarkers = () => {
    const diff = diffRef.current;
    const monaco = monacoRef.current;
    if (!diff || !monaco) return;
    const model = diff.getModel()?.modified;
    if (!model) return;
    monaco.editor.setModelMarkers(model, "hadolint", issues ? lintToMarkers(issues) : []);
  };

  useEffect(applyMarkers, [issues]);

  return (
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
        renderSideBySide: sideBySide,
        readOnly: !modifiedEditable,
        originalEditable: false,
        enableSplitViewResizing: true,
      }}
    />
  );
}
