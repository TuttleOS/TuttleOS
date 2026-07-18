import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        grid: "var(--grid)",
        accent: "var(--accent)",
        "accent-dk": "var(--accent-dk)",
        "accent-lt": "var(--accent-lt)",
        sidebar: "var(--sidebar)",
        "sidebar-ink": "var(--sidebar-ink)",
        top: "var(--top)",
        "top-ink": "var(--top-ink)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        warning: "var(--warning)",
        "warning-bg": "var(--warning-bg)",
        success: "var(--success)",
        "success-bg": "var(--success-bg)",
        info: "var(--info)",
        "info-bg": "var(--info-bg)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "var(--shadow)",
      },
      borderRadius: {
        panel: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
