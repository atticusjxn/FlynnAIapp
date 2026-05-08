/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        panel: '#111114',
        border: '#1f1f23',
        muted: '#71717a',
        accent: '#6366f1',
      },
    },
  },
  plugins: [],
};
