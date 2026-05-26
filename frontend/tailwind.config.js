/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#2d7a52',
          800: '#1a4731',
          900: '#0d2418',
          950: '#071210',
        },
        saffron: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ff6b00',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(135deg, #1a4731 0%, #0d2418 50%, #071210 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'bounce-slow': 'bounce 3s infinite',
        'pulse-glow': 'pulseGlow 2s infinite',
        'count-up': 'countUp 1s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        slideDown: { '0%': { transform: 'translateY(-20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,107,0,0.4)' }, '50%': { boxShadow: '0 0 0 10px rgba(255,107,0,0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'forest': '0 4px 24px rgba(26, 71, 49, 0.4)',
        'saffron': '0 4px 24px rgba(255, 107, 0, 0.4)',
        'card': '0 4px 20px rgba(0,0,0,0.3)',
        'glow': '0 0 30px rgba(26, 71, 49, 0.5)',
      },
    },
  },
  plugins: [],
};
