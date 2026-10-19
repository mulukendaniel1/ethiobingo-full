// src/pages/Ledger.tsx
import { createResource, createSignal, For, Show, onCleanup } from 'solid-js';
import { apiFetch } from '../api/client';

export default function Ledger() {
  const [filters, setFilters] = createSignal({
    page: 1,
    limit: 50,
    userId: '',
    type: 'all',
    startDate: '',
    endDate: '',
    search: ''
  });

  const [ledgerData] = createResource(filters, async (f) => {
    const params = new URLSearchParams();
    if (f.userId) params.append('userId', f.userId);
    if (f.type && f.type !== 'all') params.append('type', f.type);
    if (f.startDate) params.append('startDate', f.startDate);
    if (f.endDate) params.append('endDate', f.endDate);
    if (f.search) params.append('search', f.search);
    params.append('page', String(f.page));
    params.append('limit', String(f.limit));
    return apiFetch<any>(`/admin/ledger?${params.toString()}`);
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <div class="space-y-6 animate-in fade-in duration-500">
      <div class="flex justify-between items-end">
        <div>
          <h1 class="text-3xl font-black text-white italic uppercase tracking-tighter">
            Ledger
          </h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Transaction History</p>
        </div>
      </div>

      {/* Filters */}
      <div class="glass-dark rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">User ID</label>
          <input
            type="text"
            placeholder="MongoDB ObjectId"
            value={filters().userId}
            onInput={(e) => handleFilterChange('userId', e.currentTarget.value)}
            class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
          />
        </div>
        <div>
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Type</label>
          <select
            value={filters().type}
            onChange={(e) => handleFilterChange('type', e.currentTarget.value)}
            class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
          >
            <option value="all">All Types</option>
            {['deposit','withdrawal_lock','withdrawal_process','withdrawal_refund','card_purchase','card_refund','win','admin_adjustment','convert_locked','agent_commission','agent_first_deposit_bonus','referral_bonus','phone_bonus'].map(t => (
              <option value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Start Date</label>
          <input type="date" value={filters().startDate} onInput={e => handleFilterChange('startDate', e.currentTarget.value)} class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm" />
        </div>
        <div>
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">End Date</label>
          <input type="date" value={filters().endDate} onInput={e => handleFilterChange('endDate', e.currentTarget.value)} class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Search (Reference / Notes)</label>
          <input
            type="text"
            placeholder="Search..."
            value={filters().search}
            onInput={(e) => handleFilterChange('search', e.currentTarget.value)}
            class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div class="glass-dark rounded-2xl overflow-hidden">
        <Show when={!ledgerData.loading} fallback={
          <div class="p-10 text-center text-gray-500">Loading...</div>
        }>
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-cyan-500/10 text-gray-400 uppercase">
                <tr>
                  <th class="p-4">Date</th>
                  <th class="p-4">User</th>
                  <th class="p-4">Type</th>
                  <th class="p-4">Amount</th>
                  <th class="p-4">Balance After</th>
                  <th class="p-4">Reference</th>
                  <th class="p-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                <For each={ledgerData()?.entries || []}>
                  {(entry) => (
                    <tr class="border-b border-white/5 hover:bg-white/5">
                      <td class="p-4 whitespace-nowrap text-gray-400 font-mono">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td class="p-4 text-white">
                        {entry.userId?.username ? `@${entry.userId.username}` : entry.userId?.telegramId || entry.userId}
                      </td>
                      <td class="p-4">
                        <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {entry.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td class={`p-4 font-bold ${entry.amount >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount.toFixed(2)}
                      </td>
                      <td class="p-4 text-white">{entry.balanceAfter.toFixed(2)}</td>
                      <td class="p-4 font-mono text-gray-400 truncate max-w-[150px]">{entry.referenceId || '—'}</td>
                      <td class="p-4 text-gray-500 max-w-[200px] truncate">{entry.notes || '—'}</td>
                    </tr>
                  )}
                </For>
                <Show when={!ledgerData()?.entries?.length}>
                  <tr><td colspan="7" class="p-10 text-center text-gray-500">No transactions found.</td></tr>
                </Show>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div class="flex justify-between items-center p-4 border-t border-cyan-500/10">
            <span class="text-xs text-gray-400">Total: {ledgerData()?.total || 0}</span>
            <div class="flex gap-2">
              <button
                onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
                disabled={filters().page <= 1}
                class="px-4 py-2 rounded-xl bg-white/5 disabled:opacity-20 hover:bg-white/10 text-xs font-bold"
              >
                ← Prev
              </button>
              <span class="text-xs text-gray-400 self-center">
                Page {filters().page} of {ledgerData()?.totalPages || 1}
              </span>
              <button
                onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
                disabled={filters().page >= (ledgerData()?.totalPages || 1)}
                class="px-4 py-2 rounded-xl bg-white/5 disabled:opacity-20 hover:bg-white/10 text-xs font-bold"
              >
                Next →
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}