// apps/bingo-frontend/src/components/SessionExpiredBanner.tsx
import { Show } from 'solid-js';

interface SessionExpiredBannerProps {
  show: boolean;
  onDismiss: () => void;
}

export default function SessionExpiredBanner(props: SessionExpiredBannerProps) {
  const handleRedirect = () => {
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'ethio_bingoobot';
    // Clear the stored token to force a clean fresh start next time
    localStorage.removeItem('etm_token');
    window.location.href = `https://t.me/${botUsername}?start=play`;
  };

  return (
    <Show when={props.show}>
      <div class="fixed top-0 left-0 right-0 z-[10001] p-4 animate-slide-down">
        <div class="max-w-lg mx-auto overflow-hidden rounded-2xl bg-tina-berry/90 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-between p-1 pl-4">
          
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="text-[11px] font-black text-white uppercase tracking-tighter">Session Expired</span>
              <span class="text-[9px] text-white/80 font-medium leading-none">Please re-launch from Telegram</span>
            </div>
          </div>

          <button
            onClick={handleRedirect}
            class="bg-white text-tina-berry text-[10px] font-black px-5 py-3 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-sm"
          >
            RE-LAUNCH
          </button>
          
        </div>
      </div>
    </Show>
  );
}