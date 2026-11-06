/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './browser.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark navy surface scale ("ink-*") — matches the TechnoWin logo: blue is the
        // primary accent, white is the secondary (text/icon) color.
        ink: {
          950: '#05070d',
          900: '#0b1220', // page background
          850: '#0e1626', // inset surfaces / input fills
          800: '#141d33', // cards / panels
          750: '#1a2440', // subtle fills & hover
          700: '#232f52', // strong borders
        },
        accent: {
          400: '#3d8bff',
          500: '#2563eb',
          600: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: [
          'Sahel',
          'Segoe UI',
          'Tahoma',
          'system-ui',
          'sans-serif',
        ],
        mono: ['Cascadia Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 18px 44px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35)',
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
