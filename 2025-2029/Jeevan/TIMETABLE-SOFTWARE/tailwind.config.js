/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bbfd',
          400: '#7c95fb',
          500: '#5b6ef6',
          600: '#4550ea',
          700: '#3840cf',
          800: '#3137a7',
          900: '#2d3484',
          950: '#1c1f50',
        },
        accent: {
          50: '#fff8f0',
          100: '#ffefd9',
          200: '#ffdab2',
          300: '#ffbe81',
          400: '#ff954d',
          500: '#ff6e20',
          600: '#f05211',
          700: '#c73c0c',
          800: '#9e3012',
          900: '#7f2a13',
        },
        dark: {
          900: '#0a0b14',
          800: '#0f1020',
          700: '#151728',
          600: '#1c1f35',
          500: '#252840',
          400: '#343761',
          300: '#494d7e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'gradient': 'gradient 8s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(91, 110, 246, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(91, 110, 246, 0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backgroundSize: {
        '300%': '300%',
      },
    },
  },
  plugins: [],
}
