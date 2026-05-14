// Monaco configuration for the Forge. The editor theme is derived from the live
// CSS design tokens so it restyles whenever the app theme changes (call
// reapplyMonacoTheme after applyTheme). Also: Dockerfile keyword autocomplete
// and hadolint → marker mapping.
import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, IRange } from "monaco-editor";

import type { LintIssue, LintLevel } from "@/types/api";

export const FORGE_THEME = "forge-theme";

const DOCKERFILE_INSTRUCTIONS = [
  "FROM", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV", "ADD", "COPY",
  "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL",
  "HEALTHCHECK", "SHELL", "AS",
];

let monacoRef: Monaco | null = null;
let completionsRegistered = false;

/** Read a "--token" (stored as "R G B") and return "#rrggbb" (+ optional alpha hex). */
function varHex(name: string, alpha?: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const [r, g, b] = raw.split(/\s+/).map((n) => parseInt(n, 10));
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#000000";
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}${alpha ?? ""}`;
}

function isLight(): boolean {
  return document.documentElement.dataset.light === "1";
}

/** (Re)define the editor theme from current CSS tokens. */
export function defineForgeTheme(monaco: Monaco) {
  monacoRef = monaco;
  const light = isLight();
  const rules: editor.ITokenThemeRule[] = light
    ? [
        { token: "keyword", foreground: "0e7490", fontStyle: "bold" },
        { token: "string", foreground: "15803d" },
        { token: "number", foreground: "b45309" },
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "variable", foreground: "a21caf" },
      ]
    : [
        { token: "keyword", foreground: "7dd3fc", fontStyle: "bold" },
        { token: "string", foreground: "a5e887" },
        { token: "number", foreground: "fbbf24" },
        { token: "comment", foreground: "5a7186", fontStyle: "italic" },
        { token: "variable", foreground: "e879f9" },
      ];

  monaco.editor.defineTheme(FORGE_THEME, {
    base: light ? "vs" : "vs-dark",
    inherit: true,
    rules,
    colors: {
      "editor.background": varHex("editor"),
      "editor.foreground": varHex("text"),
      "editorLineNumber.foreground": varHex("dim"),
      "editorLineNumber.activeForeground": varHex("cyan"),
      "editor.lineHighlightBackground": varHex("bg2"),
      "editor.selectionBackground": varHex("cyan", "33"),
      "editorCursor.foreground": varHex("cyan"),
      "editorIndentGuide.background1": varHex("line"),
      "editorGutter.background": varHex("editor"),
      "diffEditor.insertedTextBackground": varHex("ok", "22"),
      "diffEditor.removedTextBackground": varHex("fail", "22"),
      "diffEditor.insertedLineBackground": varHex("ok", "1a"),
      "diffEditor.removedLineBackground": varHex("fail", "1a"),
      "editorWidget.background": varHex("surface"),
      "editorWidget.border": varHex("line2"),
      "editorSuggestWidget.background": varHex("surface"),
      "editorSuggestWidget.selectedBackground": varHex("cyan", "22"),
      "editorHoverWidget.background": varHex("surface"),
      "scrollbarSlider.background": varHex("line2", "88"),
    },
  });
}

/** Re-apply the editor theme after the app theme changes. */
export function reapplyMonacoTheme() {
  if (!monacoRef) return;
  defineForgeTheme(monacoRef);
  monacoRef.editor.setTheme(FORGE_THEME);
}

/** Register Dockerfile instruction completions (idempotent). */
export function registerDockerfileCompletions(monaco: Monaco) {
  if (completionsRegistered) return;
  completionsRegistered = true;
  monaco.languages.registerCompletionItemProvider("dockerfile", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions: languages.CompletionItem[] = DOCKERFILE_INSTRUCTIONS.map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: kw + " ",
        range,
        detail: "Dockerfile instruction",
      }));
      return { suggestions };
    },
  });
}

const SEVERITY: Record<LintLevel, number> = {
  error: 8, // monaco.MarkerSeverity.Error
  warning: 4,
  info: 2,
  style: 1, // Hint
};

export function lintToMarkers(issues: LintIssue[]): editor.IMarkerData[] {
  return issues.map((issue) => ({
    severity: SEVERITY[issue.level] ?? 2,
    message: `${issue.code}: ${issue.message}`,
    startLineNumber: Math.max(1, issue.line),
    endLineNumber: Math.max(1, issue.line),
    startColumn: Math.max(1, issue.column),
    endColumn: Math.max(1, issue.column) + 1,
    source: "hadolint",
    code: issue.code,
  }));
}

export const editorBaseOptions: editor.IStandaloneEditorConstructionOptions = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 13,
  lineHeight: 21,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  renderLineHighlight: "line",
  padding: { top: 12, bottom: 12 },
  fixedOverflowWidgets: true,
  scrollbar: { verticalScrollbarSize: 9, horizontalScrollbarSize: 9 },
  tabSize: 4,
};
