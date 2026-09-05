/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-red': '#E11D48',
        'ns-bg': '#09090b',
        'ns-surface': '#121215',
        'ns-border': '#27272a'
      }
    },
  },
  plugins: [],
}
