import { For } from 'solid-js';

interface BottomNavProps {
  active: 'game' | 'history' | 'leaderboard' | 'profile' | 'settings' | 'wallet';
  onSelect: (tab: 'game' | 'history' | 'leaderboard' | 'profile' | 'settings' | 'wallet') => void;
  t: (key: string) => string;
}

const items = [
  {
    id: 'game',
    label: 'game',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4"
          fill={active ? 'currentColor' : 'none'} fill-opacity={active ? 0.16 : 0}
          stroke="currentColor" stroke-width={active ? 2 : 1.6} />
        <path d="M8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 10v4M10 12h4"
          stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'history',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <path d="M5 7.5A8 8 0 1 1 4.2 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        <path d="M5 4v4h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M12 8v4l2.8 1.7" stroke="currentColor" stroke-width={active ? 2 : 1.7} stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'profile',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4"
          fill={active ? 'currentColor' : 'none'} fill-opacity={active ? 0.16 : 0}
          stroke="currentColor" stroke-width={active ? 2 : 1.6} />
        <path d="M5.2 20c.7-3.4 3.1-5.2 6.8-5.2s6.1 1.8 6.8 5.2"
          stroke="currentColor" stroke-width={active ? 2 : 1.6} stroke-linecap="round" />
      </svg>
    ),
  },
  {
    id: 'wallet',
    label: 'deposit',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <rect x="4.5" y="7.5" width="15" height="11" rx="3"
          fill={active ? 'currentColor' : 'none'} fill-opacity={active ? 0.16 : 0}
          stroke="currentColor" stroke-width={active ? 2 : 1.6} />
        <path d="M5 7.5V6.3A2.3 2.3 0 0 1 7.3 4h10.4A2.3 2.3 0 0 1 20 6.3v1.2"
          stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <path d="M15 13h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'settings',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <circle cx="12" cy="12" r="3.2"
          fill={active ? 'currentColor' : 'none'} fill-opacity={active ? 0.18 : 0}
          stroke="currentColor" stroke-width={active ? 2 : 1.6} />
        <path d="M19.2 13.1c.1-.7.1-1.4 0-2.1l1.5-1.2-1.8-3-1.8.7a7.7 7.7 0 0 0-1.8-1L15 4.6h-3.5l-.3 1.9c-.7.3-1.3.6-1.8 1l-1.8-.7-1.8 3 1.5 1.2a7 7 0 0 0 0 2.1l-1.5 1.2 1.8 3 1.8-.7c.5.4 1.1.7 1.8 1l.3 1.9H15l.3-1.9c.7-.3 1.3-.6 1.8-1l1.8.7 1.8-3-1.5-1.2Z"
          stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" />
      </svg>
    ),
  },
];

export default function BottomNav(props: BottomNavProps) {
  return (
    <nav class="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        class="pointer-events-auto flex items-stretch h-12 w-full max-w-xs rounded-2xl border border-indigo-500/20 bg-black/60 backdrop-blur-2xl shadow-2xl shadow-black/50"
        role="navigation"
        aria-label="Main navigation"
      >
        <For each={items}>
          {(item) => {
            const isActive = props.active === item.id;

            return (
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={props.t(`nav.${item.label}`)}
                onClick={() => props.onSelect(item.id as BottomNavProps['active'])}
                class={`relative flex flex-1 flex-col items-center justify-center gap-0.5 cursor-pointer transition-all duration-200 
                  ${isActive
                    ? 'text-indigo-300 bg-gradient-to-b from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 rounded-xl m-1 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                <span class="flex items-center justify-center w-6 h-6">
                  {item.icon(isActive)}
                </span>
                <span class="text-[8px] font-semibold uppercase tracking-wider">
                  {props.t(`nav.${item.label}`)}
                </span>
                {/* Active indicator dot */}
                <span class={`absolute bottom-0.5 w-1 h-1 rounded-full transition-opacity ${isActive ? 'bg-indigo-400 opacity-100' : 'opacity-0'}`} />
              </button>
            );
          }}
        </For>
      </div>
    </nav>
  );
}