import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ci: {
          // Superficies
          void:    '#060A12',
          base:    '#0C1120',
          raised:  '#121828',
          overlay: '#1A2236',
          // Bordes
          line:    'rgba(245,158,11,0.12)',
          'line-active': 'rgba(245,158,11,0.55)',
          // Acento
          amber:   '#F59E0B',
          'amber-bright': '#FCD34D',
          'amber-dim':    '#92660A',
          // Texto
          primary:   '#E8ECF5',
          secondary: '#7A8299',
          muted:     '#3D4460',
          // Estado
          success: '#34D399',
          error:   '#F87171',
          warning: '#FBBF24',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
        body:    ['"Outfit"', 'sans-serif'],
      },
      animation: {
        'blink':     'blink 1.1s step-end infinite',
        'slide-up':  'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'slide-in':  'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':   'fadeIn 0.4s ease-out',
        'shake':     'shake 0.45s ease-in-out',
        'scan-line': 'scanLine 4s linear infinite',
      },
      keyframes: {
        blink: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%':     { transform: 'translateX(-7px)' },
          '40%':     { transform: 'translateX(7px)' },
          '60%':     { transform: 'translateX(-4px)' },
          '80%':     { transform: 'translateX(4px)' },
        },
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(200%)' },
        },
      },
      backgroundImage: {
        'grid-amber': `
          linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid': '48px 48px',
      },
    },
  },
  plugins: [],
} satisfies Config
