//apps/bingo-frontend/src/components/ShamoBadge.tsx
import { Show } from 'solid-js';

interface Props {
  active: boolean;
  countdownSeconds: number;
  isLive: boolean;
  onOpen: () => void;
}

export default function ShamoBadge(props: Props) {
  const hh = () => Math.floor(props.countdownSeconds / 3600).toString().padStart(2, '0');
  const mm = () => Math.floor((props.countdownSeconds % 3600) / 60).toString().padStart(2, '0');
  const ss = () => (props.countdownSeconds % 60).toString().padStart(2, '0');

  return (
    <Show when={props.active}>
      <button
        onClick={props.onOpen}
        class="fixed right-3 z-[80] pointer-events-auto select-none active:scale-95 transition-transform"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 12px) + 76px)',
          filter: 'drop-shadow(0 6px 18px rgba(234,179,8,0.35))',
          'will-change': 'transform',
        }}
        aria-label="Open Shamo Giveaway"
      >
        <div
          class="relative w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg,#FBBF24 0%,#B45309 100%)',
            border: '1.5px solid rgba(255,220,100,0.6)',
            animation: 'shamoPulse 2s ease-in-out infinite',
          }}
        >
          <svg viewBox="0 0 32 32" class="w-8 h-8 text-white">
            <circle cx="16" cy="16" r="13" fill="rgba(0,0,0,0.35)" />
            <text x="16" y="20" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">
              ሻሞ
            </text>
          </svg>

          {/* 3-state pill */}
          <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black text-amber-100 bg-black/70 border border-amber-400/40 rounded-full px-2 py-[2px]">
            {props.countdownSeconds > 0 ? (
              <>{hh()}:{mm()}:{ss()}</>
            ) : props.isLive ? (
              <span class="flex items-center gap-1">
                <span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span>ሻሞ</span>
            )}
          </div>
        </div>
      </button>
      <style>{`@keyframes shamoPulse {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.06); }
      }`}</style>
    </Show>
  );
}