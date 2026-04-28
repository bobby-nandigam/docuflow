/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#dce6ff",
          200: "#b8cbff",
          300: "#8aa7ff",
          400: "#5577ff",
          500: "#3355ee",
          600: "#2240d4",
          700: "#1a30ab",
          800: "#152488",
          900: "#111d6e",
        },
        surface: {
          0:   "#ffffff",
          50:  "#f8f9fc",
          100: "#f0f2f8",
          200: "#e4e8f4",
          300: "#d0d6eb",
          800: "#1e2238",
          900: "#141626",
          950: "#0d0f1c",
        },
        ink: {
          50:  "#8892b4",
          100: "#6b76a0",
          400: "#3a4370",
          500: "#272f5a",
          900: "#0e1028",
        }
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-in-right": "slide-in-right 0.3s ease-out both",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "shimmer": "shimmer 1.5s infinite",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "slide-in-right": {
          "0%": { opacity: 0, transform: "translateX(24px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 4px 16px 0 rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 8px 32px 0 rgb(0 0 0 / 0.1)",
        "brand": "0 4px 20px -2px rgb(51 85 238 / 0.35)",
        "glow": "0 0 40px rgb(51 85 238 / 0.2)",
      },
    },
  },
  plugins: [],
}
