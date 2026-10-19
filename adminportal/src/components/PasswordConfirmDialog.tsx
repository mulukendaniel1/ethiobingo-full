// src/components/PasswordConfirmDialog.tsx
import { Show, createSignal } from 'solid-js';
import { showToast } from './Toast';

interface Props {
  open: boolean;
  title: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}

export default function PasswordConfirmDialog(props: Props) {
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);

const handleConfirm = async (e?: Event) => {
  e?.preventDefault();
  if (loading()) return;                              // ← NEW: block double-submit
  if (!password()) {
    showToast('Password is required', 'error');
    return;
  }
  setLoading(true);
  try {
    await props.onConfirm(password());
    setPassword('');
    props.onCancel();
  } catch (err: any) {
    // parent handles error, keep dialog open
  } finally {
    setLoading(false);
  }
};

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/60 animate-in fade-in duration-200">
        <div class="glass-dark rounded-3xl max-w-sm w-full p-8 border border-cyan-500/10 shadow-2xl scale-in-center transition-transform">
          
          <div class="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 class="text-xl font-black text-center text-white mb-2 uppercase tracking-tight">{props.title}</h2>
          <p class="text-xs text-gray-500 text-center mb-8 px-4 leading-relaxed">
            This action requires admin confirmation. Enter your security key to proceed.
          </p>

          <form onSubmit={handleConfirm} class="space-y-6">
            <div class="relative">
              <input
                type="password"
                autofocus
                placeholder="Enter security key"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-5 py-4 rounded-2xl bg-black border border-white/10 text-white text-center font-mono placeholder:text-gray-700 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
              />
            </div>

            <div class="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading()}
                class="w-full py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-gray-200 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading() ? 'Verifying…' : 'Confirm Action'}
              </button>
              <button 
                type="button"
                onClick={() => { setPassword(''); props.onCancel(); }} 
                class="w-full py-4 rounded-2xl bg-transparent text-gray-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}