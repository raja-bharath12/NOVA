/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#07060B',
          900: '#0B0A12',
          800: '#121020',
          700: '#1A1730',
        },
        silver: '#F1EFF7',
        lavender: '#C9BEEA',
        violet: {
          400: '#9E86F2',
          500: '#8367E8',
          600: '#6B4FD1',
        },
        cyan: {
          400: '#6FE3E0',
          500: '#4CC9C6',
        },
        muted: '#8B85A8',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      backgroundImage: {
        'aurora-1': 'radial-gradient(circle at 20% 20%, rgba(131,103,232,0.25), transparent 55%)',
        'aurora-2': 'radial-gradient(circle at 80% 30%, rgba(76,201,198,0.18), transparent 55%)',
        'aurora-3': 'radial-gradient(circle at 50% 85%, rgba(157,134,242,0.16), transparent 60%)',
      },
      boxShadow: {
        glow: '0 0 24px rgba(131,103,232,0.35)',
        'glow-cyan': '0 0 20px rgba(76,201,198,0.3)',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.05)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
      },
      animation: {
        drift: 'drift 24s ease-in-out infinite',
        'drift-slow': 'drift 40s ease-in-out infinite',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
