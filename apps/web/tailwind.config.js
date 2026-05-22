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
        // App surface (light zones)
        bg: '#F8F7FF',
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E8E6F0',
          strong: '#C4BFD8',
        },
        // Text tokens
        text: {
          primary: '#1A1635',
          secondary: '#6B6585',
          tertiary: '#A09BB5',
        },
        // Semantic
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        amanotes: {
          pink: '#ff3177',
          purple: '#5b00e3',
        },
        shell: {
          bg:       'var(--shell-bg)',
          surface:  'var(--shell-surface)',
          border:   'var(--shell-border)',
          text:     'var(--shell-text)',
          muted:    'var(--shell-muted)',
          tertiary: 'var(--shell-tertiary)',
        },
        canvas: {
          bg:      'var(--canvas-bg)',
          surface: 'var(--canvas-surface)',
          border:  'var(--canvas-border)',
          text:    'var(--canvas-text)',
          muted:   'var(--canvas-muted)',
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
        amanotes:
          '0 8px 32px rgba(255, 49, 119, 0.12), 0 4px 16px rgba(91, 0, 227, 0.1)',
      },
    },
  },
  plugins: [],
}
