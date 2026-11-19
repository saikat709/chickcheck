import type { Config } from "tailwindcss";

/**
 * ChickCheck design tokens.
 * Every colour is a CSS variable (RGB triplet) defined in globals.css for both the
 * light (default) and dark ("night shift") themes, so `bg-surface/80` etc. work.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        "surface-3": token("surface-3"),
        line: token("line"),
        "line-strong": token("line-strong"),
        ink: token("ink"),
        "ink-2": token("ink-2"),
        "ink-3": token("ink-3"),
        brand: token("brand"),
        "brand-strong": token("brand-strong"),
        "brand-soft": token("brand-soft"),
        forest: token("forest"),
        "forest-2": token("forest-2"),
        earth: token("earth"),
        "earth-soft": token("earth-soft"),
        ok: token("ok"),
        "ok-soft": token("ok-soft"),
        warn: token("warn"),
        "warn-soft": token("warn-soft"),
        crit: token("crit"),
        "crit-soft": token("crit-soft"),
        info: token("info"),
        "info-soft": token("info-soft"),
        "series-1": token("series-1"),
        "series-2": token("series-2"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-hind)", "var(--font-noto-bn)", "system-ui", "sans-serif"],
      },
      // Only 400/500/600/700 are loaded; map 800 → 700 so no weight is faked.
      fontWeight: {
        extrabold: "700",
        black: "700",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.06), 0 1px 1px rgb(var(--shadow) / 0.04)",
        raised: "0 10px 30px -12px rgb(var(--shadow) / 0.25), 0 2px 6px rgb(var(--shadow) / 0.06)",
        pop: "0 24px 60px -20px rgb(var(--shadow) / 0.45)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
        "rise-in": "rise-in 220ms cubic-bezier(.2,.8,.2,1)",
        "slide-in-right": "slide-in-right 240ms cubic-bezier(.2,.8,.2,1)",
        "slide-in-left": "slide-in-left 220ms cubic-bezier(.2,.8,.2,1)",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0,0,.2,1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;
