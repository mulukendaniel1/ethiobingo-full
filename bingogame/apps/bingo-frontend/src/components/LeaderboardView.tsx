// apps/bingo-frontend/src/components/LeaderboardView.tsx
import { createSignal, createResource, Show, For } from 'solid-js';

// Masking helper – hides all but the first 3 characters
const maskName = (name: string) => {
  if (!name) return '***';
  if (name.length <= 3) return name[0] + '*'.repeat(name.length - 1);
  return name.slice(0, 3) + '*'.repeat(name.length - 3);
};

export default function LeaderboardView(props: any) {
  const [period, setPeriod] = createSignal<'daily' | 'weekly'>('daily');

  const fetchLeaderboard = async (p: string) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/leaderboard/${p}?token=${props.token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    return res.json();
  };

  const [leaderboardData] = createResource(() => period(), fetchLeaderboard);

  return (
    <div class="h-full overflow-y-auto custom-scrollbar p-4 pb-24 max-w-md mx-auto animate-fade-in">
      <h1 class="text-2xl font-black text-gray-900 dark:text-white mb-6 px-2">{props.t('nav.leaderboard')}</h1>
      
      <div class="p-1.5 glass-premium rounded-2xl flex gap-1 mb-8 border border-white/10">
        <button 
          onClick={() => setPeriod('daily')} 
          class={`flex-1 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all ${period() === 'daily' ? 'bg-bunna-gold text-black shadow-lg shadow-bunna-gold/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
        >Daily</button>
        <button 
          onClick={() => setPeriod('weekly')} 
          class={`flex-1 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all ${period() === 'weekly' ? 'bg-bunna-gold text-black shadow-lg shadow-bunna-gold/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
        >Weekly</button>
      </div>

      <Show when={!leaderboardData.loading} fallback={<div class="flex justify-center py-12"><div class="w-8 h-8 border-4 border-bunna-gold border-t-transparent rounded-full animate-spin"></div></div>}>
        
        <Show when={leaderboardData()?.userRank}>
          <div class="mb-6 p-4 rounded-2xl bg-gradient-to-r from-bunna-gold/20 to-transparent border border-bunna-gold/30 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-bunna-gold flex items-center justify-center text-black font-black text-xs">
                {leaderboardData()?.userRank}
              </div>
              <span class="text-sm font-bold text-gray-900 dark:text-white">Your Current Position</span>
            </div>
            <span class="text-xs font-black text-bunna-gold uppercase">Level Up!</span>
          </div>
        </Show>

        <div class="space-y-2">
          <For each={leaderboardData()?.leaderboard}>
            {(entry) => (
              <div class={`flex items-center justify-between p-4 rounded-2xl glass-card-premium border ${entry.rank <= 3 ? 'border-bunna-gold/20 shadow-lg shadow-bunna-gold/5' : 'border-white/10'}`}>
                <div class="flex items-center gap-4">
                  <div class={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-lg ${
                    entry.rank === 1 ? 'bg-yellow-400 text-black' : 
                    entry.rank === 2 ? 'bg-gray-300 text-black' : 
                    entry.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {entry.rank}
                  </div>
                  <div>
                    {/* Username is now masked */}
                    <p class="text-sm font-bold text-gray-900 dark:text-white">@{maskName(entry.username)}</p>
                    <p class="text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase">Master Player</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm font-black text-bunna-gold">{entry.totalBuys}</p>
                  <p class="text-[9px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-tighter">Cards</p>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}