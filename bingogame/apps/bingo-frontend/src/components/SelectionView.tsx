// apps/bingo-frontend/src/components/SelectionView.tsx
import { For, Show, createMemo } from 'solid-js';
import CardGrid from './CardGrid';
import { getCachedCard } from '../services/cardCache';
import { twMerge } from 'tailwind-merge';

interface SelectionViewProps {
  availableCards: number[];
  userCards: number[];
  onCardSelect: (cardId: number) => void;
  countdown: number;
  balance: number;
  amount: number;
  processingCard: boolean;
}

export default function SelectionView(props: SelectionViewProps) {
  const totalCards = 400;
  const availableSet = createMemo(() => new Set(props.availableCards));
  const soldCount = createMemo(() => totalCards - availableSet().size);

  return (
    <div class="flex flex-col h-full w-full">
      {/* Top stats with countdown progress bar in Time box */}
      <div class="flex-shrink-0">
        <div class="grid grid-cols-3 gap-2 mb-3">
          {/* Time box with progress bar */}
          <div class="glass-premium rounded-lg p-1.5 text-center">
            <div class="text-[8px] font-black uppercase text-gray-600 dark:text-indigo-400">Time</div>
            <div class="text-sm font-black text-gray-900 dark:text-indigo-300">{props.countdown}s</div>
            {/* Mini countdown progress bar */}
            <div class="mt-1 h-1 bg-gray-800/50 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(props.countdown / 30) * 100}%` }}
              />
            </div>
          </div>

          <div class="glass-premium rounded-lg p-1.5 text-center">
            <div class="text-[8px] font-black uppercase text-gray-600 dark:text-indigo-400">Stake</div>
            <div class="text-sm font-black text-gray-900 dark:text-indigo-300">{props.amount} ETB</div>
          </div>
          <div class="glass-premium rounded-lg p-1.5 text-center">
            <div class="text-[8px] font-black uppercase text-gray-600 dark:text-indigo-400">Balance</div>
            <div class="text-sm font-black text-gray-900 dark:text-indigo-300">{props.balance.toFixed(2)} ETB</div>
          </div>
        </div>
        <div class="h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent mb-3" />
      </div>

      {/* Card grid (unchanged) */}
      <div class="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <CardGrid
          availableCards={props.availableCards}
          currentCards={props.userCards}
          onCardSelect={props.onCardSelect}
          processingCard={props.processingCard}
        />
      </div>

      {/* Card slots with attractive animations (no separate progress bar) */}
      <div class="flex gap-2 mt-2 flex-shrink-0 items-start">
        {/* Slot 1 */}
        <div class="flex-1">
          <Show when={props.userCards.length > 0} fallback={<EmptySlot index={1} />}>
            <MiniCardPreview cardId={props.userCards[0]} onSell={() => props.onCardSelect(props.userCards[0])} />
          </Show>
        </div>

        {/* Slot 2 */}
        <div class="flex-1">
          <Show when={props.userCards.length > 1} fallback={<EmptySlot index={2} />}>
            <MiniCardPreview cardId={props.userCards[1]} onSell={() => props.onCardSelect(props.userCards[1])} />
          </Show>
        </div>
      </div>
    </div>
  );
}

// Empty slot with animated placeholder
function EmptySlot(props: { index: number }) {
  return (
    <div class="relative h-20 rounded-xl border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 overflow-hidden flex items-center justify-center animate-pulse">
      {/* Shimmer sweep */}
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[tinaSweep_2.5s_ease-in-out_infinite]" />

      <div class="flex flex-col items-center gap-1">
        <span class="text-[10px] font-bold text-indigo-400">Card {props.index}</span>
        <span class="text-[8px] text-gray-500">Tap a card above</span>
      </div>
    </div>
  );
}

// Mini card preview with glow and sell button (auto-size, full grid visible)
function MiniCardPreview(props: { cardId: number; onSell: () => void }) {
  const cardData = () => getCachedCard(props.cardId);
  const bingoLetters = [
    { letter: 'B', color: 'bg-tina-blue' },
    { letter: 'I', color: 'bg-tina-purple' },
    { letter: 'N', color: 'bg-tina-berry' },
    { letter: 'G', color: 'bg-tina-leaf' },
    { letter: 'O', color: 'bg-tina-orange' },
  ];

  return (
    <div class="relative rounded-xl bg-gradient-to-br from-indigo-500/15 to-cyan-500/10 border border-indigo-500/30 shadow-[0_0_12px_rgba(34,211,238,0.2)] overflow-hidden animate-bounce-in">
      {/* Subtle inner glow */}
      <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

      {/* Sell button */}
      <button
        onClick={(e) => { e.stopPropagation(); props.onSell(); }}
        class="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-[10px] flex items-center justify-center transition-transform hover:scale-110"
        aria-label="Sell card"
      >✕</button>

      {/* Card number badge */}
      <div class="absolute top-1 left-1.5 text-[8px] font-black text-indigo-300">#{props.cardId}</div>

      {/* Bingo letters */}
      <div class="flex justify-center gap-1 mt-3 mb-1">
        {bingoLetters.map((item) => (
          <div class={twMerge("w-6 h-4 rounded-md flex items-center justify-center font-black text-[8px] text-white shadow-sm", item.color)}>
            {item.letter}
          </div>
        ))}
      </div>

      {/* Mini numbers grid */}
      <Show when={cardData()}>
        <div class="grid grid-cols-5 gap-px max-w-[120px] mx-auto">
          <For each={cardData()!.numbers}>
            {(row: number[]) => (
              <For each={row}>
                {(num) => (
                  <div class="aspect-square flex items-center justify-center text-[7px] font-bold rounded-sm bg-black/40 text-white">
                    {num === 0 ? "★" : num}
                  </div>
                )}
              </For>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}