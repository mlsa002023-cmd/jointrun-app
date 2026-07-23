/** @type {import('tailwindcss').Config} */
// RC1 디자인 통합 — Claude Design 토큰(src/design/tokens/tokens.json: navy #122A5C,
// teal #1F9E96)을 반영한다. Tailwind 내장 blue/teal 스케일 자체를 이 값으로 덮어써서,
// 화면 대부분이 쓰는 bg-blue-600/text-blue-700 같은 기존 클래스가 코드 수정 없이
// 새 브랜드 색으로 한 번에 바뀐다(값의 출처는 tokens.json 하나 — 여기 숫자를 손으로
// 바꾸지 말고 tokens.json이 바뀌면 이 스케일도 다시 계산해서 맞춘다).
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#122A5C", cyan: "#1F9E96" },
        health: "#1F9E96",
        blue: {
          50: "#EEF1F8",
          100: "#DCE3F0",
          200: "#B9C7E1",
          300: "#94A8CD",
          400: "#5D77A8",
          500: "#35528A",
          600: "#1B3A6E",
          700: "#122A5C", // navy — primary
          800: "#0B1A3D", // navy2 — dark
          900: "#071227",
        },
        teal: {
          50: "#EAF6F5",
          100: "#CFEEEA",
          200: "#9FDCD3",
          300: "#6FD8CC", // tealLight
          400: "#3DBCAF",
          500: "#1F9E96", // teal — accent
          600: "#187E78",
          700: "#135F5B",
        },
      },
      fontFamily: {
        sans: ["Noto Sans KR", "-apple-system", "Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        "2xl": "18px", // tokens.radius.card
        "3xl": "24px", // tokens.radius.cardLarge
      },
    },
  },
  plugins: [],
};
