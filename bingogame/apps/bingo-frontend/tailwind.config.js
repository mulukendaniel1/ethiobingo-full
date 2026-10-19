// apps/bingo-frontend/tailwind.config.js
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Ethio Bingo — Neon Arcade premium ─────────────
        tina: {
          dark:     '#241541',      // rich violet-plum background
          light:    '#33205C',      // elevated violet surface
          gold:     '#22D3EE',      // primary accent — electric cyan  (named gold for legacy compat)
          goldDark: '#0EA5E9',      // accent pressed
          leaf:     '#22C55E',      // win / success — vivid green
          berry:    '#FB7185',      // danger / banned — bright rose
          purple:   '#22D3EE',      // column B — electric cyan
          blue:     '#E879F9',      // column I — vivid fuchsia
          orange:   '#FB923C',      // column O — warm orange
          glass:    'rgba(255,255,255,0.04)',
        },
        // Legacy indigo/violet utility classes are used throughout the
        // component files (indigo-300..900, violet-500). Overriding them
        // here recolors every existing bg-indigo-*/text-indigo-*/etc.
        // class to the new Neon Arcade cyan without touching component markup.
        indigo: {
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        violet: {
          500: '#0E7490',
        },
        // emerald-* classes are used raw for "win/success" states
        // (BallBoard current ball, WinnerPopup winning line, UserCard
        // marked cells) — brightened to a punchier, more vivid green.
        emerald: {
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        // bg-black/NN, border-black, from-black/to-black etc. appear
        // throughout as base surface fills — overriding black itself
        // to our violet tone removes the "pure dark navy" look everywhere
        // at once instead of editing every occurrence individually.
        black: '#241541',
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':     'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in':   'bounceIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-soft':  'pulseSoft 1.8s ease-in-out infinite',
        'slide-down':  'slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce-ball': 'bounceBall 0.7s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'shimmer':     'shimmer 1.6s infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        bounceIn:  { '0%': { transform: 'scale(0.25)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '80%': { transform: 'scale(0.96)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.75' } },
        slideDown: { '0%': { transform: 'translateY(-120%)', opacity: '0' }, '70%': { transform: 'translateY(8%)', opacity: '1' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        bounceBall:{ '0%, 100%': { transform: 'translateY(0) scale(1)' }, '50%': { transform: 'translateY(-14px) scale(1.05)' } },
        shimmer:   { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
      },
      boxShadow: {
        glass:    '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        ball3d:   'inset -6px -6px 12px rgba(0,0,0,0.6), inset 4px 4px 8px rgba(255,255,255,0.15), 0 8px 20px rgba(0,0,0,0.5)',
        goldGlow: '0 0 18px rgba(34,211,238,0.5)',
      },
    },
  },
  plugins: [],
};