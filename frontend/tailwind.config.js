/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0fdf7',
          100: '#dcfce9',
          200: '#bbf7d2',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
      boxShadow: {
        // Slightly more defined than before; still clean and non-intrusive
        card:       '0 1px 4px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 6px 20px 0 rgb(0 0 0 / 0.08), 0 2px 6px -1px rgb(0 0 0 / 0.05)',
        dropdown:   '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
      },
      borderRadius: {
        // 12px — tighter than the original 14px; matches modern SaaS dashboards
        card: '0.75rem',
      },
    },
  },
  plugins: [],
}
