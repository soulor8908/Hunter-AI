/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#0a0e1a',
          950: '#020617'
        },
        accent: {
          DEFAULT: '#10b981',
          glow: '#34d399'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 10px -2px rgba(16, 185, 129, 0.3)' },
          to: { boxShadow: '0 0 20px 0px rgba(16, 185, 129, 0.6)' }
        }
      }
    }
  },
  plugins: []
};
