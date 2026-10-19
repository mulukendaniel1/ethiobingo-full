// src/pages/AuditLogs.tsx
import { createResource, createSignal, For, Show } from 'solid-js';
import { apiFetch } from '../api/client';

export default function AuditLogs() {
  const [filters, setFilters] = createSignal({
    page: 1,
    limit: 50,
    source: '',
    severity: '',
    actionType: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  const [selectedJson, setSelectedJson] = createSignal<any>(null);

  const [logsData] = createResource(filters, async (f) => {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
    return apiFetch<any>(`/admin/audit-logs?${params.toString()}`);
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    const totalPages = logsData()?.totalPages || 1;
    if (newPage >= 1 && newPage <= totalPages) {
      setFilters(prev => ({ ...prev, page: newPage }));
    }
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      source: '',
      severity: '',
      actionType: '',
      search: '',
      startDate: '',
      endDate: '',
    });
  };

  return (
    <div class="space-y-6 animate-in fade-in duration-500">
      <div class="flex justify-between items-end">
        <div>
          <h1 class="text-3xl font-black text-white italic uppercase tracking-tighter">
            Audit <span class="text-cyan-400">Logs</span>
          </h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">System Activity Record</p>
        </div>
        <button
          onClick={clearFilters}
          class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-[10px] font-black uppercase text-gray-400"
        >
          Clear Filters
        </button>
      </div>

      {/* Filters Grid */}
      <div class="glass-dark rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 shadow-2xl">
        <div class="lg:col-span-2">
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Search</label>
          <input
            type="text"
            placeholder="Action, ID, Tags..."
            value={filters().search}
            onInput={(e) => handleFilterChange('search', e.currentTarget.value)}
            class="w-full px-4 py-2.5 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none transition-all"
          />
        </div>
        <div>
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Source</label>
          <select
            value={filters().source}
            onChange={(e) => handleFilterChange('source', e.currentTarget.value)}
            class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
          >
            <option value="">All Sources</option>
            {['SYSTEM', 'API', 'BOT', 'CRON', 'ADMIN'].map(s => <option value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Severity</label>
          <select
            value={filters().severity}
            onChange={(e) => handleFilterChange('severity', e.currentTarget.value)}
            class="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
          >
            <option value="">All Levels</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div class="lg:col-span-2 grid grid-cols-2 gap-2">
           <div>
              <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">Start Date</label>
              <input type="date" value={filters().startDate} onInput={e => handleFilterChange('startDate', e.currentTarget.value)} class="w-full px-2 py-2.5 rounded-xl bg-black border border-white/10 text-xs" />
           </div>
           <div>
              <label class="block text-[9px] uppercase font-black text-gray-600 mb-1.5 ml-1">End Date</label>
              <input type="date" value={filters().endDate} onInput={e => handleFilterChange('endDate', e.currentTarget.value)} class="w-full px-2 py-2.5 rounded-xl bg-black border border-white/10 text-xs" />
           </div>
        </div>
      </div>

      {/* Logs Table */}
      <div class="glass-dark rounded-2xl overflow-hidden relative min-h-[400px]">
        <Show when={logsData.loading}>
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <div class="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </Show>

        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-white/[0.02] border-b border-cyan-500/10">
                <th class="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Timestamp</th>
                <th class="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Severity</th>
                <th class="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Action</th>
                <th class="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Entity</th>
                <th class="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">User</th>
                <th class="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest text-right">Details</th>
              </tr>
            </thead>
            <tbody class="text-[11px]">
              <For each={logsData()?.logs || []}>
                {(log) => (
                  <tr class="border-b border-white/[0.02] hover:bg-white/[0.03] transition-colors group">
                    <td class="p-4 whitespace-nowrap text-gray-400 font-mono italic">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td class="p-4">
                      <span class={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                        log.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        log.severity === 'ERROR' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                        log.severity === 'WARNING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                    <td class="p-4">
                      <div class="font-bold text-gray-200 uppercase tracking-tighter">{log.action}</div>
                      <div class="text-[9px] text-gray-600 font-black uppercase">{log.source} • {log.actionType}</div>
                    </td>
                    <td class="p-4 text-gray-400">
                      {log.entityType}<span class="text-gray-600 ml-1">#{log.entityId?.slice(-6)}</span>
                    </td>
                    <td class="p-4 font-medium text-gray-300">
                      {log.userTelegramId ? `@${log.userTelegramId}` : (log.userId?.username || 'SYSTEM')}
                    </td>
                    <td class="p-4 text-right">
                      <button 
                        onClick={() => setSelectedJson(log.details)}
                        class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500 hover:text-black transition-all font-black uppercase text-[9px]"
                      >
                        View JSON
                      </button>
                    </td>
                  </tr>
                )}
              </For>
              <Show when={!logsData.loading && logsData()?.logs?.length === 0}>
                <tr><td colspan="6" class="p-20 text-center text-gray-600 uppercase font-black tracking-widest text-xs">No activity logs found</td></tr>
              </Show>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div class="flex justify-between items-center glass-dark p-4 rounded-2xl">
        <div class="text-[10px] font-black uppercase text-gray-500 tracking-widest">
          Total Logs: <span class="text-white">{logsData()?.total || 0}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-black text-gray-500 uppercase">
            Page {filters().page} of {logsData()?.totalPages || 1}
          </span>
          <div class="flex gap-1">
            <button
              onClick={() => handlePageChange(filters().page - 1)}
              disabled={filters().page <= 1 || logsData.loading}
              class="p-2 rounded-xl bg-white/5 disabled:opacity-20 hover:bg-white/10 border border-white/5 transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="3" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button
              onClick={() => handlePageChange(filters().page + 1)}
              disabled={filters().page >= (logsData()?.totalPages || 1) || logsData.loading}
              class="p-2 rounded-xl bg-white/5 disabled:opacity-20 hover:bg-white/10 border border-white/5 transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="3" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* JSON Modal – glass-dark style */}
      <Show when={selectedJson()}>
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedJson(null)} />
          <div class="relative w-full max-w-2xl glass-dark rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-cyan-500/10">
            <div class="p-6 border-b border-cyan-500/10 flex justify-between items-center bg-white/[0.02]">
              <h3 class="text-xs font-black uppercase tracking-widest text-cyan-400">Log Detail Inspector</h3>
              <button onClick={() => setSelectedJson(null)} class="text-gray-500 hover:text-white transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="p-6 overflow-auto custom-scrollbar bg-black/20">
              <pre class="text-[11px] font-mono text-blue-300 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(selectedJson(), null, 4)}
              </pre>
            </div>
            <div class="p-4 border-t border-cyan-500/10 text-right bg-white/[0.02]">
              <button 
                onClick={() => setSelectedJson(null)}
                class="px-6 py-2 rounded-xl bg-cyan-500 text-black font-black uppercase text-[10px]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}