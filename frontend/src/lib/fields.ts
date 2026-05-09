import type { SupportedLanguage } from "@/types/api";

// Which optional config fields are meaningful for each language. Mirrors the
// backend detector + templates: Go builds a binary from a package, Rust/C/C++
// produce a binary, Vite SPAs emit a build output dir served by nginx, and
// Python/NestJS use a module entry point.
export type ConfigField =
  | "entry_point"
  | "binary_name"
  | "build_output_dir"
  | "build_package";

const RELEVANCE: Record<SupportedLanguage, ConfigField[]> = {
  python: ["entry_point"],
  node: ["entry_point", "build_output_dir"],
  go: ["binary_name", "build_package"],
  java: [],
  rust: ["binary_name"],
  c: ["binary_name"],
  cpp: ["binary_name"],
};

export function relevantFields(lang: SupportedLanguage | null | undefined): ConfigField[] {
  return lang ? RELEVANCE[lang] : [];
}

export const FIELD_LABELS: Record<ConfigField, { label: string; placeholder: string; hint: string }> = {
  entry_point: {
    label: "Entry point",
    placeholder: "main:app",
    hint: "Module/app path the server starts (e.g. main:app).",
  },
  binary_name: {
    label: "Binary name",
    placeholder: "app",
    hint: "Name of the compiled executable to run.",
  },
  build_output_dir: {
    label: "Build output dir",
    placeholder: "dist",
    hint: "Folder of built static assets, served by nginx.",
  },
  build_package: {
    label: "Build package",
    placeholder: "./cmd/server",
    hint: "Go package path to compile.",
  },
};
