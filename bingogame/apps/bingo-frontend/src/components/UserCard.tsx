// apps/bingo-frontend/src/components/UserCard.tsx
import { For, createResource, Show, createMemo } from "solid-js";
import { twMerge } from "tailwind-merge";
import { getCachedCard, ensureCardsLoaded } from "../services/cardCache";

interface UserCardProps {
  cardId: number | null;
  marks: Set<number>;
  processingMarks: Set<number>;
  drawnBalls: number[];
  phase: string;
  onMarkNumber: (num: number) => void;
  isBanned: boolean;
  compact?: boolean;
}

interface CardCell {
  num: number;
  marked: boolean;
  drawn: boolean;
  processing: boolean;
}

async function loadCard(cardId: number | null) {
  if (!cardId) return null;
  await ensureCardsLoaded([cardId]);
  return getCachedCard(cardId);
}

const bingoLetters = [
  { letter: 'B', color: 'bg-tina-blue' },
  { letter: 'I', color: 'bg-tina-purple' },
  { letter: 'N', color: 'bg-tina-berry' },
  { letter: 'G', color: 'bg-tina-leaf' },
  { letter: 'O', color: 'bg-tina-orange' },
];

export default function UserCard(props: UserCardProps) {
  const [card] = createResource(() => props.cardId, loadCard);

  const cellStatus = createMemo((): CardCell[] => {
    const cardNumbers = card()?.numbers;
    if (!cardNumbers) return [];
    return cardNumbers.flat().map((num: number) => ({
      num,
      marked: num === 0 || props.marks.has(num),
      drawn: props.drawnBalls.includes(num),
      processing: props.processingMarks.has(num),
    }));
  });

  const handleCellClick = (num: number) => {
    if (props.phase !== 'game' || num === 0) return;
    const cell = cellStatus().find(c => c.num === num);
    if (!cell) return;
    if (cell.marked || !cell.drawn || cell.processing) return;
    props.onMarkNumber(num);
  };

  const isCompact = props.compact ?? false;

  return (
    <div class={twMerge(
      "flex flex-col relative overflow-hidden rounded-2xl border transition-all",
      isCompact
        ? "h-full p-2 bg-black/40 border-white/10 shadow-[0_0_12px_rgba(34,197,94,0.15)]" // emerald glow
        : "p-3 glass-premium bg-white/10 dark:bg-black/20 border-white/20"
    )}>
      {/* Banned overlay */}
      <Show when={props.isBanned && props.phase === 'game'}>
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-black/85 backdrop-blur-sm rounded-2xl">
          <div class="flex flex-col items-center gap-1 text-center px-2">
            <div class="relative">
              <div class="absolute inset-0 bg-red-600/30 blur-xl rounded-full animate-pulse" />
              <svg class={twMerge("text-red-500 drop-shadow-lg", isCompact ? "w-8 h-8" : "w-12 h-12")}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p class={twMerge("font-black uppercase text-red-400", isCompact ? "text-[9px]" : "text-sm")}>BANNED</p>
          </div>
        </div>
      </Show>

      {/* Header / Card ID */}
      <Show when={!isCompact}>
        <header class="flex justify-between items-center mb-2 flex-shrink-0">
          <h3 class="font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 text-[10px]">
            Your Card {props.cardId ? `(#${props.cardId})` : ''}
          </h3>
          <Show when={props.phase === 'game' && props.cardId && !props.isBanned}>
            <span class="text-[9px] font-bold text-emerald-500 animate-pulse">LIVE</span>
          </Show>
        </header>
      </Show>
      <Show when={isCompact}>
        <div class="flex items-center justify-center flex-shrink-0 mb-1">
          <span class="text-[8px] font-black text-indigo-400 bg-black/40 border border-indigo-400/30 px-2 py-0.5 rounded-full leading-none tracking-wider">
            Card #{props.cardId}
          </span>
        </div>
      </Show>

      <Show
        when={!card.loading && card()}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <p class="text-xs font-bold text-gray-500">Loading...</p>
          </div>
        }
      >
        {/* BINGO letters row */}
        <div class={twMerge(
          "flex justify-between flex-shrink-0",
          isCompact ? "mb-1.5 gap-1" : "mb-2 gap-1.5"
        )}>
          {bingoLetters.map((item) => (
            <div class={twMerge(
              "flex-1 flex items-center justify-center font-black text-white rounded-md shadow-sm",
              isCompact ? "h-6 text-[11px]" : "h-8 text-lg",
              item.color
            )}>
              {item.letter}
            </div>
          ))}
        </div>

        {/* Number grid */}
        <div class={twMerge(
          "grid grid-cols-5 flex-1 min-h-0",
          isCompact ? "gap-1 grid-rows-5" : "gap-1 grid-rows-5"
        )}>
          <For each={cellStatus()}>
            {(cell: CardCell) => (
              <button
                onClick={() => handleCellClick(cell.num)}
                disabled={cell.marked || !cell.drawn || cell.processing}
                class={twMerge(
                  "font-black rounded-md relative border transition-all duration-150 min-h-0",
                  isCompact
                    ? "w-full h-full text-[13px] p-0.5"
                    : "aspect-square text-base p-0.5",
                  !cell.marked && cell.num !== 0 &&
                    "bg-black/30 text-white border-white/30 shadow-sm",
                  cell.marked && cell.num !== 0 &&
                    "bg-emerald-600 !opacity-100 text-white border-emerald-700 shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-none scale-105",
                  cell.num === 0 &&
                    "bg-indigo-400 text-black border-indigo-500 dark:bg-indigo-500 shadow-[0_0_6px_rgba(34,211,238,0.4)]",
                  (!cell.marked && cell.drawn && !cell.processing && cell.num !== 0) &&
                    "cursor-pointer hover:bg-white/30 active:scale-95 ring-1 ring-white/20",
                  (cell.processing && !cell.marked) &&
                    "animate-pulse opacity-60 bg-emerald-400"
                )}
              >
                <Show when={cell.num === 0} fallback={
                  <span class="leading-none">{cell.num}</span>
                }>
                  <span class={isCompact ? "text-[11px] text-indigo-400" : "text-xs text-indigo-400"}>★</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Footer — full mode only */}
      <Show when={!isCompact}>
        <div class="mt-2 flex-shrink-0 text-gray-500 text-center text-[9px] dark:text-gray-400">
          <Show when={props.phase === 'game'} fallback="Cards available once game starts.">
            Tap called numbers to mark green.
          </Show>
        </div>
      </Show>
    </div>
  );
}