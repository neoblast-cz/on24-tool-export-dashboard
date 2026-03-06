import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Ansell brand colors (from ansell.digital.css visual bible)
        ansell: {
          // Primary blue
          blue: '#0063AC',
          // Teal
          teal: '#00A28F',
          'teal-dark': '#008778',
          'teal-light': '#33b8a8',
          // Dark (near-black charcoal)
          dark: '#2C2A29',
          'dark-light': '#4a4847',
          'dark-darker': '#1a1918',
          // Mid gray
          gray: '#75787B',
          // Light gray
          'light-gray': '#BBBCBC',
          // Light background
          light: '#f5f6f7',
          // Accent purple
          purple: '#7030A0',
        },
      },
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      // 8px base border radius scale
      borderRadius: {
        none: '0',
        sm:   '4px',
        DEFAULT: '8px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
export default config
