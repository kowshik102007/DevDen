/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0f19',
        darkCard: '#151c2c',
        darkBorder: '#222f47',
        primary: '#4f46e5',
        primaryHover: '#4338ca',
        accent: '#06b6d4',
        accentHover: '#0891b2',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(79, 70, 229, 0.4)',
        cyanGlow: '0 0 15px rgba(6, 182, 212, 0.4)',
      }
    },
  },
  plugins: [],
}
