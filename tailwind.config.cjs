/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0D9488',
        'primary-light': '#CCFBF1',
        danger: '#E11D48',
        warning: '#F59E0B',
        'app-bg': '#F8FAFC',
        card: '#FFFFFF',
        'text-dark': '#1E293B',
        'text-muted': '#64748B',
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
