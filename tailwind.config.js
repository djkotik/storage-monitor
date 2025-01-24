/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#3B82F6',
          dark: '#60A5FA',
        },
        background: {
          light: '#F3F4F6',
          dark: '#111827',
        },
        card: {
          light: '#FFFFFF',
          dark: '#1F2937',
        },
      },
    },
  },
  plugins: [],
};