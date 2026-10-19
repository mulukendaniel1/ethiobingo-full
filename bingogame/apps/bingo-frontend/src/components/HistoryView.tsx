// apps/bingo-frontend/src/components/HistoryView.tsx
import { createSignal, createResource, Show, For } from 'solid-js';

export default function HistoryView(props: any) {
  const [page, setPage] = createSignal(1);
  const limit = 10;

  const fetchHistory = async (pageNum: number) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/user/history?page=${pageNum}&limit=${limit}&token=${props.token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  };

  const [historyData] = createResource(() => page(), fetchHistory);

  // ── Custom SVG icons ──
  const PurchaseIcon = () => (
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
  const WinIcon = () => (
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );

  return (
    <div class="h-full overflow-y-auto custom-scrollbar p-4 pb-24 max-w-md mx-auto animate-fade-in">
      {/* Header */}
      <div class="flex items-center justify-between mb-6 px-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 class="text-2xl font-black text-gray-900 dark:text-white">{props.t('nav.history')}</h1>
        </div>
        <div class="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter border border-indigo-500/20 shadow-sm">
          {historyData()?.totalRounds || 0} rounds
        </div>
      </div>

      <Show when={!historyData.loading} fallback={
        <div class="flex justify-center py-12">
          <div class="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <div class="space-y-3">
          <For each={historyData()?.history}>
            {(item) => (
              <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-indigo-500/30 transition-all animate-slide-down">
                <div class="flex items-center gap-4">
                  {/* Left icon */}
                  <div class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    item.action === 'buy' 
                      ? 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30'   // ← indigo now
                      : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                  }`}>
                    {item.action === 'buy' ? <PurchaseIcon /> : <WinIcon />}
                  </div>
                  
                  {/* Details */}
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                      <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                        {item.action === 'buy' ? 'Card Purchase' : 'Round Win'}
                      </h3>
                      <span class={`text-sm font-black ${
                        item.action === 'buy' ? 'text-gray-500 dark:text-gray-400' : 'text-emerald-500 dark:text-emerald-400'
                      }`}>
                        {item.action === 'buy' ? '-' : '+'}{item.amount} ETB
                      </span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                      <span class="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">#{item.roundId.slice(-6)}</span>
                      <span class="text-[10px] text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>
          
          <Show when={historyData()?.history?.length === 0}>
            <div class="text-center py-16 bg-white/5 dark:bg-black/20 rounded-3xl border border-dashed border-white/10">
              <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" />
                </svg>
              </div>
              <p class="text-gray-500 dark:text-gray-400 font-bold">No history yet</p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">Your gaming activity will appear here</p>
            </div>
          </Show>
        </div>

        {/* Pagination */}
        <div class="flex items-center justify-between mt-8 p-1 bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page() === 1}
            class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-indigo-500/10 disabled:opacity-20 active:scale-95 transition-all"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span class="text-[10px] font-black uppercase text-indigo-400">Page {page()} / {historyData()?.totalPages || 1}</span>
          <button 
            onClick={() => setPage(p => p + 1)} 
            disabled={page() >= (historyData()?.totalPages || 1)}
            class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-indigo-500/10 disabled:opacity-20 active:scale-95 transition-all"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </Show>
    </div>
  );
}