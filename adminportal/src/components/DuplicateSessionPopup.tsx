// src/components/DuplicateSessionPopup.tsx
import { createSignal, onCleanup, Show } from 'solid-js';
import { useAuth } from '../context/auth';

export default function DuplicateSessionPopup() {
  const [show, setShow] = createSignal(false);
  const { logout } = useAuth();

  const handleDuplicate = async () => {
    await logout(); // clears local token and calls backend
    setShow(true);
  };

  window.addEventListener('duplicate-session', handleDuplicate);
  onCleanup(() => window.removeEventListener('duplicate-session', handleDuplicate));

  const handleClose = () => {
    window.location.href = '/login';
  };

  return (
    <Show when={show()}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
        <div class="glass-dark max-w-sm w-full rounded-3xl p-10 text-center border border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.1)]">
          <div class="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span class="text-3xl text-rose-400">⚠️</span>
          </div>
          <h2 class="text-2xl font-black text-white uppercase tracking-tighter mb-2">Session <span class="text-rose-400">Conflict</span></h2>
          <p class="text-xs text-gray-400 mb-8 leading-relaxed">Your account was opened in another window. For safety, this session has been closed.</p>
          <button onClick={handleClose} class="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-xs hover:bg-rose-600 transition-all">
            Go to Login
          </button>
        </div>
      </div>
    </Show>
  );
}