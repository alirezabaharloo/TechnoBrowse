/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // The whole palette is variable-driven so [data-theme="light"] on <html>
        // flips the app between dark and light without touching component classes.
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)', // page background
          850: 'var(--ink-850)', // inset surfaces / input fills
          800: 'var(--ink-800)', // cards / panels
          750: 'var(--ink-750)', // subtle fills & hover
          700: 'var(--ink-700)', // strong borders
        },
        // Legacy slate scale remapped to variables: components written for the
        // dark theme (slate-100 = light text…) flip to dark-on-light automatically.
        slate: {
          100: 'var(--slate-100)',
          200: 'var(--slate-200)',
          300: 'var(--slate-300)',
          400: 'var(--slate-400)',
          500: 'var(--slate-500)',
          600: 'var(--slate-600)',
          700: 'var(--slate-700)',
        },
        accent: {
          400: 'var(--accent-400)', // flips: #3d8bff on dark, #2563eb on light
          500: '#2563eb',
          600: '#1d4ed8',
        },
        tint: {
          line: 'var(--tint-line)', // hairline borders
          lineStrong: 'var(--tint-line-strong)',
          fill: 'var(--tint-fill)', // subtle fills / hovers
          fill2: 'var(--tint-fill-2)',
          scrim: 'var(--scrim)', // modal backdrop
        },
      },
      fontFamily: {
        sans: ['Sahel', 'Segoe UI', 'Tahoma', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 18px 44px var(--shadow-card), 0 2px 6px var(--shadow-card-2)',
        glow: '0 0 0 1px rgba(61, 139, 255, 0.35), 0 10px 36px rgba(37, 99, 235, 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'zoom-in': 'zoom-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
