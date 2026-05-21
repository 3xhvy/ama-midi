/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C63FF',
          light: '#EEF0FF',
          dark: '#4B44CC',
        },
        editor: {
          bg: '#13111E',
          surface: '#1E1B2E',
          border: '#2D2847',
          text: '#E2DEFF',
          muted: '#6B6585',
        },
        app: {
          bg: '#F8F7FF',
          surface: '#FFFFFF',
          border: '#E8E6F0',
        },
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px',
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        brand: '0 4px 16px rgba(108,99,255,0.12), 0 2px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
