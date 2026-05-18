// Make Monaco fully self-contained AND slim: bundle only the editor core + the
// Dockerfile language from the local `monaco-editor` package, instead of
// @monaco-editor/react's default CDN fetch (which pulls the full editor with
// every language). This is a self-hosted tool that may run without internet.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
// Dockerfile tokenization/coloring (basic-languages contribution). plaintext is built in.
import "monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution";
// Diff editor UI (gutter indicators, inline deleted blocks, view-zone styling).
import "monaco-editor/esm/vs/editor/browser/widget/diffEditor/diffEditor.contribution.js";
import "monaco-editor/esm/vs/editor/browser/widget/diffEditor/style.css";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

(globalThis as unknown as { MonacoEnvironment: { getWorker: () => Worker } }).MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

loader.config({ monaco });
