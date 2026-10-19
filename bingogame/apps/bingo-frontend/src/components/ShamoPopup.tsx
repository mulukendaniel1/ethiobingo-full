// apps/bingo-frontend/src/components/ShamoPopup.tsx
import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';

interface ShamoState {
  roundId: string;
  status: string;
  totalButtons: number;
  prizePerButton: number;
  claimedCount: number;
  claimedButtons: number[];
  claimedUsers: string[];
  eligibilityDepositDays: number;
  cooldownHours: number;
  startedAt?: string;
}

interface Props {
  state: ShamoState | null;
  canClaim: boolean;
  countdownSeconds: number;
  onClaim: (buttonIndex: number) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
  t: (key: string) => string;
}

export default function ShamoPopup(props: Props) {
  const [claiming, setClaiming] = createSignal<number | null>(null);
  const [error, setError] = createSignal('');
  const [, setTick] = createSignal(0);

  onMount(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    onCleanup(() => clearInterval(iv));
  });

  const isLive = () => !!props.state;
  const totalButtons = () => props.state?.totalButtons ?? 50;
  const prizePerButton = () => props.state?.prizePerButton ?? 50;
  const claimedCount = () => props.state?.claimedCount ?? 0;
  const claimedSet = () => new Set(props.state?.claimedButtons ?? []);
  const isDone = () => isLive() && claimedCount() >= totalButtons();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const hh = () => pad(Math.floor(props.countdownSeconds / 3600));
  const mm = () => pad(Math.floor((props.countdownSeconds % 3600) / 60));
  const ss = () => pad(props.countdownSeconds % 60);

  const pct = () =>
    totalButtons() > 0 ? Math.round((claimedCount() / totalButtons()) * 100) : 0;

  const handleClaim = async (idx: number) => {
    if (claiming() !== null) return;
    if (!isLive()) { setError(props.t('shamo.not_active')); return; }
    if (!props.canClaim) { setError(props.t('shamo.not_active')); return; }
    if (claimedSet().has(idx)) return;
    setClaiming(idx);
    setError('');
    const res = await props.onClaim(idx);
    setClaiming(null);
    if (!res.success) setError(res.error || props.t('shamo.claim_failed'));
  };

  return (
    <div
      class="fixed inset-0 z-[500] flex flex-col"
      style={{
        background: 'linear-gradient(180deg,#0f1424 0%,#0a0d18 100%)',
        height: '100dvh',
        'overscroll-behavior': 'none',
      }}
    >
      {/* ══ Top header: logo + close ══ */}
      <div
        class="flex-shrink-0 flex items-center justify-between px-4 pb-2"
        style={{ 'padding-top': 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      >
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#a3e635,#22c55e)' }}
          >
            <span class="text-[10px] font-black text-black">T</span>
          </div>
          <span class="text-sm font-black text-white tracking-tight">
             ETHIO<span class="text-lime-400">.GAMES</span>
          </span>
        </div>
        <button
          onClick={props.onClose}
          class="w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-300 hover:text-white active:scale-95 transition-all"
          aria-label={props.t('common.close')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ══ Title row: coin + SHA MO + countdown ══ */}
      <div class="flex-shrink-0 flex items-center justify-between px-4 pb-3">
        <div class="flex items-center gap-3">
          <div
            class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, #fef3c7 0%, #f59e0b 55%, #92400e 100%)',
              'box-shadow':
                '0 0 18px rgba(251,191,36,0.45), inset -3px -3px 8px rgba(0,0,0,0.4), inset 2px 2px 6px rgba(255,255,255,0.35)',
              opacity: isLive() ? 1 : 0.65,
            }}
          >
            <span class="text-black font-black text-[10px] tracking-wider">ሻሞ</span>
          </div>
          <div>
            <div class="text-lg font-black tracking-widest text-white leading-none">
              {props.t('shamo.title')}
            </div>
            <div class="text-[9px] font-bold tracking-[0.15em] text-gray-500 mt-1">
              {isDone() ? props.t('shamo.ended') : props.t('shamo.subtitle')}
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">
            {props.t('shamo.next_in')}
          </div>
          <div
            class="text-lg font-black tabular-nums leading-none"
            style={{ color: '#7dd3fc' }}
          >
            {hh()}:{mm()}:{ss()}
          </div>
        </div>
      </div>

      {/* ══ Progress ══ */}
      <div class="flex-shrink-0 px-4 pb-3">
        <div class="flex items-center justify-between text-[10px] font-bold mb-1.5">
          <span class="text-gray-400">
            {isLive()
              ? `${claimedCount()} / ${totalButtons()} ${props.t('shamo.boxes_opened')}`
              : props.t('shamo.pick_hint')}
          </span>
          <span class="text-cyan-400">{pct()}%</span>
        </div>
        <div class="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct()}%`,
              background: 'linear-gradient(90deg,#f59e0b,#22c55e)',
            }}
          />
        </div>
      </div>

      {/* ══ Grid header ══ */}
      <div class="flex-shrink-0 flex items-center justify-between px-4 pb-2">
        <div class="text-sm font-black text-white">
          {props.t('shamo.pick_title')}
        </div>
        <div class="text-[10px] font-black text-amber-300 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
          9:00 PM
        </div>
      </div>

      {/* ══ Scrollable grid ══ */}
      <div
        class="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
        style={{
          'overscroll-behavior': 'contain',
          'touch-action': 'pan-y',
          '-webkit-overflow-scrolling': 'touch',
          contain: 'layout style paint',
          'padding-left': '16px',
          'padding-right': '16px',
          'padding-bottom': '12px',
        }}
      >
        <div class="grid grid-cols-5 gap-2">
          <For each={Array.from({ length: totalButtons() })}>
            {(_, i) => {
              const idx = i();
              const isClaimed = () => claimedSet().has(idx);
              const isLoading = () => claiming() === idx;
              const disabled = () =>
                isClaimed() || isLoading() || !props.canClaim || !isLive();

              return (
                <button
                  onClick={() => handleClaim(idx)}
                  disabled={disabled()}
                  class="aspect-square rounded-xl flex items-center justify-center transition-all active:scale-95"
                  style={{
                    background: isClaimed()
                      ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))'
                      : 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(30,58,138,0.15))',
                    border: isClaimed()
                      ? '1px solid rgba(34,197,94,0.4)'
                      : '1px solid rgba(139,92,246,0.25)',
                    opacity: isLive() ? (isClaimed() ? 0.7 : 1) : 0.35,
                    'touch-action': 'manipulation',
                  }}
                >
                  <Show
                    when={!isClaimed()}
                    fallback={<span class="text-lime-400 text-xl">✓</span>}
                  >
                    <Show
                      when={!isLoading()}
                      fallback={
                        <div class="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      }
                    >
                      <svg
                        class="w-6 h-6 text-indigo-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                      >
                        <rect x="4" y="10" width="16" height="10" rx="1.5" />
                        <path d="M4 10h16M12 10v10M12 10c-2-3-4-3-4-1s2 2 4 1c2 1 4 1 4-1s-2-2-4 1z" />
                      </svg>
                    </Show>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>

        <Show when={!isLive()}>
          <div class="mt-4 py-3 text-center text-[11px] font-bold text-amber-300/80 bg-amber-500/5 rounded-xl border border-amber-500/20">
            🎁 {props.t('shamo.next_in')}
          </div>
        </Show>
      </div>

      {/* ══ Error ══ */}
      <Show when={error()}>
        <div class="flex-shrink-0 mx-4 mb-2 rounded-xl px-3 py-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30">
          {error()}
        </div>
      </Show>

      {/* ══ Footer ══ */}
      <div
        class="flex-shrink-0 px-4 pt-2 text-center text-[10px] text-gray-500 border-t border-white/5"
        style={{ 'padding-bottom': 'calc(env(safe-area-inset-bottom, 12px) + 8px)' }}
      >
        {prizePerButton()} ETB ·{' '}
        {props.t('shamo.prize_line').split('·')[1]?.trim() || ''}
      </div>
    </div>
  );
}