/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF4FC',
          100: '#D6E6F5',
          200: '#ADC9EC',
          300: '#7EADE3',
          400: '#4F90D9',
          500: '#2B72C2',
          600: '#1B5497',
          700: '#143F72',
          800: '#0E2B4D',
          900: '#071829',
        },
        ipi: {
          blue:  '#1B5497',
          green: '#39B54A',
        },
      },
    },
  },
  plugins: [],
}
