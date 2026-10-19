// apps/bingo-frontend/src/components/SessionExpiredPopup.tsx
import { createSignal, onCleanup, Show } from 'solid-js';

export default function SessionExpiredPopup() {
  const [show, setShow] = createSignal(false);
  const handleExpired = () => setShow(true);
  const handleClose = () => (window.location.href = '/login');

  window.addEventListener('session-expired', handleExpired);
  onCleanup(() => window.removeEventListener('session-expired', handleExpired));

  return (
    <Show when={show()}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
        <div class="glass-dark max-w-sm w-full rounded-3xl p-10 text-center border border-cyan-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          <div class="w-20 h-20 bg-cyan-500/10 border border-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span class="text-3xl text-cyan-400">⌛</span>
          </div>
          <h2 class="text-2xl font-black text-white uppercase tracking-tighter mb-2">Session <span class="text-cyan-400">Expired</span></h2>
          <p class="text-xs text-gray-400 mb-8 leading-relaxed">Your session has timed out for security. Please log in again.</p>
          <button
            onClick={handleClose}
            class="w-full py-4 rounded-2xl bg-cyan-500 text-black font-black uppercase tracking-widest text-xs hover:bg-cyan-400 transition-all active:scale-95"
          >
            Log In Again
          </button>
        </div>
      </div>
    </Show>
  );
}