/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Barlow", "Segoe UI", "system-ui", "sans-serif"],
        display: ["B612", "Barlow", "sans-serif"],
        mono: ["B612 Mono", "Consolas", "monospace"],
      },
      colors: {
        // Selection / focus blue. Main page actions use the strip colour instead.
        primary: {
          50: "#EEF4FC",
          100: "#DCE8F8",
          500: "#5B9BE6",
          600: "#3A76BF",
          700: "#2F639F",
        },
        // Radar-console slate: 100 is ink, 700 is the app background.
        secondary: {
          50: "#F3F6F9",
          100: "#E4E9EF",
          200: "#C9D1DA",
          300: "#B5BFCB",
          400: "#9AA6B4",
          500: "#7F8C9D",
          600: "#2F3B4A",
          700: "#18202B",
          800: "#131A23",
          900: "#0E141B",
        },
        accent: {
          warning: "#F0A73A",
          success: "#3DBE7A",
          danger: "#E2574C",
        },
        // Paper flight-progress strip.
        strip: {
          DEFAULT: "#EAD9A2",
          dim: "#D9C68A",
          ink: "#1E2630",
          rule: "#BFAE78",
        },
        dark: {
          header: "#202A37",
          bg: "#18202B",
          text: "#E4E9EF",
          border: "#2F3B4A",
        },
      },
      borderColor: {
        accent: "#EAD9A2",
      },
    },
  },
  plugins: [],
}
