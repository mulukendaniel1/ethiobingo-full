// src/components/ConfirmDialog.tsx
import { JSX, Show } from 'solid-js';

interface Props {
  open: boolean;
  title: string;
  message: string | JSX.Element;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog(props: Props) {
  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
        <div class="glass-dark rounded-3xl max-w-md w-full overflow-hidden border border-cyan-500/10 shadow-2xl scale-in-center">
          
          <div class="p-8">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-2 h-8 bg-cyan-500 rounded-full"></div>
              <h2 class="text-2xl font-black text-white tracking-tight uppercase">{props.title}</h2>
            </div>
            
            <div class="text-gray-400 text-sm leading-relaxed mb-8">
              {props.message}
            </div>

            <div class="flex gap-3">
              <button 
                onClick={props.onCancel} 
                class="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white font-bold text-xs uppercase transition-all"
              >
                Go Back
              </button>
              <button 
                onClick={props.onConfirm} 
                class="flex-1 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
              >
                Confirm
              </button>
            </div>
          </div>
          
          {/* Bottom decorative stripe */}
          <div class="h-1 bg-gradient-to-r from-cyan-500 via-transparent to-cyan-500 opacity-20"></div>
        </div>
      </div>
    </Show>
  );
}