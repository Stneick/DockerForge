/** Platform-aware modifier labels and shortcut helpers. */

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /Mac|iPhone|iPad|iPod/.test(platform);
}

/** Modifier key label: ⌘ on macOS, Ctrl on Windows/Linux. */
export const MOD_KEY = isMacPlatform() ? "⌘" : "Ctrl";
export const ALT_KEY = isMacPlatform() ? "⌥" : "Alt";

/** e.g. formatShortcut(MOD_KEY, "P") → "Ctrl + P" (or "⌘ + P" on Mac). */
export function formatShortcut(...parts: string[]): string {
  return parts.join(" + ");
}

/** True when the platform primary shortcut modifier is held. */
export function hasMod(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMacPlatform() ? e.metaKey : e.ctrlKey;
}
