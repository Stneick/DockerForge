import type { SupportedLanguage } from "@/types/api";

// Visual metadata for languages (logos/colors are a frontend concern; the
// backend /languages endpoint supplies display names + framework defaults).
export interface LangMeta {
  short: string; // 2-char badge label
  label: string;
  color: string; // brand-ish accent
}

export const LANGUAGE_META: Record<SupportedLanguage, LangMeta> = {
  python: { short: "Py", label: "Python", color: "#3776ab" },
  node: { short: "No", label: "Node.js", color: "#68a063" },
  go: { short: "Go", label: "Go", color: "#00add8" },
  java: { short: "Jv", label: "Java", color: "#e76f00" },
  rust: { short: "Rs", label: "Rust", color: "#dea584" },
  c: { short: "C", label: "C", color: "#5c6bc0" },
  cpp: { short: "C+", label: "C++", color: "#6a8bbd" },
};

export function langMeta(lang: SupportedLanguage | null | undefined): LangMeta | null {
  return lang ? LANGUAGE_META[lang] : null;
}
