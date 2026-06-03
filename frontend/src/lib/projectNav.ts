/** Build a project URL that opens the settings dialog without changing the active view tab. */
export function projectSettingsHref(
  projectId: string,
  currentSearch = "",
): string {
  const params = new URLSearchParams(currentSearch);
  if (params.get("tab") === "settings") params.delete("tab");
  params.set("settings", "open");
  const q = params.toString();
  return `/projects/${projectId}${q ? `?${q}` : ""}`;
}
