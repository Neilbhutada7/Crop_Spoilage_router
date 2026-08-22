/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep, natural agricultural green -- the product's primary identity
        // color (AgriRoute). Premium/forest-toned rather than neon.
        brand: {
          50: "#eef7f0",
          100: "#d7ecdd",
          200: "#aed9bc",
          300: "#7ebf95",
          400: "#4f9f6d",
          500: "#327d4f",
          600: "#23643d",
          700: "#1a4f31",
          800: "#143f27",
          900: "#0e2f1c",
        },
        // Restrained saffron -- used only for warning-level accents, not decoration.
        earth: {
          50: "#fdf5ec",
          100: "#faead2",
          400: "#e08a2b",
          500: "#c9711a",
          600: "#a85c14",
          700: "#834710",
        },
        risk: {
          low: "#16a34a",
          medium: "#d97706",
          high: "#dc2626",
        },
        surface: {
          light: "#f4f6f9",
        },
      },
      fontFamily: {
        sans: ["Noto Sans", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgba(26, 79, 49, 0.06)',
      },
    },
  },
  plugins: [],
};
