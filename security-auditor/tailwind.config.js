/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'defai-primary': '#00D9FF',
        'defai-secondary': '#FF00D9',
        'defai-dark': '#0A0A0A',
        'defai-gray': '#1A1A1A',
      },
    },
  },
  plugins: [],
}