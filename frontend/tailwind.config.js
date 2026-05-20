/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        "fire-orange": "var(--color-fire-orange)",
        "code-blue": "var(--color-code-blue)",
        // Surfaces
        "cloud-canvas": "var(--color-cloud-canvas)",
        "paper-white": "var(--color-paper-white)",
        "elevated-white": "var(--color-elevated-white)",
        // Text
        "ink-black": "var(--color-ink-black)",
        "stone-gray": "var(--color-stone-gray)",
        "slate-gray": "var(--color-slate-gray)",
        "silver-mist": "var(--color-silver-mist)",
        "frost-gray": "var(--color-frost-gray)",
        // Soft accents
        "pale-sienna": "var(--color-pale-sienna)",
        "powder-pink": "var(--color-powder-pink)",
        // Status
        "status-running": "var(--color-status-running)",
        "status-done": "var(--color-status-done)",
        "status-error": "var(--color-status-error)",
      },
      fontFamily: {
        // suisse substitutes to Inter, already loaded via index.html.
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
          "GeistMono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        caption: ["10px", { lineHeight: "1.4", letterSpacing: "0.1px" }],
        body: ["14px", { lineHeight: "1.54" }],
        "body-lg": ["16px", { lineHeight: "1.6" }],
        subheading: ["20px", { lineHeight: "1.43" }],
        heading: ["24px", { lineHeight: "1.33" }],
        "heading-lg": ["40px", { lineHeight: "1.1" }],
        display: ["52px", { lineHeight: "1.07", letterSpacing: "-0.52px" }],
        "display-lg": ["60px", { lineHeight: "1", letterSpacing: "-0.6px" }],
      },
      borderRadius: {
        // System named radii
        card: "16px",
        tag: "999px",
        pill: "999px",
        button: "999px",
        input: "8px",
        menu: "8px",
        default: "8px",
      },
      boxShadow: {
        subtle: "rgb(249, 249, 249) 0px 0px 0px 6px",
        "subtle-1": "rgba(0, 0, 0, 0.03) 0px 0px 0px 1px",
        card:
          "rgba(0, 0, 0, 0.02) 0px 40px 48px -20px, rgba(0, 0, 0, 0.03) 0px 32px 32px -20px, rgba(0, 0, 0, 0.03) 0px 16px 24px -12px, rgba(0, 0, 0, 0.03) 0px 0px 0px 1px",
        xl:
          "rgba(0, 0, 0, 0.03) 0px 24px 32px -12px, rgba(0, 0, 0, 0.03) 0px 16px 24px -8px, rgba(0, 0, 0, 0.03) 0px 8px 16px -4px, rgba(0, 0, 0, 0.03) 0px 0px 0px 1px",
        "code-card":
          "rgba(0, 0, 0, 0.02) 0px 0px 44px 0px, rgba(0, 0, 0, 0.03) 0px 88px 56px -20px, rgba(0, 0, 0, 0.02) 0px 56px 56px -20px, rgba(0, 0, 0, 0.03) 0px 32px 32px -20px, rgba(0, 0, 0, 0.03) 0px 16px 24px -12px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgb(249, 249, 249) 0px 0px 0px 10px",
        glow: "0 0 0 4px rgba(255, 77, 0, 0.15)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 77, 0, 0.35)" },
          "50%": { boxShadow: "0 0 0 6px rgba(255, 77, 0, 0)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
