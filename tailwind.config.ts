import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0a0a0a",
          1: "#111111",
          2: "#1a1a1a",
          3: "#242424",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          hover: "rgba(255,255,255,0.1)",
        },
        accent: {
          DEFAULT: "#f59e0b",
          hover: "#d97706",
        },
      },
    },
  },
  plugins: [],
};

export default config;
