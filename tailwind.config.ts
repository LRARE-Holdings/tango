// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media", // ← THIS is the key line
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;