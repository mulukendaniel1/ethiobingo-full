// apps/bingo-frontend/src/components/WelcomeOverlay.tsx
import { createSignal, onMount, Show } from 'solid-js';

export default function WelcomeOverlay() {
  const [show, setShow] = createSignal(false);

  onMount(() => {
    // Show on any fresh session — sessionStorage resets each browser session
    const alreadyShown = sessionStorage.getItem('tina_welcome_shown');
    if (!alreadyShown) {
      setShow(true);
      sessionStorage.setItem('tina_welcome_shown', 'true');
      // Auto-dismiss after 3s
      setTimeout(() => setShow(false), 3000);
    }
  });

  return (
    <Show when={show()}>
      <div
        class="fixed inset-0 z-[9999] overflow-hidden"
        style={{
          animation: 'arkiWelcomeFade 3s forwards',
          'pointer-events': 'none',
        }}
      >
        {/* Base atmosphere */}
        <div class="absolute inset-0 bg-black" />
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(217,160,60,0.16),transparent_34%),radial-gradient(circle_at_22%_24%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(232,121,249,0.14),transparent_26%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),transparent_68%)]" />

        {/* Drift layer */}
        <div
          class="absolute inset-0 opacity-45"
          style={{ animation: 'arkiDrift 7s linear infinite' }}
        >
          <div class="absolute left-[-12%] top-[16%] h-[2px] w-[46%] rotate-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0),rgba(34,211,238,0.65),rgba(255,255,255,0.9),rgba(217,160,60,0.55),transparent)] blur-[1px]" />
          <div class="absolute right-[-10%] top-[54%] h-[1px] w-[38%] rotate-[19deg] bg-[linear-gradient(90deg,transparent,rgba(232,121,249,0),rgba(232,121,249,0.7),rgba(255,255,255,0.82),rgba(232,121,249,0.35),transparent)] blur-[1px]" />
          <div class="absolute left-[10%] bottom-[17%] h-[1px] w-[30%] rotate-[9deg] bg-[linear-gradient(90deg,transparent,rgba(217,160,60,0),rgba(217,160,60,0.7),rgba(255,255,255,0.72),rgba(217,160,60,0.2),transparent)] blur-[1px]" />
        </div>

        {/* Floating sparks */}
        <div class="pointer-events-none absolute inset-0">
          <div
            class="absolute left-[18%] top-[30%] h-1.5 w-1.5 rounded-full bg-white/70 blur-[1px]"
            style={{ animation: 'arkiSpark 1.6s ease-in-out infinite' }}
          />
          <div
            class="absolute right-[24%] top-[22%] h-1 w-1 rounded-full bg-amber-200/80 blur-[1px]"
            style={{ animation: 'arkiSpark 1.6s ease-in-out 0.2s infinite' }}
          />
          <div
            class="absolute left-[28%] bottom-[26%] h-1 w-1 rounded-full bg-fuchsia-200/80 blur-[1px]"
            style={{ animation: 'arkiSpark 1.6s ease-in-out 0.35s infinite' }}
          />
          <div
            class="absolute right-[18%] bottom-[30%] h-1.5 w-1.5 rounded-full bg-cyan-200/70 blur-[1px]"
            style={{ animation: 'arkiSpark 1.6s ease-in-out 0.5s infinite' }}
          />
        </div>

        <div class="absolute inset-0 flex items-center justify-center">
          <div class="relative flex flex-col items-center justify-center">
            {/* Launch core */}
            <div class="relative mb-7 flex items-center justify-center">
              <div
                class="absolute h-44 w-44 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(217,160,60,0.22) 0%, rgba(217,160,60,0.12) 26%, rgba(217,160,60,0.04) 48%, transparent 72%)',
                  filter: 'blur(16px)',
                  animation: 'arkiShockwave 1.4s ease-out forwards',
                }}
              />

              <div
                class="absolute h-36 w-36 rounded-full border border-cyan-300/14"
                style={{ animation: 'arkiOrbit 1.4s ease-out forwards' }}
              />
              <div
                class="absolute h-24 w-24 rounded-full border border-fuchsia-300/20"
                style={{ animation: 'arkiOrbit 1.4s ease-out 0.08s forwards' }}
              />
              <div
                class="absolute h-14 w-14 rounded-full border border-amber-300/35"
                style={{ animation: 'arkiOrbit 1.4s ease-out 0.16s forwards' }}
              />

              <div
                class="relative flex h-20 w-20 items-center justify-center rounded-[1.4rem] border border-white/18 bg-white/7 backdrop-blur-xl"
                style={{
                  animation: 'arkiCoreIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.15s both',
                  'box-shadow':
                    'inset 0 1px 0 rgba(255,255,255,0.14), 0 0 28px rgba(217,160,60,0.24), 0 0 60px rgba(34,211,238,0.10)',
                }}
              >
                <div class="absolute inset-[0.45rem] rounded-[1.05rem] border border-white/8" />

                {/* CSS-built mini grid, no SVG */}
                <div class="grid grid-cols-3 gap-1.5">
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-amber-200/90 shadow-[0_0_8px_rgba(217,160,60,0.45)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-cyan-200/80 shadow-[0_0_8px_rgba(34,211,238,0.35)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-fuchsia-200/85 shadow-[0_0_8px_rgba(232,121,249,0.35)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.32)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-amber-300/90 shadow-[0_0_8px_rgba(217,160,60,0.45)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-cyan-300/85 shadow-[0_0_8px_rgba(34,211,238,0.40)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-fuchsia-300/80 shadow-[0_0_8px_rgba(232,121,249,0.40)]" />
                  <div class="h-2.5 w-2.5 rounded-[0.35rem] bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.28)]" />
                </div>
              </div>

              <div
                class="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                style={{
                  top: '6%',
                  right: '18%',
                  animation: 'arkiSpark 1.6s ease-in-out 0.1s infinite',
                }}
              />
              <div
                class="absolute h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(217,160,60,0.8)]"
                style={{
                  bottom: '10%',
                  left: '14%',
                  animation: 'arkiSpark 1.6s ease-in-out 0.25s infinite',
                }}
              />
            </div>

            {/* Typography */}
            <div
              class="flex flex-col items-center gap-3"
              style={{ animation: 'arkiTextIn 0.5s ease-out 0.32s both' }}
            >
              <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 backdrop-blur-md">
                <span class="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(134,239,172,0.8)]" />
                <span class="text-[10px] font-semibold uppercase tracking-[0.55em] text-white/72">
                  Welcome Back
                </span>
              </div>

              <div class="text-center">
                <div class="bg-gradient-to-r from-white via-amber-100 to-cyan-100 bg-clip-text text-3xl font-black uppercase tracking-[0.32em] text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.16)]">
                  ETHIO
                </div>
                <div class="mt-1 text-[11px] font-semibold uppercase tracking-[0.72em] text-amber-200/85">
                  Bingo STARTED
                </div>
              </div>
            </div>

            {/* Beam */}
            <div
              class="mt-8 h-[3px] w-64 overflow-hidden rounded-full bg-white/10"
              style={{
                animation: 'arkiTextIn 0.4s ease-out 0.52s both',
                'box-shadow': '0 0 24px rgba(217,160,60,0.14)',
              }}
            >
              <div
                class="h-full w-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.08) 18%, rgba(217,160,60,1) 48%, rgba(255,255,255,0.95) 50%, rgba(217,160,60,1) 52%, rgba(232,121,249,0.12) 82%, transparent 100%)',
                  animation: 'arkiBeam 1.05s ease-in-out 0.52s both',
                }}
              />
            </div>
          </div>
        </div>

        <style>{`
          @keyframes arkiWelcomeFade {
            0%   { opacity: 1; visibility: visible; }
            76%  { opacity: 1; visibility: visible; }
            100% { opacity: 0; visibility: hidden; }
          }

          @keyframes arkiOrbit {
            0%   { transform: scale(0.42); opacity: 0; }
            55%  { opacity: 1; }
            100% { transform: scale(1.08); opacity: 0.9; }
          }

          @keyframes arkiCoreIn {
            0%   { transform: scale(0.24) rotate(-16deg); opacity: 0; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }

          @keyframes arkiTextIn {
            0%   { transform: translateY(12px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }

          @keyframes arkiBeam {
            0%   { transform: translateX(-110%); }
            100% { transform: translateX(110%); }
          }

          @keyframes arkiShockwave {
            0%   { transform: scale(0.42); opacity: 0.7; }
            72%  { transform: scale(1.18); opacity: 0.18; }
            100% { transform: scale(1.5); opacity: 0; }
          }

          @keyframes arkiDrift {
            0%   { transform: translateY(0) scale(1); opacity: 0.28; }
            50%  { transform: translateY(-9px) scale(1.02); opacity: 0.38; }
            100% { transform: translateY(0) scale(1); opacity: 0.28; }
          }

          @keyframes arkiSpark {
            0%, 100% { transform: scale(0.65); opacity: 0.25; }
            50%      { transform: scale(1.35); opacity: 1; }
          }
        `}</style>
      </div>
    </Show>
  );
}