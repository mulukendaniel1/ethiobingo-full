// apps/bingo-frontend/src/components/DuplicateSessionPopup.tsx
import { Show } from 'solid-js';

interface DuplicateSessionPopupProps {
  show: boolean;
  onClose: () => void;
}

export default function DuplicateSessionPopup(props: DuplicateSessionPopupProps) {
  const handleOpenBot = () => {
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'ethio_bingoobot';
    window.open(`https://t.me/${botUsername}?start=play`, '_blank');
    props.onClose();
  };

  return (
    <Show when={props.show}>
      <div class="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-6">
        <div class="relative max-w-sm w-full animate-bounce-in">
          {/* External Pulse Glow */}
          <div class="absolute -inset-4 rounded-full bg-bunna-berry/10 animate-pulse blur-2xl" />
          
          <div class="relative bg-gradient-to-b from-bunna-dark/95 to-black/90 backdrop-blur-2xl rounded-3xl p-8 text-center border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            
            {/* Warning Icon Container */}
            <div class="mx-auto w-20 h-20 bg-bunna-berry/10 rounded-full flex items-center justify-center mb-6 border border-bunna-berry/20">
              <svg class="w-10 h-10 text-bunna-berry animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 class="text-2xl font-black text-white tracking-tight uppercase">Session Conflict</h2>
            <div class="h-1 w-12 bg-gradient-to-r from-transparent via-bunna-berry to-transparent mx-auto my-4" />
            
            <p class="text-sm text-gray-400 mb-8 leading-relaxed">
              Your account is active in another window. To prevent data loss, this session has been paused.
            </p>

            <div class="flex flex-col gap-3">
              <button
                onClick={handleOpenBot}
                class="w-full py-4 rounded-2xl bg-gradient-to-r from-bunna-gold to-bunna-goldDark text-black font-black uppercase tracking-widest text-sm shadow-lg shadow-bunna-gold/20 active:scale-95 transition-transform"
              >
                Return to Bot
              </button>
              
              <button
                onClick={() => props.onClose()}
                class="w-full py-3 rounded-2xl bg-white/5 text-gray-400 font-bold uppercase tracking-widest text-[10px] border border-white/5 hover:bg-white/10 transition-colors"
              >
                Dismiss
              </button>
            </div>

            <p class="text-[9px] text-gray-600 mt-6 font-medium tracking-widest uppercase">
              Security Protocol Active
            </p>
          </div>
        </div>
      </div>
    </Show>
  );
}