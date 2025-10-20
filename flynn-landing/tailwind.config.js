/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#1e40af',
        'navy': '#1e293b',
        'charcoal': '#334155',
        'success': '#10b981',
        'success-light': '#d1fae5',
        'warning': '#f59e0b',
        'warning-light': '#fef3c7',
        'error': '#ef4444',
        'error-light': '#fee2e2',
      },
    },
  },
  plugins: [],
}
