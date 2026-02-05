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
        // Ansell brand colors (from brandfetch.com/ansell.com)
        ansell: {
          // Primary - Teal/Persian Green
          teal: '#00b09c',
          'teal-dark': '#009485',
          'teal-light': '#78b8a8',
          // Primary - Dark Gray (Tapa)
          dark: '#71706e',
          'dark-light': '#8a8988',
          'dark-darker': '#5a5958',
          // Light Gray (Wild Sand)
          light: '#f5f5f5',
          // Gray scale
          gray: {
            50: '#f5f5f5',
            100: '#ebebeb',
            200: '#d6d6d6',
            300: '#c2c2c2',
            400: '#a3a3a3',
            500: '#71706e',
            600: '#5a5958',
            700: '#424241',
            800: '#2b2b2a',
            900: '#141414',
          },
        },
      },
      // Remove all rounded corners by default
      borderRadius: {
        none: '0',
        DEFAULT: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px', // Keep full for circles/pills if needed
      },
    },
  },
  plugins: [],
}
export default config
