import type { Config } from "tailwindcss";

// Warm, light "interiors" design system for Hazel.
//
// The app was authored against a dark "cockpit" palette that leans on two
// Tailwind scales everywhere: `slate` for neutrals/surfaces and `cyan` for the
// accent. Rather than touch hundreds of class strings, we recolour centrally by
// REDEFINING those two scales here, plus the semantic accents.
//
//  • slate — inverted & warmed. In the original (dark) usage a HIGH index meant
//    a DARK surface (bg-slate-950 = page) and a LOW index meant LIGHT text
//    (text-slate-100 = heading). We keep that contract but flip the lightness:
//    high index = light surface (cream/white/taupe), low index = dark warm ink.
//    So every existing `bg-slate-950 / border-slate-800 / text-slate-100` lands
//    correctly on the light theme with no markup changes.
//
//  • cyan — becomes "hazel": a warm amber accent (#B17A3C family). Solid fills
//    (bg-cyan-500) are deepened enough to carry cream text at AA; text/links
//    (text-cyan-300/400) read as dark hazel on light surfaces; hover
//    (bg-cyan-400) is a touch darker than the base, as the markup expects.
//
//  • emerald / amber / red / indigo / sky / fuchsia / blue / teal — only the
//    light text shades (200–400) and the solid/tint base (500) are overridden
//    to stay legible on a light background. `extend` merges, so the unused
//    shades keep their defaults.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Serif wordmark / display for the warm "interiors" feel.
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "ui-serif", "serif"],
        display: ["var(--font-display)", "Space Grotesk", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Warm neutrals — inverted (high index = light surface, low index = dark ink).
        slate: {
          50: "#1a1509", // darkest warm ink
          100: "#241e13", // headings (text-slate-100)
          200: "#352e1f", // primary body text (text-slate-200)
          300: "#463c2d", // secondary text
          400: "#5e5240", // muted text / strong dots
          500: "#7e6f56", // muted labels (the workhorse)
          600: "#b7a78b", // faint text / placeholders / soft borders
          700: "#d8cdb8", // borders, inputs, dividers
          800: "#e7decd", // hairline taupe borders
          900: "#fffdf8", // card / raised surfaces (lift gently off the page)
          950: "#faf6ef", // page background (warm cream) + cream text on accent
        },
        // Hazel — warm amber accent.
        cyan: {
          50: "#fbf4ea",
          100: "#f3e4cf", // accent tint
          200: "#7e5224", // dark hazel text on pale tints
          300: "#8c5e2c", // links / active text (brand hover tone)
          400: "#835527", // hover fill (slightly darker than base) + dark icon text
          500: "#9c6a30", // PRIMARY accent fill — carries cream text at AA
          600: "#5a3a1a",
          700: "#4a2f14",
          800: "#39240f",
          900: "#291a0a",
          950: "#1a1006",
        },
        // Semantic accents — darkened light shades for legibility on cream.
        emerald: { 200: "#0c6b4a", 300: "#0a7150", 400: "#0b8a5e", 500: "#0a7150" },
        amber: { 100: "#7a4a12", 200: "#8a5410", 300: "#92580e", 400: "#b5730c", 500: "#b5730c" },
        red: { 200: "#9a2018", 300: "#b42318", 400: "#c0392b", 500: "#c0392b" },
        indigo: { 300: "#4f46ba", 400: "#5b52c9", 500: "#5b52c9" },
        sky: { 300: "#0369a1", 400: "#0284c7", 500: "#0284c7" },
        fuchsia: { 300: "#a21caf", 400: "#c026d3", 500: "#c026d3" },
        blue: { 300: "#1d4ed8", 400: "#2563eb", 500: "#2563eb" },
        teal: { 300: "#0f766e", 400: "#0d9488", 500: "#0d9488" },
      },
    },
  },
  plugins: [],
};

export default config;
