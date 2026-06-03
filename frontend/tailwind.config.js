/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cool Industrial palette — see src/index.css for the CSS variables.
        bg: "rgb(var(--bg) / <alpha-value>)",
        bg2: "rgb(var(--bg2) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface2) / <alpha-value>)",
        surface3: "rgb(var(--surface3) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        line2: "rgb(var(--line2) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        dim: "rgb(var(--dim) / <alpha-value>)",
        cyan: {
          DEFAULT: "rgb(var(--cyan) / <alpha-value>)",
          dim: "rgb(var(--cyan-dim) / <alpha-value>)",
        },
        docker: "rgb(var(--docker) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        fail: "rgb(var(--fail) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        chrome: "rgb(var(--chrome) / <alpha-value>)",
        deep: "rgb(var(--deep) / <alpha-value>)",
        editor: "rgb(var(--editor) / <alpha-value>)",
        onaccent: "rgb(var(--onaccent) / <alpha-value>)",
        termfg: "rgb(var(--termfg) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--cyan) / 0.18), 0 0 28px rgb(var(--cyan) / 0.18)",
        "glow-sm": "0 0 14px rgb(var(--cyan) / 0.25)",
        dock: "0 -14px 40px -20px rgb(var(--cyan) / 0.45)",
        lift: "0 18px 40px -18px rgb(var(--cyan) / 0.35)",
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--cyan) / 0.5)" },
          "70%": { boxShadow: "0 0 0 8px rgb(var(--cyan) / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--cyan) / 0)" },
        },
        blink: { "50%": { opacity: "0" } },
        scan: {
          "0%": { transform: "translateX(-40px)" },
          "100%": { transform: "translateX(720px)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-opacity": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "auth-card-in": {
          from: { opacity: "0", transform: "translateY(14px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "auth-fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "auth-accent-in": {
          from: { transform: "scaleX(0)", opacity: "0" },
          to: { transform: "scaleX(1)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulseRing 1.6s infinite",
        blink: "blink 1.1s steps(1) infinite",
        scan: "scan 2.2s linear infinite",
        "fade-in": "fade-in 0.18s ease-out",
        "fade-in-opacity": "fade-in-opacity 0.18s ease-out both",
        "auth-card-in": "auth-card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "auth-fade-up": "auth-fade-up 0.42s cubic-bezier(0.22, 1, 0.36, 1) both",
        "auth-accent-in": "auth-accent-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
