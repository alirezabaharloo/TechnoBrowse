/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './browser.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light surface scale (kept the "ink-*" names so components stay readable)
        ink: {
          950: '#e3e8f4',
          900: '#eef1f8', // page background
          850: '#f6f7fd', // inset surfaces
          800: '#ffffff', // cards / panels
          750: '#e9edf6', // subtle fills & hover
          700: '#dce2ee', // strong borders
        },
        accent: {
          400: '#3d8bff',
          500: '#2563eb',
          600: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: [
          'Vazirmatn',
          'Segoe UI',
          'Tahoma',
          'system-ui',
          'sans-serif',
        ],
        mono: ['Vazirmatn', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 10px 30px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)',
        glow: '0 0 0 1px rgba(37, 99, 235, 0.25), 0 10px 34px rgba(37, 99, 235, 0.28)',
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
