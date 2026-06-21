import type { Config } from "tailwindcss";

// "Kennel" — the dark Hazel design system.
//
// The app recolours centrally through two Tailwind scales used everywhere:
// `slate` for neutrals/surfaces and `cyan` for the accent. We redefine those
// scales (plus the semantic accents) so no class strings need to change.
//
//  • slate — a dark, warm espresso scale. The usage contract is "high index =
//    page-ground surface, low index = text": bg-slate-950 = page (#1F1A16),
//    bg-slate-900 = surface (#2A231E), border-slate-800 = divider (#3D332C),
//    and text-slate-100/200 = the cream foreground. text-slate-950 is the dark
//    on-primary text used on amber buttons.
//
//  • cyan — the Hazel amber accent. bg-cyan-500 = primary (#D89248), hover
//    bg-cyan-400 is the brighter tone (#E3A55F), and text-cyan-300 = the amber
//    link/accent colour.
//
//  • semantic accents — brightened to read on the dark surfaces (success uses
//    the Kennel green #6FAE5A). `extend` merges, so unused shades keep defaults.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Brand wordmark — Nunito (loaded 700/800/900).
        wordmark: ["var(--font-nunito)", "Nunito", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "ui-serif", "serif"],
        display: ["var(--font-display)", "Space Grotesk", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Warm espresso neutrals (high index = dark surface, low index = cream text).
        slate: {
          50: "#fbf7ef", // near-white (rare)
          100: "#f7f1e6", // headings
          200: "#f2ebdd", // foreground / body text
          300: "#dcd3c4", // secondary text
          400: "#c9bead", // text
          500: "#b3a693", // muted text (the workhorse)
          600: "#8a7e6d", // faint text / placeholders / faint borders
          700: "#4a3e34", // strong borders / inputs / chip fills
          800: "#3d332c", // border / divider / hover surface
          900: "#2a231e", // surface / cards (bark)
          950: "#1f1a16", // page background (espresso) + dark on-primary text
        },
        // Hazel amber accent.
        cyan: {
          50: "#2a1e12",
          100: "#34261a", // dark accent tint
          200: "#eec08a", // bright amber text on tints
          300: "#e3a55f", // links / active / accent text
          400: "#e3a55f", // hover fill (brighter than base)
          500: "#d89248", // PRIMARY accent fill
          600: "#c97c53", // secondary accent / pressed
          700: "#a8633c",
          800: "#7e4a2c",
          900: "#5a3420",
          950: "#3a2114",
        },
        // Semantic accents — bright enough to read on the dark surfaces.
        emerald: { 200: "#a6d399", 300: "#8fc47e", 400: "#6fae5a", 500: "#6fae5a" }, // success
        amber: { 100: "#e8c58a", 200: "#ecc06a", 300: "#ecc06a", 400: "#e0a33a", 500: "#e0a33a" },
        red: { 200: "#f0a593", 300: "#ec8770", 400: "#e0664e", 500: "#e0664e" },
        indigo: { 300: "#a9a4f2", 400: "#8c86e8", 500: "#8c86e8" },
        sky: { 300: "#6fb8e8", 400: "#4aa3e0", 500: "#4aa3e0" },
        fuchsia: { 300: "#e58cdd", 400: "#d45fcb", 500: "#d45fcb" },
        blue: { 300: "#8aaef2", 400: "#5b8de8", 500: "#5b8de8" },
        teal: { 300: "#5fc9bd", 400: "#3db3a6", 500: "#3db3a6" },
      },
    },
  },
  plugins: [],
};

export default config;
