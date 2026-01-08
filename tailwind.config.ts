import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "tft-dark": "#0b0f1a",
        "tft-darker": "#05070f",
        "tft-accent": "#5eead4",
        "tft-accent-strong": "#22d3ee"
      },
      boxShadow: {
        glow: "0 0 35px rgba(94, 234, 212, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
