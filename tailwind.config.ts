import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nw28: {
          dark: '#1a1a2e',
          primary: '#16213e',
          accent: '#0f3460',
          highlight: '#e94560',
          green: '#22c55e',
          yellow: '#eab308',
          surface: '#f8fafc',
        },
      },
    },
  },
  plugins: [],
};
export default config;
