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
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2463eb",
          700: "#1d4ed8",
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

