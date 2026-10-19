// apps/etm-frontend/src/components/Toast.tsx
import { createSignal, For, Show } from 'solid-js';
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

function ToastIcon({ type }: { type: ToastType }) {
  return (
    <span class="flex-shrink-0 w-5 h-5">
      {type === 'success' && (
        <svg class="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      )}
      {type === 'error' && (
        <svg class="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" stroke-linecap="round" />
          <line x1="9" y1="9" x2="15" y2="15" stroke-linecap="round" />
        </svg>
      )}
      {type === 'info' && (
        <svg class="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round" />
          <line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round" />
        </svg>
      )}
    </span>
  );
}

export default function ToastContainer() {
  return (
    <div class="fixed top-4 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
      <For each={toasts}>
        {(toast) => (
          <div
            class={twMerge(
              'pointer-events-auto min-w-[200px] max-w-sm rounded-2xl overflow-hidden backdrop-blur-xl transition-all animate-slide-down flex items-center gap-3 shadow-lg',
              toast.type === 'success' && 'bg-tina-leaf/20 border-l-4 border-tina-leaf text-white',
              toast.type === 'error'   && 'bg-tina-berry/20 border-l-4 border-tina-berry text-white',
              toast.type === 'info'    && 'bg-tina-gold/20 border-l-4 border-tina-gold text-black'
            )}
          >
            {/* left accent bar (already as border-l) */}
            <div class={twMerge(
              "pl-4 pr-2 py-3 flex items-center gap-3 w-full",
              toast.type === 'info' && 'bg-tina-gold/10'  // lighter background for info
            )}>
              <ToastIcon type={toast.type} />
              <span class="text-sm font-semibold leading-tight">{toast.message}</span>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}