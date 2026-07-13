/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F1F4FD',
          100: '#E2E8FB',
          200: '#C7D2F7',
          300: '#A9B9F0',
          400: '#8B9FE8',
          500: '#6F84DB',
          600: '#5164C0',
          700: '#3C4C9C',
          800: '#2A3A78',
          900: '#1B2F5E',
          950: '#111D3B',
        },
      },
    },
  },
  plugins: [],
}
