import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#061532",
        paper: "#f4f7fb",
        line: "#d7dfec",
        accent: "#0b63f6",
        signal: "#ef4444"
      },
      boxShadow: {
        lesson: "0 14px 40px rgba(6, 21, 50, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
