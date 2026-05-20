/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        "midnight-eclipse": "var(--color-midnight-eclipse)",
        "starless-night": "var(--color-starless-night)",
        "twilight-ink": "var(--color-twilight-ink)",
        "deep-ocean": "var(--color-deep-ocean)",
        frost: "var(--color-frost)",
        "ghostly-gray": "var(--color-ghostly-gray)",
        "ash-gray": "var(--color-ash-gray)",
        "iron-gray": "var(--color-iron-gray)",
        "slate-gray": "var(--color-slate-gray)",
        pewter: "var(--color-pewter)",
        cloud: "var(--color-cloud)",
        // Accents
        "electric-blue": "var(--color-electric-blue)",
        "vivid-green": "var(--color-vivid-green)",
        "sunset-orange": "var(--color-sunset-orange)",
        goldenrod: "var(--color-goldenrod)",
        "magenta-burst": "var(--color-magenta-burst)",
        "sunshine-yellow": "var(--color-sunshine-yellow)",
        "crimson-red": "var(--color-crimson-red)",
        "teal-glow": "var(--color-teal-glow)",
        "fuchsia-flare": "var(--color-fuchsia-flare)",
        "sky-blue": "var(--color-sky-blue)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // System type scale
        body: ["14px", { lineHeight: "1.43", letterSpacing: "0.01px" }],
        subheading: ["18px", { lineHeight: "1.5", letterSpacing: "-0.01px" }],
        "heading-sm": ["24px", { lineHeight: "1.25", letterSpacing: "-0.025px" }],
        heading: ["31px", { lineHeight: "1.2", letterSpacing: "-0.037px" }],
        "heading-lg": ["48px", { lineHeight: "1.07", letterSpacing: "-0.05px" }],
        display: ["60px", { lineHeight: "1.06", letterSpacing: "-0.057px" }],
      },
      borderRadius: {
        // System named radii
        card: "24px",
        pill: "9999px",
        image: "24px",
        button: "4px",
        default: "9px",
      },
      boxShadow: {
        subtle: "rgba(255, 255, 255, 0.2) 0 0 0 2px inset",
        "subtle-1": "rgba(255, 255, 255, 0.2) 0 0 0 1px inset",
        "subtle-strong": "rgba(255, 255, 255, 0.25) 0 0 0 1px inset",
        md: "rgba(0, 0, 0, 0.3) 0 0 10px 0",
        card:
          "rgba(0, 0, 0, 0.25) 0 1px 4px 0, rgba(0, 0, 0, 0.1) 0 4px 59px 0",
        xl: "rgba(0, 0, 0, 0.4) 0 8px 32px 0",
        lg: "rgba(0, 0, 0, 0.25) 0 3px 20px 0",
        glow: "0 0 24px 0 rgba(0, 136, 255, 0.35)",
        "glow-green": "0 0 24px 0 rgba(22, 194, 83, 0.35)",
        "glow-fuchsia": "0 0 24px 0 rgba(221, 85, 231, 0.35)",
      },
      backgroundImage: {
        "gradient-twilight": "var(--gradient-twilight)",
        "gradient-nebula": "var(--gradient-nebula)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 136, 255, 0.45)" },
          "50%": { boxShadow: "0 0 24px 4px rgba(0, 136, 255, 0.45)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
