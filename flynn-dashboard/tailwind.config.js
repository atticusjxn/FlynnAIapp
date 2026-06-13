/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Flynn brand orange (landing-page reference).
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#ffd0c2',
          500: '#ff4500',
          600: '#ea3e00',
          700: '#c23400',
          900: '#1a1a1a',
        },
        cream: '#F4E6CE',
      },
      boxShadow: {
        // Brutalist hard shadow.
        hard: '4px 4px 0 0 #1a1a1a',
        'hard-sm': '2px 2px 0 0 #1a1a1a',
      },
    },
  },
  plugins: [],
};
