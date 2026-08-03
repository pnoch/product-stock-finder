/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e8f0fe",
          100: "#c5d9fc",
          200: "#9ebef9",
          300: "#74a2f5",
          400: "#538df2",
          500: "#3B7DD8",
          600: "#0F52BA",
          700: "#0d47a1",
          800: "#0b3d8e",
          900: "#082d6b",
        },
        success: "#00C896",
        warning: "#F59E0B",
        error: "#EF4444",
        surface: {
          light: "#FFFFFF",
          dark: "#131929",
        },
        background: {
          light: "#F8FAFC",
          dark: "#0A0E1A",
        },
      },
    },
  },
  plugins: [],
};
