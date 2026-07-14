/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // src/design/tokens/color.js와 동일한 값 — 값의 출처는 하나다.
        brand: { DEFAULT: "#2563EB", cyan: "#06B6D4" },
        health: "#16A34A",
      },
    },
  },
  plugins: [],
};
