// Render build logs like a real terminal: parse ANSI SGR escape codes into
// styled segments, and (for lines that carry no ANSI) classify common Docker
// build output by content so Step headers, image ids, successes, and errors
// get sensible colors.

export interface AnsiSegment {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

// Map ANSI palette → our Cool Industrial colors.
const FG: Record<number, string> = {
  30: "#5e7080", 31: "#f87171", 32: "#34d399", 33: "#fbbf24",
  34: "#60a5fa", 35: "#e879f9", 36: "#22d3ee", 37: "#c4d2de",
  90: "#7b8794", 91: "#fca5a5", 92: "#6ee7b7", 93: "#fcd34d",
  94: "#93c5fd", 95: "#f0abfc", 96: "#67e8f9", 97: "#e6eef6",
};

// eslint-disable-next-line no-control-regex
const SGR_RE = /\x1b\[([0-9;]*)m/g;

const cache = new Map<string, AnsiSegment[]>();
const CACHE_CAP = 6000;

/** Parse a string with ANSI SGR codes into styled text segments. */
export function parseAnsi(input: string): AnsiSegment[] {
  const cached = cache.get(input);
  if (cached) return cached;

  const segments: AnsiSegment[] = [];
  let color: string | undefined;
  let bold = false;
  let dim = false;
  let last = 0;
  let m: RegExpExecArray | null;

  const push = (text: string) => {
    if (text) segments.push({ text, color, bold, dim });
  };

  SGR_RE.lastIndex = 0;
  while ((m = SGR_RE.exec(input)) !== null) {
    push(input.slice(last, m.index));
    last = SGR_RE.lastIndex;
    const codes = m[1].split(";").filter(Boolean).map(Number);
    if (codes.length === 0) codes.push(0);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) {
        color = undefined;
        bold = false;
        dim = false;
      } else if (c === 1) bold = true;
      else if (c === 2) dim = true;
      else if (c === 22) {
        bold = false;
        dim = false;
      } else if (c === 39) color = undefined;
      else if (FG[c]) color = FG[c];
      else if (c === 38) {
        // extended color: 38;5;n (256) or 38;2;r;g;b (truecolor)
        if (codes[i + 1] === 2) {
          color = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
          i += 4;
        } else if (codes[i + 1] === 5) {
          i += 2; // skip 256-color index (keep default)
        }
      }
    }
  }
  push(input.slice(last));

  const result = segments.length ? segments : [{ text: input }];
  if (cache.size > CACHE_CAP) cache.clear();
  cache.set(input, result);
  return result;
}

/** True if a string contains no ANSI styling (single, uncolored segment). */
export function isPlain(segments: AnsiSegment[]): boolean {
  return segments.length <= 1 && !segments[0]?.color;
}

/** Content-based color for plain Docker build lines (no ANSI). Returns a CSS color. */
export function dockerLineColor(line: string): string | undefined {
  const t = line.trim();
  // Synthetic framed markers from the backend, e.g.
  // "--- Build finished with status: SUCCESS ---".
  if (/^-{2,}.*-{2,}$/.test(t)) {
    if (/\b(success|succeeded|done|complete)\b/i.test(t)) return "#34d399";
    if (/\b(fail(ed|ure)?|error|fatal)\b/i.test(t)) return "#f87171";
    if (/\bcancel/i.test(t)) return "#fbbf24";
    return "#22d3ee"; // generic meta marker (e.g. "--- Build started ---")
  }
  if (/^Step\s+\d+\/\d+/.test(t)) return "#22d3ee"; // step header
  if (/^\s*--->/.test(line) || /^ ---> /.test(line)) return "#5e7080"; // image id / cache
  if (/^Successfully\b/.test(t) || /^\s*DONE\b/i.test(t)) return "#34d399";
  if (/^Removing intermediate container/.test(t)) return "#5e7080";
  if (/(^|\b)(error|failed|fatal|cannot|denied|not found)\b/i.test(t)) return "#f87171";
  if (/(^|\b)(warn(ing)?|deprecat)/i.test(t)) return "#fbbf24";
  if (/^(Collecting|Downloading|Installing|Building|Fetching|Pulling|Compiling|added|npm)\b/i.test(t))
    return "#8aa0b3";
  return undefined; // default terminal foreground
}
