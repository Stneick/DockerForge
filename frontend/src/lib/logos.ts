import type { SupportedLanguage } from "@/types/api";

// Maps our language/framework identifiers to the devicon SVGs in /public/logos.
const LANG: Record<SupportedLanguage, string> = {
  python: "python",
  node: "node",
  go: "go",
  java: "java",
  rust: "rust",
  c: "c",
  cpp: "cpp",
};

const FW: Record<string, string> = {
  fastapi: "fastapi",
  flask: "flask",
  django: "django",
  express: "express",
  nestjs: "nestjs",
  "vite-spa": "vite",
  vite: "vite",
  "spring-boot": "spring",
  spring: "spring",
  maven: "maven",
  gradle: "gradle",
  cmake: "cmake",
  nginx: "nginx",
};

// Essentially-monochrome black logos that need brightening on dark themes.
const DARK_LOGOS = new Set(["rust", "flask", "express"]);

export function langLogo(lang?: SupportedLanguage | null): string | null {
  return lang ? (LANG[lang] ?? null) : null;
}

export function fwLogo(fw?: string | null): string | null {
  return fw ? (FW[fw.toLowerCase()] ?? null) : null;
}

export function isDarkLogo(file: string): boolean {
  return DARK_LOGOS.has(file);
}
