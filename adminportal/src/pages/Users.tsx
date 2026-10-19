// src/pages/Users.tsx
import { createSignal, createResource, Show, For, createMemo } from 'solid-js';
import { useAuth } from '../context/auth';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import UserDetailModal from '../components/UserDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Users() {
  const { user } = useAuth();
  const [page, setPage] = createSignal(1);
  const [search, setSearch] = createSignal('');
  const [debouncedSearch, setDebouncedSearch] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<'all' | 'active' | 'banned'>('all');
  const [agentFilter, setAgentFilter] = createSignal<'all' | 'yes' | 'no'>('all');
  const [balanceFilter, setBalanceFilter] = createSignal<'all' | 'yes' | 'no'>('all');
  const [balanceSort, setBalanceSort] = createSignal<'none' | 'asc' | 'desc'>('none');
  const [selectedUser, setSelectedUser] = createSignal<any>(null);
  const [confirmAction, setConfirmAction] = createSignal<{ userId: string; action: 'ban' | 'unban'; reason?: string } | null>(null);

  let debounceTimeout: number;

  const handleSearchInput = (value: string) => {
    setSearch(value);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 500);
  };

  const query = createMemo(() => {
    const params = new URLSearchParams();
    params.append('page', page().toString());
    params.append('limit', '20');
    if (debouncedSearch()) params.append('search', debouncedSearch());
    if (statusFilter() !== 'all') params.append('status', statusFilter());
    if (agentFilter() !== 'all') params.append('agent', agentFilter());
    if (balanceFilter() !== 'all') params.append('balance', balanceFilter());
    if (balanceSort() !== 'none') params.append('sortBalance', balanceSort());
    return params.toString();
  });

  const [usersData, { refetch }] = createResource(
    () => user() && query(),
    (q) => apiFetch<{ users: any[]; total: number; page: number; limit: number }>(`/admin/users?${q}`)
  );

  const [globalTotals] = createResource(
    () => !!user(),
    async () => apiFetch<{ totalETBCoins: number; totalBalanceMain: number; totalLockedBalance: number }>('/admin/users/total-balances')
  );

  const executeAction = async (userId: string, action: 'ban' | 'unban', reason?: string) => {
    try {
      const endpoint = `/admin/users/${userId}/${action === 'ban' ? 'ban' : 'unban'}`;
      const options: RequestInit = { method: 'POST' };
      if (action === 'ban') {
        options.body = JSON.stringify({ reason: reason || 'Violation of terms' });
      }
      await apiFetch(endpoint, options);
      showToast(`User ${action === 'ban' ? 'banned' : 'unbanned'} successfully`, 'success');
      refetch();
    } catch (err) {
      showToast(`Failed to ${action} user`, 'error');
    }
  };

  const handleConfirm = () => {
    const action = confirmAction();
    if (!action) return;
    executeAction(action.userId, action.action, action.reason);
    setConfirmAction(null);
  };

  const displayReferrer = (user: any) => {
    if (!user.referredBy) return 'None';
    if (typeof user.referredBy === 'object' && user.referredBy !== null) {
      return user.referredBy.username ? `@${user.referredBy.username}` : user.referredBy.telegramId;
    }
    return `ID: ${user.referredBy}`;
  };

  const copyToClipboard = (text: string, message: string) => {
    if (!text || text === 'None') return;
    navigator.clipboard.writeText(text);
    showToast(message, 'info');
  };

  // ── Helpers for balance math ──────────────────────────────────
  const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const bonusOf = (u: any) => num(u.bonusBalance);
  const depositLockedOf = (u: any) =>
    Math.max(0, num(u.lockedBalance) - num(u.bonusBalance));

  return (
    <div class="p-6 max-w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Filters */}
      <div class="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 class="text-4xl font-black tracking-tight text-white mb-2">Users</h1>
          <p class="text-gray-500 text-sm uppercase tracking-widest font-semibold">
            Manage registered users
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3 bg-white/[0.02] p-2 rounded-2xl border border-cyan-500/10 backdrop-blur-md">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search users..."
              value={search()}
              onInput={(e) => handleSearchInput(e.currentTarget.value)}
              class="pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-cyan-500/50 outline-none w-64 transition-all"
            />
          </div>
          <select
            value={statusFilter()}
            onChange={(e) => setStatusFilter(e.currentTarget.value as any)}
            class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none hover:bg-white/10 transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
          <select
            value={agentFilter()}
            onChange={(e) => setAgentFilter(e.currentTarget.value as any)}
            class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none hover:bg-white/10 transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="yes">Agents Only</option>
            <option value="no">Non‑Agents</option>
          </select>

          <select
            value={balanceFilter()}
            onChange={(e) => setBalanceFilter(e.currentTarget.value as any)}
            class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none hover:bg-white/10 transition-colors"
          >
            <option value="all">All Balances</option>
            <option value="yes">Has Balance</option>
            <option value="no">No Balance</option>
          </select>

          <select
            value={balanceSort()}
            onChange={(e) => setBalanceSort(e.currentTarget.value as any)}
            class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none hover:bg-white/10 transition-colors"
          >
            <option value="none">Sort: Default</option>
            <option value="asc">Total ETB ↑</option>
            <option value="desc">Total ETB ↓</option>
          </select>
        </div>
      </div>

      {/* Global totals */}
      <Show when={!globalTotals.loading && globalTotals()}>
        <div class="grid grid-cols-3 gap-3 p-4 bg-white/[0.02] rounded-2xl border border-cyan-500/10 mb-4">
          <div class="text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest">Total ETB (all users)</p>
            <p class="text-lg font-bold text-white">{globalTotals()!.totalETBCoins.toFixed(2)}</p>
          </div>
          <div class="text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest">Locked (Bonus + Deposit)</p>
            <p class="text-lg font-bold text-amber-400">{globalTotals()!.totalLockedBalance.toFixed(2)}</p>
          </div>
          <div class="text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest">Withdrawable</p>
            <p class="text-lg font-bold text-cyan-400">{globalTotals()!.totalBalanceMain.toFixed(2)}</p>
          </div>
        </div>
      </Show>

      <Show when={!usersData.loading && usersData()} fallback={
        <div class="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
          <div class="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <p class="font-mono text-xs uppercase tracking-widest">Loading users...</p>
        </div>
      }>
        {(data) => (
          <div class="space-y-6">
            {/* ── Desktop Table ── */}
            <div class="hidden lg:block overflow-x-auto custom-scrollbar">
              <div class="bg-[#0a0a0a] rounded-[2rem] border border-cyan-500/10 shadow-2xl backdrop-blur-xl min-w-[1500px]">
                <table class="w-full">
                  <thead>
                    <tr class="bg-white/[0.02] text-gray-500 text-[10px] uppercase tracking-[0.2em] font-bold">
                      <th class="px-4 py-5 text-left">User</th>
                      <th class="px-4 py-5 text-left">Telegram ID</th>
                      <th class="px-4 py-5 text-left">Phone</th>
                      <th class="px-4 py-5 text-left">Total ETB</th>
                      <th class="px-4 py-5 text-left">Withdrawable</th>
                      <th class="px-4 py-5 text-left">Locked</th>
                      <th class="px-4 py-5 text-left">Pending W/D</th>
                      <th class="px-4 py-5 text-left">Referrals</th>
                      <th class="px-4 py-5 text-left">Earnings</th>
                      <th class="px-4 py-5 text-left">Referred By</th>
                      <th class="px-4 py-5 text-left">Last Active</th>
                      <th class="px-4 py-5 text-left">Status</th>
                      <th class="px-4 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/[0.03]">
                    <For each={data().users}>
                      {(user) => (
                        <tr class="group hover:bg-white/[0.02] transition-colors text-xs">
                          {/* User */}
                          <td class="px-4 py-4">
                            <div class="flex items-center gap-3">
                              <div class="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400/20 to-green-600/20 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/20">
                                {user.firstName?.[0] || 'U'}
                              </div>
                              <div>
                                <p class="font-bold text-sm text-white truncate max-w-[150px]" title={user.username || user.telegramId}>
                                  @{user.username || user.telegramId}
                                </p>
                                <p class="text-[10px] text-gray-500 truncate max-w-[150px]" title={`${user.firstName} ${user.lastName}`}>
                                  {user.firstName} {user.lastName}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Telegram ID */}
                          <td class="px-4 py-4">
                            <a
                              href={`https://t.me/${user.username || `+${user.telegramId}`}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="font-mono text-gray-400 hover:text-cyan-400 transition-colors"
                              title="Open in Telegram"
                            >
                              {user.telegramId}
                            </a>
                          </td>
                          {/* Phone */}
                          <td class="px-4 py-4">
                            <span
                              class={`cursor-pointer hover:text-cyan-400 transition-colors ${!user.phoneNumber ? 'opacity-50' : ''}`}
                              onClick={() => copyToClipboard(user.phoneNumber, 'Phone number copied!')}
                              title={user.phoneNumber ? 'Click to copy' : 'No phone number'}
                            >
                              {user.phoneNumber || '—'}
                            </span>
                          </td>

                          {/* Total ETB (primary) */}
                          <td class="px-4 py-4">
                            <p class="font-black text-base text-white tabular-nums">
                              {num(user.ETBCoins).toFixed(2)}
                              <span class="text-[10px] text-gray-500 ml-1 font-bold">ETB</span>
                            </p>
                            <p class="text-[9px] text-gray-500 mt-0.5 uppercase tracking-wider">withdrawable + locked</p>
                          </td>

                          {/* Withdrawable */}
                          <td class="px-4 py-4">
                            <p class="font-bold text-sm text-emerald-400 tabular-nums">
                              {num(user.balanceMain).toFixed(2)}
                              <span class="text-[10px] text-gray-500 ml-1 font-bold">ETB</span>
                            </p>
                            <p class="text-[9px] text-gray-500 mt-0.5 uppercase tracking-wider">ready</p>
                          </td>

                          {/* Locked (with bonus/deposit breakdown) */}
                          <td class="px-4 py-4">
                            <p class="font-bold text-sm text-amber-400 tabular-nums">
                              {num(user.lockedBalance).toFixed(2)}
                              <span class="text-[10px] text-gray-500 ml-1 font-bold">ETB</span>
                            </p>
                            <p class="text-[9px] text-gray-500 mt-0.5 tabular-nums">
                              <span class="text-violet-400">B {bonusOf(user).toFixed(1)}</span>
                              {' · '}
                              <span class="text-cyan-500">D {depositLockedOf(user).toFixed(1)}</span>
                            </p>
                          </td>

                          {/* Pending withdrawal hold */}
                          <td class="px-4 py-4">
                            <p class={`font-bold text-sm tabular-nums ${num(user.lockedWithdrawAmount) > 0 ? 'text-rose-400' : 'text-gray-600'}`}>
                              {num(user.lockedWithdrawAmount).toFixed(2)}
                              <span class="text-[10px] text-gray-500 ml-1 font-bold">ETB</span>
                            </p>
                            <p class="text-[9px] text-gray-500 mt-0.5 uppercase tracking-wider">on hold</p>
                          </td>

                          {/* Referrals */}
                          <td class="px-4 py-4">
                            <div class="flex items-center gap-2">
                              <span class={`w-2 h-2 rounded-full ${user.isAgent ? 'bg-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/10'}`}></span>
                              <p class="text-xs font-medium text-gray-400">{user.referralCount || 0}</p>
                            </div>
                          </td>

                          {/* Earnings */}
                          <td class="px-4 py-4 tabular-nums">{num(user.referralEarnings).toFixed(2)} ETB</td>

                          {/* Referred by */}
                          <td class="px-4 py-4 truncate max-w-[150px]" title={displayReferrer(user)}>
                            <span
                              class={displayReferrer(user) !== 'None' ? 'cursor-pointer hover:text-cyan-400 transition-colors' : ''}
                              onClick={() => copyToClipboard(displayReferrer(user), 'Referrer copied!')}
                            >
                              {displayReferrer(user)}
                            </span>
                          </td>

                          {/* Last active */}
                          <td class="px-4 py-4">
                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Inactive'}
                          </td>

                          {/* Status */}
                          <td class="px-4 py-4">
                            <span class={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase border ${
                              user.isBanned
                                ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                            }`}
                              title={user.banReason || ''}
                            >
                              {user.isBanned ? 'Banned' : 'Active'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td class="px-4 py-4 text-right">
                            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setSelectedUser(user)}
                                class="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-gray-400 uppercase tracking-tighter transition-all"
                              >
                                Details
                              </button>
                              <Show when={!user.isAdmin} fallback={
                                <span class="text-xs text-gray-500">Admin</span>
                              }>
                                {!user.isBanned ? (
                                  <button onClick={() => setConfirmAction({ userId: user._id, action: 'ban' })} class="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-tighter">Ban</button>
                                ) : (
                                  <button onClick={() => setConfirmAction({ userId: user._id, action: 'unban' })} class="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 rounded-lg text-[10px] font-black uppercase">Unban</button>
                                )}
                              </Show>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Mobile Cards ── */}
            <div class="lg:hidden space-y-4">
              <For each={data().users}>
                {(user) => (
                  <div class="glass-dark rounded-[2rem] p-6 border border-cyan-500/10 backdrop-blur-xl break-words">
                    <div class="flex justify-between items-start mb-6">
                      <div class="flex items-center gap-4">
                        <div class="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-green-600 flex items-center justify-center text-xl font-black text-black border border-cyan-500/20">
                          {user.firstName?.[0] || 'U'}
                        </div>
                        <div>
                          <p class="font-bold">@{user.username || user.telegramId}</p>
                          <p class="text-xs text-gray-500 italic">{user.telegramId}</p>
                        </div>
                      </div>
                      <span class={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        user.isBanned ? 'border-rose-500/30 text-rose-500' : 'border-cyan-500/30 text-cyan-400'
                      }`}>
                        {user.isBanned ? 'Banned' : 'Active'}
                      </span>
                    </div>

                    {/* Balance grid — 4 key numbers */}
                    <div class="grid grid-cols-2 gap-3 mb-6 p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div>
                        <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total ETB</p>
                        <p class="text-base font-black text-white tabular-nums">{num(user.ETBCoins).toFixed(2)}</p>
                        <p class="text-[8px] text-gray-600 mt-0.5">withdrawable + locked</p>
                      </div>
                      <div>
                        <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Withdrawable</p>
                        <p class="text-base font-black text-emerald-400 tabular-nums">{num(user.balanceMain).toFixed(2)}</p>
                        <p class="text-[8px] text-gray-600 mt-0.5">ready to withdraw</p>
                      </div>
                      <div>
                        <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Locked</p>
                        <p class="text-base font-black text-amber-400 tabular-nums">{num(user.lockedBalance).toFixed(2)}</p>
                        <p class="text-[8px] text-gray-600 mt-0.5 tabular-nums">
                          <span class="text-violet-400">B {bonusOf(user).toFixed(1)}</span>
                          {' · '}
                          <span class="text-cyan-500">D {depositLockedOf(user).toFixed(1)}</span>
                        </p>
                      </div>
                      <div>
                        <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Pending W/D</p>
                        <p class={`text-base font-black tabular-nums ${num(user.lockedWithdrawAmount) > 0 ? 'text-rose-400' : 'text-gray-600'}`}>
                          {num(user.lockedWithdrawAmount).toFixed(2)}
                        </p>
                        <p class="text-[8px] text-gray-600 mt-0.5">on hold</p>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                      <div><span class="text-gray-500">📞 Phone:</span>
                        <span
                          class={`ml-1 cursor-pointer hover:text-cyan-400 transition-colors ${!user.phoneNumber ? 'opacity-50' : ''}`}
                          onClick={() => copyToClipboard(user.phoneNumber, 'Phone number copied!')}
                        >
                          {user.phoneNumber || '—'}
                        </span>
                      </div>
                      <div><span class="text-gray-500">👥 Referrals:</span> {user.referralCount || 0}</div>
                      <div><span class="text-gray-500">💰 Earnings:</span> {num(user.referralEarnings).toFixed(1)} ETB</div>
                      <div><span class="text-gray-500">↳ Referred By:</span>
                        <span
                          class={`ml-1 ${displayReferrer(user) !== 'None' ? 'cursor-pointer hover:text-cyan-400 transition-colors' : ''}`}
                          onClick={() => copyToClipboard(displayReferrer(user), 'Referrer copied!')}
                        >
                          {displayReferrer(user)}
                        </span>
                      </div>
                      <Show when={user.banReason}>
                        <div class="col-span-2"><span class="text-gray-500">⚠️ Ban Reason:</span> {user.banReason}</div>
                      </Show>
                      <div><span class="text-gray-500">📅 Last Seen:</span> {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Inactive'}</div>
                    </div>

                    <div class="flex gap-2">
                      <button onClick={() => setSelectedUser(user)} class="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5">
                        Details
                      </button>
                      <Show when={!user.isAdmin} fallback={
                        <span class="text-xs text-gray-500 self-center">Admin</span>
                      }>
                        {!user.isBanned ? (
                          <button onClick={() => setConfirmAction({ userId: user._id, action: 'ban' })} class="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-tighter">Ban</button>
                        ) : (
                          <button onClick={() => setConfirmAction({ userId: user._id, action: 'unban' })} class="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 rounded-lg text-[10px] font-black uppercase">Unban</button>
                        )}
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Page totals footer — clarified labels */}
            <div class="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-2 px-4 py-3 bg-white/[0.02] rounded-xl border border-cyan-500/10 text-xs text-gray-400">
              <span>
                Page Total ETB:{' '}
                <strong class="text-white tabular-nums">
                  {data().users.reduce((s: number, u: any) => s + num(u.ETBCoins), 0).toFixed(2)}
                </strong>
              </span>
              <span>
                Locked:{' '}
                <strong class="text-amber-400 tabular-nums">
                  {data().users.reduce((s: number, u: any) => s + num(u.lockedBalance), 0).toFixed(2)}
                </strong>
              </span>
              <span>
                Withdrawable:{' '}
                <strong class="text-emerald-400 tabular-nums">
                  {data().users.reduce((s: number, u: any) => s + num(u.balanceMain), 0).toFixed(2)}
                </strong>
              </span>
              <span>
                Pending W/D:{' '}
                <strong class="text-rose-400 tabular-nums">
                  {data().users.reduce((s: number, u: any) => s + num(u.lockedWithdrawAmount), 0).toFixed(2)}
                </strong>
              </span>
            </div>

            {/* Pagination */}
            <div class="flex justify-between items-center bg-white/[0.02] p-4 rounded-[1.5rem] border border-cyan-500/10 backdrop-blur-md">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page() === 1}
                class="px-5 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-all font-bold text-sm"
              >
                ← Previous
              </button>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono text-gray-500 uppercase tracking-widest">Page</span>
                <span class="text-sm font-black text-cyan-400">{page()}</span>
                <span class="text-xs font-mono text-gray-500">of {Math.ceil(data().total / 20)}</span>
              </div>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page() * 20 >= data().total}
                class="px-5 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-all font-bold text-sm"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* User Detail Modal */}
      <Show when={selectedUser()}>
        <UserDetailModal user={selectedUser()} onClose={() => { setSelectedUser(null); refetch(); }} />
      </Show>

      {/* Ban/Unban Confirmation */}
      <ConfirmDialog
        open={!!confirmAction()}
        title={confirmAction()?.action === 'ban' ? 'Confirm Ban' : 'Confirm Unban'}
        message={
          confirmAction()?.action === 'ban'
            ? 'Are you sure you want to ban this user? They will no longer be able to use the bot.'
            : 'Are you sure you want to unban this user? They will regain access to the bot.'
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}