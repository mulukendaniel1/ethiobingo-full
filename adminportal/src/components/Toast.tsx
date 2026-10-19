// apps/etm-frontend/src/components/Toast.tsx
import { For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { twMerge } from 'tailwind-merge';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

const [toasts, setToasts] = createStore<ToastMessage[]>([]);
let nextId = 1;

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = nextId++;
  setToasts([...toasts, { id, type, message, duration }]);
  setTimeout(() => {
    setToasts(toasts.filter(t => t.id !== id));
  }, duration);
}

export default function ToastContainer() {
  return (
    <div class="fixed top-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
      <For each={toasts}>
        {(toast) => (
          <div
            class={twMerge(
              'pointer-events-auto min-w-[280px] max-w-sm rounded-xl border-l-4 p-4 shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-right-10 duration-300',
              toast.type === 'success' && 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-cyan-500/10',
              toast.type === 'error' && 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-500/10',
              toast.type === 'info' && 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-blue-500/10'
            )}
          >
            <div class="flex items-center gap-3">
              <div class="text-[10px] font-black uppercase tracking-widest opacity-50">{toast.type}</div>
              <div class="h-1 w-1 rounded-full bg-current opacity-30" />
              <p class="text-xs font-bold leading-relaxed tracking-tight">{toast.message}</p>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}