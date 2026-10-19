// apps/bingo-frontend/src/components/WinnerPopup.tsx
import { For, Show, createMemo, createSignal, onMount, onCleanup, createResource } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface WinnerPopupProps {
  winners: Array<{ userId: string; username: string; prize: number; winnerCardId?: number }>;
  drawnBalls: number[];
  onClose: () => void;
  autoCloseSeconds?: number;
}

async function fetchCard(cardId: number) {
  const engineBase = import.meta.env.VITE_ENGINE_URL || 'http://localhost:4000';
  const res = await fetch(`${engineBase}/card/${cardId}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });
  if (!res.ok) throw new Error(`Failed to fetch card ${cardId}`);
  return res.json();
}

function getWinningMask(cardNumbers: number[][], markedSet: Set<number>): boolean[][] {
  const mask = Array(5).fill(null).map(() => Array(5).fill(false));
  const isMarked = (num: number) => num === 0 || markedSet.has(num);

  // Rows
  for (let r = 0; r < 5; r++) {
    if (cardNumbers[r].every(isMarked)) {
      for (let c = 0; c < 5; c++) mask[r][c] = true;
    }
  }

  // Columns
  for (let c = 0; c < 5; c++) {
    const col = cardNumbers.map(row => row[c]);
    if (col.every(isMarked)) {
      for (let r = 0; r < 5; r++) mask[r][c] = true;
    }
  }

  // Main diagonal
  const diag1 = cardNumbers.map((row, i) => row[i]);
  if (diag1.every(isMarked)) {
    for (let i = 0; i < 5; i++) mask[i][i] = true;
  }

  // Anti diagonal
  const diag2 = cardNumbers.map((row, i) => row[4 - i]);
  if (diag2.every(isMarked)) {
    for (let i = 0; i < 5; i++) mask[i][4 - i] = true;
  }

  // Four corners
  const corners = [cardNumbers[0][0], cardNumbers[0][4], cardNumbers[4][0], cardNumbers[4][4]];
  if (corners.every(isMarked)) {
    mask[0][0] = mask[0][4] = mask[4][0] = mask[4][4] = true;
  }

  // ✅ Four-number middle column (center is free space, excluded)
  const middleColumn = [cardNumbers[0][2], cardNumbers[1][2], cardNumbers[3][2], cardNumbers[4][2]];
  if (middleColumn.every(isMarked)) {
    mask[0][2] = mask[1][2] = mask[3][2] = mask[4][2] = true;
    // Center is always marked; include it so the column looks visually complete.
    mask[2][2] = true;
  }

  return mask;
}

export default function WinnerPopup(props: WinnerPopupProps) {
  const [countdown, setCountdown] = createSignal(props.autoCloseSeconds ?? 8);
  const drawnSet = createMemo(() => new Set(props.drawnBalls));

  const winnerCardIds = () => props.winners.filter(w => w.winnerCardId !== undefined).map(w => w.winnerCardId as number);
  const [cardDataMap] = createResource(winnerCardIds, async (ids) => {
    const results = await Promise.all(ids.map(id => fetchCard(id)));
    const map = new Map<number, any>();
    ids.forEach((id, idx) => map.set(id, results[idx]));
    return map;
  });

  onMount(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          props.onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 animate-fade-in overflow-hidden">
      {/* Glow background – dual-tone gold + fuchsia celebration glow */}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-[420px] h-[420px] bg-amber-400/10 rounded-full blur-[120px] animate-pulse" />
        <div class="absolute w-[300px] h-[300px] bg-fuchsia-500/10 rounded-full blur-[110px] animate-pulse" style="animation-delay:0.4s" />
      </div>

      <div class="relative w-full max-w-2xl bg-gradient-to-b from-[#1A0E33] to-[#241541] rounded-[2rem] border border-indigo-500/20 shadow-2xl animate-bounce-in overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div class="p-6 text-center border-b border-indigo-500/10 bg-white/5 shrink-0">
          <div class="flex justify-between items-center mb-2">
            <div class="text-left">
              <p class="text-indigo-400 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                 Results
              </p>
              <h2 class="text-3xl font-black text-white uppercase tracking-tighter">
                {props.winners.length > 1 ? 'Winners list' : 'Winner'}
              </h2>
            </div>
            {/* Countdown ring – now indigo gradient */}
            <div class="relative w-14 h-14 flex items-center justify-center bg-white/5 rounded-full border-2 border-indigo-500/30 backdrop-blur-sm">
              <span class="text-lg font-black text-amber-300">{countdown()}</span>
              <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="url(#winnerGradient)" stroke-width="3"
                  stroke-dasharray={`${(countdown() / (props.autoCloseSeconds ?? 8)) * 94.2} 94.2`}
                  stroke-linecap="round" />
              </svg>
            </div>
          </div>
          {/* Animated stars */}
          <div class="flex justify-center gap-1 mt-2">
            {['🏆', '🏆', '🏆'].map((s, i) => (
              <span class="text-sm animate-bounce" style={`animation-delay:${i * 0.2}s`}>{s}</span>
            ))}
          </div>
        </div>

        {/* Winners grid */}
        <div class="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <For each={props.winners}>
              {(winner) => {
                const cardId = winner.winnerCardId;
                const cardData = () => cardId !== undefined ? cardDataMap()?.get(cardId) : undefined;
                const isLoading = () => cardDataMap.loading && !cardData();
                const winningMask = () => {
                  const data = cardData();
                  return data ? getWinningMask(data.numbers, drawnSet()) : null;
                };

                return (
                  <div class="relative bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 transition-all shadow-lg">
                    <div class="flex justify-between items-start mb-3">
                      <div class="flex flex-col">
                        <span class="text-white font-black text-sm truncate max-w-[120px] flex items-center gap-1">
                          ⭐ {winner.username || `User_${winner.userId.slice(-6)}`}
                        </span>
                        <span class="text-[10px] text-indigo-400 font-bold uppercase">Card #{cardId ?? '?'}</span>
                      </div>
                      <div class="text-amber-300 font-black text-xs">
                        +{winner.prize.toFixed(2)} ETB
                      </div>
                    </div>

                    {cardId ? (
                      <Show when={!isLoading()} fallback={
                        <div class="bg-black/40 p-2 rounded-lg text-center text-[10px] text-gray-500 animate-pulse h-24 flex items-center justify-center">
                          Loading...
                        </div>
                      }>
                        <Show when={cardData()} fallback={
                          <div class="bg-black/40 p-2 rounded-lg text-center text-[10px] text-gray-500">
                            Card data unavailable
                          </div>
                        }>
                          {(data) => (
                            <div class="grid grid-cols-5 gap-1 bg-black/40 p-2 rounded-lg border border-indigo-500/10">
                              <For each={data().numbers.flat()}>
                                {(num, idx) => {
                                  const row = Math.floor(idx() / 5);
                                  const col = idx() % 5;
                                  const isWinningCell = winningMask()?.[row][col] || false;
                                  const isMarked = num === 0 || drawnSet().has(num);
                                  return (
                                    <div class={twMerge(
                                      "aspect-square flex items-center justify-center text-[10px] font-bold rounded-sm border transition-all duration-300",
                                      isMarked && !isWinningCell && "bg-indigo-400/30 border-indigo-400 text-white shadow-[0_0_5px_rgba(34,211,238,0.5)]",
                                      isWinningCell && "bg-amber-400 border-amber-300 text-black shadow-[0_0_12px_rgba(251,191,36,0.75)] scale-105 ring-2 ring-amber-200",
                                      !isMarked && "bg-white/5 border-white/5 text-gray-500"
                                    )}>
                                      {num === 0 ? '★' : num}
                                    </div>
                                  );
                                }}
                              </For>
                            </div>
                          )}
                        </Show>
                      </Show>
                    ) : (
                      <div class="bg-black/40 p-2 rounded-lg text-center text-[10px] text-gray-500">
                        Card ID missing
                      </div>
                    )}

                    <div class="mt-2 flex items-center gap-1 opacity-80">
                      <div class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span class="text-[8px] text-white font-bold uppercase tracking-widest">Bingo Pattern</span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Footer */}
        <div class="p-4 text-center text-[10px] text-white/30 border-t border-indigo-500/10 shrink-0 flex items-center justify-center gap-2">
          <span> closed in {countdown()} seconds</span>
          <div class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
        </div>
      </div>

      {/* SVG gradient definition for countdown ring – gold celebration gradient */}
      <svg width="0" height="0">
        <defs>
          <linearGradient id="winnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FBBF24" />
            <stop offset="100%" stop-color="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}