// apps/bingo-frontend/src/components/CardGrid.tsx
import { For } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface CardGridProps {
  availableCards: number[];
  currentCards: number[];           // was: currentCard: number | null
  onCardSelect: (cardId: number) => void;
  processingCard: boolean;
}

const ALL_CARD_IDS = Array.from({ length: 400 }, (_, i) => i + 1);

export default function CardGrid(props: CardGridProps) {
  const isAvailable = (id: number) => props.availableCards.includes(id);
  const isCurrent = (id: number) => props.currentCards.includes(id);

  return (
    <div>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-[10px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
          Available ({props.availableCards.length})
        </h3>
        <div class="text-[8px] text-gray-500 dark:text-gray-400">Tap to select</div>
      </div>
      <div class="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 xl:grid-cols-16 gap-1 max-h-[40vh] overflow-y-auto custom-scrollbar">
        <For each={ALL_CARD_IDS}>
          {(cardId) => (
            <button
              onClick={() => props.onCardSelect(cardId)}
              disabled={(!isAvailable(cardId) && !isCurrent(cardId)) || props.processingCard}
              class={twMerge(
                "aspect-square flex items-center justify-center font-bold rounded-md transition-all duration-200 text-[11px]",
                isCurrent(cardId)
                  ? "bg-indigo-500 text-white shadow-md ring-1 ring-indigo-300"
                  : isAvailable(cardId)
                  ? "bg-white/40 backdrop-blur-sm text-indigo-900 border border-white/40 hover:bg-indigo-500 hover:text-white hover:border-transparent cursor-pointer shadow-sm dark:bg-black/40 dark:text-indigo-400 dark:border-gray-700 dark:hover:bg-indigo-500 dark:hover:text-white"
                  : "bg-rose-500/20 text-rose-600 border border-rose-500/30 cursor-not-allowed dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
              )}
            >
              {cardId}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}