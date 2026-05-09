// Display formatters shared across the app.

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Signed byte delta, e.g. "+12.4 MB" / "-3 KB". */
export function formatBytesDelta(bytes: number): string {
  const sign = bytes > 0 ? "+" : bytes < 0 ? "-" : "";
  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

/** Seconds → "1:18" or "0:42" or "2h 3m". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Clock-style elapsed from a start ISO timestamp to now (or end). */
export function formatElapsed(startIso: string | null, endIso?: string | null): string {
  if (!startIso) return "0:00";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return formatDuration(Math.max(0, (end - start) / 1000));
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "seconds"],
  [60, "minutes"],
  [24, "hours"],
  [7, "days"],
  [4.34524, "weeks"],
  [12, "months"],
  [Number.POSITIVE_INFINITY, "years"],
];

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit);
    duration /= amount;
  }
  return "";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short build identifier from a UUID, e.g. "a1f4c9d2". */
export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Docker image history records instructions like
 *  "/bin/sh -c #(nop)  COPY file:abc in /app" — strip the shell wrapper noise. */
export function prettyInstruction(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/^\/bin\/sh -c #\(nop\)\s*/, "")
    .replace(/^\/bin\/sh -c\s*/, "RUN ")
    .trim();
}
