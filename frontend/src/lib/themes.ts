// Color themes. Each theme is a full set of design tokens (stored as "R G B"
// channel triples so Tailwind's rgb(var(--x) / <alpha>) keeps working).
// applyTheme() writes them onto <html>, restyling the entire app — chrome,
// editor, terminal and all.

export interface Theme {
  id: string;
  name: string;
  isLight: boolean;
  /** A few representative colors for the picker swatch. */
  swatch: string[];
  tokens: Record<string, string>;
}

// Token keys shared by every theme.
type Tokens = {
  bg: string; bg2: string; surface: string; surface2: string; surface3: string;
  line: string; line2: string; text: string; muted: string; dim: string;
  cyan: string; "cyan-dim": string; docker: string; ok: string; fail: string; warn: string;
  chrome: string; deep: string; editor: string; onaccent: string; termfg: string;
};

const t = (tokens: Tokens) => tokens as Record<string, string>;

export const THEMES: Theme[] = [
  {
    id: "cool-industrial",
    name: "Cool Industrial",
    isLight: false,
    swatch: ["#0b0f14", "#22d3ee", "#2496ed"],
    tokens: t({
      bg: "11 15 20", bg2: "15 20 25", surface: "19 26 34", surface2: "23 32 41", surface3: "27 37 48",
      line: "31 42 54", line2: "42 57 71", text: "230 238 246", muted: "138 160 179", dim: "94 112 128",
      cyan: "34 211 238", "cyan-dim": "14 116 144", docker: "36 150 237", ok: "52 211 153", fail: "248 113 113", warn: "251 191 36",
      chrome: "12 18 23", deep: "7 11 16", editor: "10 15 21", onaccent: "4 20 26", termfg: "196 210 222",
    }),
  },
  {
    id: "molten-forge",
    name: "Molten Forge",
    isLight: false,
    swatch: ["#0e0d11", "#ff7a18", "#ff3d00"],
    tokens: t({
      bg: "14 13 17", bg2: "18 16 21", surface: "26 22 27", surface2: "33 28 34", surface3: "41 35 42",
      line: "46 39 48", line2: "64 54 66", text: "240 235 238", muted: "176 160 170", dim: "120 105 115",
      cyan: "255 122 24", "cyan-dim": "168 74 12", docker: "255 105 40", ok: "74 222 128", fail: "248 113 113", warn: "251 191 36",
      chrome: "18 15 19", deep: "11 9 12", editor: "16 13 17", onaccent: "26 12 4", termfg: "236 224 230",
    }),
  },
  {
    id: "synthwave",
    name: "Synthwave",
    isLight: false,
    swatch: ["#0d0a16", "#e879f9", "#60a5fa"],
    tokens: t({
      bg: "13 10 22", bg2: "18 14 30", surface: "26 20 42", surface2: "34 26 54", surface3: "44 34 68",
      line: "40 30 62", line2: "60 46 92", text: "240 234 252", muted: "172 158 200", dim: "118 104 152",
      cyan: "232 121 249", "cyan-dim": "147 51 180", docker: "96 165 250", ok: "52 211 153", fail: "251 113 133", warn: "251 191 36",
      chrome: "16 12 26", deep: "10 8 18", editor: "14 11 24", onaccent: "26 8 30", termfg: "234 224 250",
    }),
  },
  {
    id: "nord-frost",
    name: "Nord Frost",
    isLight: false,
    swatch: ["#1a202c", "#88c0d0", "#5e81ac"],
    tokens: t({
      bg: "26 32 44", bg2: "30 37 51", surface: "38 46 62", surface2: "46 55 74", surface3: "56 67 88",
      line: "50 60 80", line2: "70 84 110", text: "230 237 247", muted: "152 168 192", dim: "104 119 144",
      cyan: "136 192 208", "cyan-dim": "76 110 130", docker: "94 129 172", ok: "163 190 140", fail: "191 97 106", warn: "235 203 139",
      chrome: "24 30 41", deep: "18 23 32", editor: "22 28 39", onaccent: "12 22 28", termfg: "216 222 233",
    }),
  },
  {
    id: "matrix",
    name: "Matrix",
    isLight: false,
    swatch: ["#080c09", "#00e676", "#34d399"],
    tokens: t({
      bg: "8 12 9", bg2: "10 16 12", surface: "14 22 16", surface2: "18 28 20", surface3: "24 36 26",
      line: "26 40 30", line2: "38 58 44", text: "220 245 225", muted: "130 180 145", dim: "80 120 90",
      cyan: "0 230 118", "cyan-dim": "16 120 70", docker: "56 200 140", ok: "52 211 153", fail: "248 113 113", warn: "230 200 60",
      chrome: "8 14 10", deep: "4 8 5", editor: "6 12 8", onaccent: "4 20 10", termfg: "200 235 210",
    }),
  },
  {
    id: "daybreak",
    name: "Daybreak (light)",
    isLight: true,
    swatch: ["#f4f7fb", "#0891b2", "#2496ed"],
    tokens: t({
      bg: "244 247 251", bg2: "236 240 246", surface: "255 255 255", surface2: "240 244 249", surface3: "230 236 243",
      line: "220 227 235", line2: "198 208 220", text: "22 30 42", muted: "80 96 114", dim: "130 145 162",
      cyan: "8 145 178", "cyan-dim": "165 215 230", docker: "36 150 237", ok: "5 150 105", fail: "220 38 38", warn: "202 138 4",
      chrome: "236 240 246", deep: "20 26 34", editor: "255 255 255", onaccent: "255 255 255", termfg: "200 215 226",
    }),
  },
];

const STORAGE_KEY = "df.theme";
const DEFAULT_ID = "cool-industrial";

export function getTheme(id: string): Theme {
  return THEMES.find((th) => th.id === id) ?? THEMES[0];
}

export function loadThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

/** Write a theme's tokens onto <html> and flag light/dark for Monaco. */
export function applyTheme(id: string) {
  const theme = getTheme(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${k}`, v);
  }
  root.dataset.light = theme.isLight ? "1" : "0";
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
