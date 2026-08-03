/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          cream: '#F5F0E8',
          gold: '#D4A853',
          'gold-light': '#E8D5A3',
          'gold-dark': '#B8913E',
          sage: '#A8B5A0',
          'sage-light': '#C5D0BE',
          'sage-dark': '#7A8A70',
          blush: '#E8B4B8',
          lavender: '#C9B1D0',
          wood: '#8B7355',
          moss: '#6B7D5A',
          charcoal: '#2C2C2C',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        'content': '1280px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
    },
  },
  plugins: [],
}