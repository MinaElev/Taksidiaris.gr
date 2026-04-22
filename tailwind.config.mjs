/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff7fc',
          100: '#daedf7',
          200: '#b6dbef',
          300: '#82c2e3',
          400: '#48a3d2',
          500: '#2386bd',
          600: '#176ba0',
          700: '#135683',
          800: '#13496e',
          900: '#143e5c',
          950: '#0c283e',
        },
        accent: {
          50:  '#fff8eb',
          100: '#ffeac6',
          200: '#ffd388',
          300: '#ffb74a',
          400: '#ff9a20',
          500: '#f97a07',
          600: '#dd5a02',
          700: '#b73e06',
          800: '#94300c',
          900: '#7a290d',
          950: '#461302',
        },
        ink: {
          50:  '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9de',
          300: '#b8b8c0',
          400: '#90909c',
          500: '#727280',
          600: '#5b5b67',
          700: '#4a4a54',
          800: '#3f3f47',
          900: '#37373d',
          950: '#19191c',
        },
        cream: '#fdfbf6',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
      boxShadow: {
        soft: '0 4px 20px -4px rgb(15 76 117 / 0.10), 0 2px 6px -2px rgb(15 76 117 / 0.06)',
        lift: '0 12px 40px -10px rgb(15 76 117 / 0.18), 0 4px 10px -4px rgb(15 76 117 / 0.08)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
