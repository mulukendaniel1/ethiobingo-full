// src/components/WinnerCardPopup.tsx
import { createSignal, onMount, Show, For } from 'solid-js';
import { apiFetch } from '../api/client';

interface WinnerCardPopupProps {
  cardId: number | null;
  drawnBalls: number[];
  onClose: () => void;
}

export default function WinnerCardPopup(props: WinnerCardPopupProps) {
  const [cardData, setCardData] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);

  const fetchCard = async () => {
    if (!props.cardId) return;
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/admin/bingo/card/${props.cardId}`);
      setCardData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchCard);

  const numbers = () => cardData()?.numbers as number[][] | undefined;
  const isMarked = (num: number) => num === 0 || props.drawnBalls.includes(num);

  return (
    <Show when={props.cardId}>
      <div class="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={props.onClose}>
        <div class="glass-dark rounded-2xl p-6 max-w-sm w-full border border-cyan-500/10" onClick={(e) => e.stopPropagation()}>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-white font-black text-lg">Winning Card #{props.cardId}</h3>
            <button onClick={props.onClose} class="text-gray-400 hover:text-white">✕</button>
          </div>
          <Show when={!loading()} fallback={<p class="text-center text-gray-400">Loading...</p>}>
            <div class="grid grid-cols-5 gap-1">
              <For each={numbers() || []}>
                {(row) => (
                  <For each={row}>
                    {(num) => (
                      <div
                        class={`aspect-square flex items-center justify-center text-xs font-bold rounded-md border ${
                          isMarked(num) ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-black/40 text-white border-white/10'
                        }`}
                      >
                        {num === 0 ? '★' : num}
                      </div>
                    )}
                  </For>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}