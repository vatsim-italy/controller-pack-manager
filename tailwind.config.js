/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0fdfb",
          100: "#ccfbf1",
          500: "#2dd4dc",
          600: "#06b6d4",
          700: "#0891b2",
        },
        secondary: {
          50: "#f8fafb",
          100: "#f1f5f9",
          500: "#64748b",
          600: "#475569",
          700: "#1e293b",
        },
        accent: {
          warning: "#ffa500",
          success: "#00d084",
          danger: "#ef4444",
        },
        dark: {
          header: "#1a2332",
          bg: "#ffffff",
          text: "#0f172a",
          border: "#e2e8f0",
        },
      },
      borderColor: {
        accent: "#2dd4dc",
      },
    },
  },
  plugins: [],
}

