// apps/bingo-frontend/src/components/NetworkPopup.tsx
import { createSignal, onCleanup, Show } from 'solid-js';
import { showToast } from './Toast';

export default function NetworkPopup() {
  const [show, setShow] = createSignal(false);
  const [reason, setReason] = createSignal<'device' | 'server'>('device');

  const handleOnline = () => { setShow(false); showToast('System Online', 'success'); };
  const handleOffline = () => { setReason('device'); setShow(true); };
  const handleServerError = () => { setReason('server'); setShow(true); };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('server-error', handleServerError);

  onCleanup(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('server-error', handleServerError);
  });

  return (
    <Show when={show()}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
        <div class="glass-dark max-w-sm w-full rounded-3xl p-10 text-center border border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.1)]">
          <div class="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span class="text-3xl text-rose-400">📡</span>
          </div>
          <h2 class="text-2xl font-black text-white uppercase tracking-tighter mb-2">Connection <span class="text-rose-400">Lost</span></h2>
          <p class="text-xs text-gray-400 mb-8 leading-relaxed">
            {reason() === 'device' ? 'Your internet connection is down. Please check your network and try again.' : 'The server is not responding. We’ll try to reconnect automatically.'}
          </p>
          <button onClick={() => window.location.reload()} class="w-full py-4 rounded-2xl bg-cyan-500 text-black font-black uppercase tracking-widest text-xs hover:bg-cyan-400 transition-all">
            Retry Connection
          </button>
        </div>
      </div>
    </Show>
  );
}