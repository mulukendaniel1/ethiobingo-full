// src/pages/AdminReports.tsx
import { createSignal, createResource, Show, For, createMemo } from 'solid-js';
import { apiFetch } from '../api/client';

export default function AdminReports() {
  const [fromDate, setFromDate] = createSignal('');
  const [toDate, setToDate] = createSignal('');
  const [selectedAdminId, setSelectedAdminId] = createSignal('');
  const [admins, setAdmins] = createSignal<Array<{_id: string; username: string; firstName: string}>>([]);
  
  const fetchAdmins = async () => {
    const res = await apiFetch<{users: any[]}>('/admin/users?search=&agent=no&status=active');
    setAdmins(res.users.filter(u => u.isAdmin === true));
  };
  fetchAdmins();
  
  const [reportData, { refetch }] = createResource(
    () => ({ from: fromDate(), to: toDate(), adminId: selectedAdminId() }),
    async ({ from, to, adminId }) => {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (adminId) params.append('adminId', adminId);
      return apiFetch<{ actions: any[]; dailyDeposits: any[]; dailyWithdrawals: any[] }>(`/admin/admin-actions?${params.toString()}`);
    }
  );
  
  const dailyDepositMap = createMemo(() => {
    const map = new Map();
    reportData()?.dailyDeposits.forEach(d => map.set(d._id, d.total));
    return map;
  });
  const dailyWithdrawalMap = createMemo(() => {
    const map = new Map();
    reportData()?.dailyWithdrawals.forEach(d => map.set(d._id, d.total));
    return map;
  });
  
  return (
    <div class="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 class="text-4xl font-black tracking-tight text-white">Admin Actions Report</h1>
        <p class="text-gray-500 text-sm uppercase tracking-[0.2em] font-bold mt-1">
          Deposit confirmations & withdrawal processings by admin
        </p>
      </div>
      
      {/* Filters */}
      <div class="glass-dark rounded-2xl p-6 flex flex-wrap gap-4 items-end">
        <div class="space-y-1">
          <label class="text-[10px] uppercase font-black text-gray-500">From Date</label>
          <input type="date" value={fromDate()} onInput={(e) => setFromDate(e.currentTarget.value)} class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm" />
        </div>
        <div class="space-y-1">
          <label class="text-[10px] uppercase font-black text-gray-500">To Date</label>
          <input type="date" value={toDate()} onInput={(e) => setToDate(e.currentTarget.value)} class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm" />
        </div>
        <div class="space-y-1">
          <label class="text-[10px] uppercase font-black text-gray-500">Admin</label>
          <select value={selectedAdminId()} onInput={(e) => setSelectedAdminId(e.currentTarget.value)} class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm">
            <option value="">All Admins</option>
            <For each={admins()}>
              {(admin) => <option value={admin._id}>@{admin.username || admin.firstName}</option>}
            </For>
          </select>
        </div>
        <button onClick={() => refetch()} class="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all">
          Apply Filters
        </button>
      </div>
      
      {/* Daily Totals */}
      <Show when={!reportData.loading && reportData()}>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="glass-dark rounded-2xl p-6">
            <h2 class="text-xl font-black mb-4">Daily Deposits Confirmed</h2>
            <div class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              <For each={reportData()?.dailyDeposits}>
                {(day) => (
                  <div class="flex justify-between items-center p-2 border-b border-white/5">
                    <span class="text-sm font-mono">{day._id}</span>
                    <span class="font-bold text-cyan-400">{day.total.toFixed(2)} ETB</span>
                  </div>
                )}
              </For>
              <Show when={!reportData()?.dailyDeposits?.length}>
                <p class="text-gray-500 text-center py-4">No deposits in this period.</p>
              </Show>
            </div>
          </div>
          <div class="glass-dark rounded-2xl p-6">
            <h2 class="text-xl font-black mb-4">Daily Withdrawals Processed</h2>
            <div class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              <For each={reportData()?.dailyWithdrawals}>
                {(day) => (
                  <div class="flex justify-between items-center p-2 border-b border-white/5">
                    <span class="text-sm font-mono">{day._id}</span>
                    <span class="font-bold text-rose-400">{day.total.toFixed(2)} ETB</span>
                  </div>
                )}
              </For>
              <Show when={!reportData()?.dailyWithdrawals?.length}>
                <p class="text-gray-500 text-center py-4">No withdrawals in this period.</p>
              </Show>
            </div>
          </div>
        </div>
      </Show>
      
      {/* Actions Table */}
      <div class="glass-dark rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-white/5 border-b border-cyan-500/10">
              <tr class="text-left text-gray-400 text-xs uppercase font-black tracking-wider">
                <th class="p-4">Date & Time</th>
                <th class="p-4">Type</th>
                <th class="p-4">User</th>
                <th class="p-4">Amount</th>
                <th class="p-4">Method</th>
                <th class="p-4">Status</th>
                <th class="p-4">Admin</th>
                <th class="p-4">Request ID</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!reportData.loading} fallback={<tr><td colspan="8" class="p-8 text-center text-gray-500">Loading...</td></tr>}>
                <For each={reportData()?.actions}>
                  {(action) => (
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td class="p-4 font-mono text-xs whitespace-nowrap">{new Date(action.timestamp).toLocaleString()}</td>
                      <td class="p-4">
                        <span class={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${action.type === 'deposit' ? 'bg-cyan-500/20 text-cyan-500' : 'bg-rose-500/20 text-rose-500'}`}>
                          {action.type}
                        </span>
                      </td>
                      <td class="p-4">@{action.user?.username || action.user?.telegramId}</td>
                      <td class="p-4 font-bold">{action.amount} ETB</td>
                      <td class="p-4 uppercase text-xs">{action.method}</td>
                      <td class="p-4">
                        <span class={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          action.status === 'confirmed' || action.status === 'processed' ? 'bg-cyan-500/20 text-cyan-500' : 'bg-rose-500/20 text-rose-500'
                        }`}>
                          {action.status}
                        </span>
                      </td>
                      <td class="p-4">@{action.adminName || 'System'}</td>
                      <td class="p-4 font-mono text-xs">{action.requestId}</td>
                    </tr>
                  )}
                </For>
                <Show when={!reportData()?.actions?.length}>
                  <tr><td colspan="8" class="p-8 text-center text-gray-500">No actions found for the selected filters.</td></tr>
                </Show>
              </Show>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}