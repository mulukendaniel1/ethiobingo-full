// apps/bingo-frontend/src/components/ResponsiblePlayPopup.tsx
import { createSignal } from 'solid-js';

// Custom SVG icons
const Icons = {
  card: () => (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  ),
  shield: () => (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  lightning: () => (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  gift: () => (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  bingoBall: () => (
    <svg class="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <text x="12" y="17" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor" stroke="none">🎯</text>
    </svg>
  ),
};

export default function ResponsiblePlayPopup(props: { onAcknowledge: () => void }) {
  const [checked, setChecked] = createSignal(false);

  const bingoLetters = [
  { letter: 'B', color: 'bg-bunna-gold' },
  { letter: 'I', color: 'bg-bunna-leaf' },
  { letter: 'N', color: 'bg-bunna-blue' },      // new
  { letter: 'G', color: 'bg-bunna-berry' },
  { letter: 'O', color: 'bg-bunna-purple' },    // new
];

  return (
    <div class="fixed inset-0 z-[20000] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
      <div class="relative max-w-sm w-full rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-black/90 to-black/80 p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-300 overflow-hidden">
        {/* Glossy overlay */}
        <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        
        {/* Corner accents */}
        <div class="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-bunna-gold/20 rounded-tl-2xl" />
        <div class="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-bunna-gold/20 rounded-tr-2xl" />
        <div class="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-bunna-gold/20 rounded-bl-2xl" />
        <div class="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-bunna-gold/20 rounded-br-2xl" />
        
        {/* Glowing ring */}
        <div class="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_0_30px_rgba(250,204,21,0.1)]" />

        {/* 3D Balls Decorations (side balls) */}
        <div class="absolute left-[-20px] top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-bunna-gold via-yellow-500 to-orange-500 shadow-ball animate-float-slow opacity-80" />
        <div class="absolute right-[-20px] top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-bunna-gold via-yellow-500 to-orange-500 shadow-ball animate-float-reverse opacity-80" />
        <div class="absolute left-1/2 bottom-[-30px] -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-bunna-gold via-yellow-500 to-orange-500 shadow-ball animate-float-slow opacity-60" />
        
        <div class="relative z-10">
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-bunna-gold/20 to-bunna-gold/5 border-2 border-bunna-gold/30 shadow-lg shadow-bunna-gold/10 relative">
            {/* BINGO letters around the central ball */}
            {bingoLetters.map((item, idx) => {
              // Arrange in a semi-circle (angles from -60deg to 60deg)
              const angle = -60 + (idx * 30); // degrees
              const rad = (angle * Math.PI) / 180;
              const radius = 48; // distance from center
              const left = 50 + radius * Math.cos(rad);
              const top = 50 + radius * Math.sin(rad);
              return (
                <div
                  class={`absolute w-7 h-7 rounded-full ${item.color} shadow-ball flex items-center justify-center text-white font-black text-xs`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {item.letter}
                </div>
              );
            })}
            {/* Additional floating mini balls around (optional) */}
            <div class="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-bunna-gold to-yellow-500 shadow-ball animate-pulse-soft" />
            <div class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-bunna-gold to-orange-500 shadow-ball animate-float-slow" />
            <div class="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-br from-bunna-gold to-orange-500 shadow-ball animate-float-reverse" />
            <div class="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-bunna-gold to-yellow-500 shadow-ball animate-pulse-soft" />
            <div class="text-bunna-gold">
              <Icons.bingoBall />
            </div>
          </div>

          <h2 class="mb-2 text-2xl font-black uppercase tracking-tight text-white italic">
            Fair <span class="text-bunna-gold">Bingo</span>
          </h2>
          
          <p class="mb-6 text-[11px] font-bold uppercase tracking-widest text-gray-500 leading-relaxed">
            Bunna Bingo is a <span class="text-white">fairness-first game</span>,<br /> powered by{' '}
            <span class="text-[#ff3366] font-black tracking-wider relative inline-block drop-shadow-[0_0_4px_rgba(255,51,102,0.5)]">
              Etmarts Ecosystem
            </span>{' '}
            & provable math.
          </p>

          {/* Info items (unchanged) */}
          <div class="mb-8 space-y-2.5 text-left">
            {[
              { icon: Icons.card, text: 'Card Price:', val: '10.00 ETB' },
              { icon: Icons.shield, text: 'Fairness:', val: 'Provably Fair' },
              { icon: Icons.lightning, text: 'Draws:', val: 'Real-Time' },
              { icon: Icons.gift, text: 'Prizes:', val: 'Instant Payout' },
            ].map((item) => (
              <div class="group flex items-center justify-between rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-bunna-gold/20 px-4 py-3 transition-all duration-300">
                <div class="flex items-center gap-3">
                  <div class="text-bunna-gold opacity-80 group-hover:opacity-100 transition-opacity">
                    <item.icon />
                  </div>
                  <span class="text-[10px] font-black uppercase text-gray-400 group-hover:text-gray-300 tracking-tighter">{item.text}</span>
                </div>
                <span class="text-[10px] font-black text-bunna-gold uppercase italic">{item.val}</span>
              </div>
            ))}
          </div>

          <label class="group mb-8 flex cursor-pointer items-start gap-3 text-left">
            <div class="relative flex h-5 w-5 mt-0.5 shrink-0 items-center justify-center rounded-md border-2 border-white/20 transition-all group-hover:border-bunna-gold/50">
              <input 
                type="checkbox" 
                checked={checked()} 
                onChange={(e) => setChecked(e.currentTarget.checked)} 
                class="peer absolute h-full w-full cursor-pointer opacity-0" 
              />
              <div class={`h-2.5 w-2.5 rounded-sm bg-bunna-gold transition-transform ${checked() ? 'scale-100' : 'scale-0'}`} />
            </div>
            <span class="text-[11px] font-bold leading-tight text-gray-400 group-hover:text-gray-200">
              I confirm I am over 18 and will play responsibly within my budget.
            </span>
          </label>

          <button 
            onClick={props.onAcknowledge} 
            disabled={!checked()}
            class="w-full rounded-2xl bg-gradient-to-r from-bunna-gold to-yellow-500 py-4 font-black uppercase tracking-widest text-black transition-all duration-300 hover:scale-105 hover:shadow-glow disabled:opacity-20 disabled:scale-100 relative overflow-hidden group"
          >
            <span class="relative z-10 italic">Enter Bingo Hall</span>
            <div class="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
          </button>
        </div>
      </div>
    </div>
  );
}