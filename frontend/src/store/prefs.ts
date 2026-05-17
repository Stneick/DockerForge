import { create } from "zustand";

import { applyTheme, loadThemeId } from "@/lib/themes";
import { reapplyMonacoTheme } from "@/lib/monaco";

export interface EditorPrefs {
  fontSize: number;
  fontFamily: string;
  wordWrap: boolean;
  minimap: boolean;
}

interface PrefsState {
  themeId: string;
  editor: EditorPrefs;
  setTheme: (id: string) => void;
  setEditor: (patch: Partial<EditorPrefs>) => void;
}

const EDITOR_KEY = "df.editor";
const DEFAULT_EDITOR: EditorPrefs = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  wordWrap: false,
  minimap: false,
};

function loadEditor(): EditorPrefs {
  try {
    return { ...DEFAULT_EDITOR, ...JSON.parse(localStorage.getItem(EDITOR_KEY) ?? "{}") };
  } catch {
    return DEFAULT_EDITOR;
  }
}

function saveEditor(e: EditorPrefs) {
  try {
    localStorage.setItem(EDITOR_KEY, JSON.stringify(e));
  } catch {
    /* ignore */
  }
}

export const usePrefs = create<PrefsState>((set, get) => ({
  themeId: loadThemeId(),
  editor: loadEditor(),
  setTheme: (id) => {
    applyTheme(id); // writes CSS vars + persists
    reapplyMonacoTheme(); // restyle any open editor
    set({ themeId: id });
  },
  setEditor: (patch) => {
    const editor = { ...get().editor, ...patch };
    saveEditor(editor);
    set({ editor });
  },
}));

/** Editor prefs as Monaco options (font/wrap/minimap). */
export function useEditorOptions() {
  const e = usePrefs((s) => s.editor);
  return {
    fontSize: e.fontSize,
    fontFamily: e.fontFamily,
    wordWrap: e.wordWrap ? ("on" as const) : ("off" as const),
    minimap: { enabled: e.minimap },
  };
}
