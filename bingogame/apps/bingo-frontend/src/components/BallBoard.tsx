// apps/bingo-frontend/src/components/BallBoard.tsx
import { For, createMemo } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface BallBoardProps {
  drawnBalls: number[];
  compact?: boolean;
}

export default function BallBoard(props: BallBoardProps) {
  const drawnSet = createMemo(() => new Set(props.drawnBalls));
  const lastBall = createMemo(() => props.drawnBalls[props.drawnBalls.length - 1]);

  const columns = [
    { letter: 'B', range: [1, 15], bgClass: 'bg-tina-blue' },
    { letter: 'I', range: [16, 30], bgClass: 'bg-tina-purple' },
    { letter: 'N', range: [31, 45], bgClass: 'bg-tina-berry' },
    { letter: 'G', range: [46, 60], bgClass: 'bg-tina-leaf' },
    { letter: 'O', range: [61, 75], bgClass: 'bg-tina-orange' },
  ];

  const isCompact = props.compact !== undefined ? props.compact : true;

  return (
    <div class={twMerge(
      "glass-premium transition-all duration-500 h-full flex flex-col",
      isCompact ? "p-2" : "p-3"
    )}>
      <div class={twMerge(
        "grid grid-cols-5 flex-1",
        isCompact ? "gap-x-1 gap-y-0.5" : "gap-x-2 gap-y-1"
      )}>
        <For each={columns}>
          {(col) => (
            <div class="flex flex-col items-center h-full">
              {/* Header box */}
              <div class={twMerge(
                "w-full text-center font-black rounded-md mb-1 flex-shrink-0",
                isCompact ? "text-[11px] py-1" : "text-base py-1.5",
                col.bgClass,
                "text-white shadow-sm border border-white/30"
              )}>
                {col.letter}
              </div>
              {/* Number cells */}
              <div class={twMerge(
                "flex flex-col w-full flex-1",
                isCompact ? "gap-0.5" : "gap-1"
              )}>
                <For each={Array.from({ length: 15 }, (_, i) => col.range[0] + i)}>
                  {(num) => {
                    const isDrawn = createMemo(() => drawnSet().has(num));
                    const isLatest = createMemo(() => num === lastBall());

                    return (
                      <div
                        class={twMerge(
                          "flex items-center justify-center font-black rounded-md transition-all duration-300 flex-1 border border-white/20",
                          isCompact 
                            ? "text-[11px]"
                            : "text-sm",
                          isDrawn()
                            ? isLatest()
                              ? "bingo-ball-3d bg-emerald-500 text-white border-white/40 animate-ball-glow text-base"
                              : "bingo-ball-3d bg-indigo-500 text-white border-white/30 text-sm"                           // other drawn: indigo
                            : "bg-white/5 backdrop-blur-sm text-gray-300"
                        )}
                      >
                        {num}
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}