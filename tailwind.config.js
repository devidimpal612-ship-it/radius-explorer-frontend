/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0A0F1E",
        surface: "#0D1B2A",
        cyan: "#00D4FF",
        violet: "#7B2FFF",
        mint: "#1AFF8A",
      },
    },
  },
  plugins: [],
};
