/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        'void-bg': '#05070a',
        'void-bg-alt': '#0a0c10',
        'void-accent': 'var(--void-accent)',
        'void-accent-glow': 'var(--void-accent)',
        'void-text': '#fcfaf7',
        'void-muted': '#94a3b8',
        'rarity-common': '#94a3b8',
        'rarity-rare': '#3b82f6',
        'rarity-epic': '#a855f7',
        'rarity-legendary': '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        header: ['Space Grotesk', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      animation: {
        'float-up': 'floatUp 20s linear infinite',
        'float-down': 'floatDown 25s linear infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(calc(-50% - 8px))' },
        },
        floatDown: {
          '0%': { transform: 'translateY(calc(-50% - 8px))' },
          '100%': { transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.3', filter: 'blur(20px)' },
          '50%': { opacity: '0.6', filter: 'blur(40px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
};
