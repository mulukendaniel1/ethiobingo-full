// apps/bingo-frontend/src/components/NetworkPopup.tsx
import { Show } from 'solid-js';

export default function NetworkPopup(props: { show: boolean; reason?: 'device' | 'server'; onRetry?: () => void; onClose: () => void }) {
  const handleRetry = () => {
    if (props.onRetry) props.onRetry();
    else window.location.reload();
    props.onClose();
  };

  return (
    <Show when={props.show}>
      <div class="fixed inset-0 z-[10002] flex items-center justify-center bg-black/85 backdrop-blur-xl animate-fade-in p-6">
        <div class="relative max-w-sm w-full">
          {/* Animated Gold Ring */}
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-tina-gold/5 rounded-full blur-3xl animate-pulse" />
          
          <div class="relative bg-zinc-950/50 backdrop-blur-3xl rounded-[2.5rem] p-10 text-center border border-white/5 shadow-2xl">
            <div class="relative w-24 h-24 mx-auto mb-6">
               <div class="absolute inset-0 border-2 border-tina-gold/20 rounded-full animate-[spin_10s_linear_infinite]" />
               <div class="absolute inset-2 border border-dashed border-tina-gold/40 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
               <div class="absolute inset-0 flex items-center justify-center text-4xl">📡</div>
            </div>

            <h2 class="text-2xl font-black text-white tracking-tighter mb-3">Sync Interrupted</h2>
            <p class="text-sm text-gray-400 mb-8 leading-relaxed">
              {props.reason === 'device' 
                ? 'Your connection drifted away. Please check your data or Wi-Fi.'
                : 'The grand server is taking a moment. We are attempting to re-sync.'}
            </p>

            <button
              onClick={handleRetry}
              class="group relative w-full overflow-hidden rounded-2xl bg-white p-px transition-all duration-300 hover:scale-[1.02]"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-tina-gold to-yellow-600" />
              <div class="relative flex items-center justify-center gap-2 rounded-[15px] bg-zinc-950 px-8 py-4 transition-all duration-300 group-hover:bg-transparent">
                <span class="text-xs font-black uppercase tracking-[0.2em] text-white group-hover:text-black">
                  {props.reason === 'device' ? 'Check Signal' : 'Reconnect Now'}
                </span>
              </div>
            </button>
            
            <div class="mt-6 flex items-center justify-center gap-2">
               <div class="w-1.5 h-1.5 rounded-full bg-tina-gold animate-bounce" style="animation-delay: 0s" />
               <div class="w-1.5 h-1.5 rounded-full bg-tina-gold animate-bounce" style="animation-delay: 0.2s" />
               <div class="w-1.5 h-1.5 rounded-full bg-tina-gold animate-bounce" style="animation-delay: 0.4s" />
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}