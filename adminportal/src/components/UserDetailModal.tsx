// src/components/UserDetailModal.tsx
import { Show, createSignal, createResource, For, createEffect, onMount, onCleanup } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from './Toast';
import PasswordConfirmDialog from './PasswordConfirmDialog';

interface Transaction {
  type: 'deposit' | 'withdrawal';
  requestId: string;
  amount: number;
  method: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'processed';
  transactionId?: string;
  accountDetails?: string;
  destinationDetails?: string;
  createdAt: string;
  adminNotes?: string;
  senderName?: string;
  receiverName?: string;
  extractedAmount?: number;
  extractedDate?: string;
  receiptLink?: string;
}

interface Bet {
  _id: string;
  userId: string;
  roundId: string;
  cardId?: string;
  action: 'buy' | 'win';
  amount: number;
  createdAt: string;
}

export default function UserDetailModal(props: { user: any; onClose: () => void }) {
  const [activeTab, setActiveTab] = createSignal<'deposits' | 'withdrawals' | 'game' | 'bonus'>('deposits');
  const [search, setSearch] = createSignal('');
  const [debouncedSearch, setDebouncedSearch] = createSignal('');
  const [typeFilter, setTypeFilter] = createSignal<'all' | 'deposit' | 'withdrawal'>('all');
  const [fromDate, setFromDate] = createSignal('');
  const [toDate, setToDate] = createSignal('');
  const [showAdjustModal, setShowAdjustModal] = createSignal(false);
  const [adjustingBalance, setAdjustingBalance] = createSignal(false);
  const [adjustAmount, setAdjustAmount] = createSignal(0);
  const [convertAmount, setConvertAmount] = createSignal(0);
  const [convertingLocked, setConvertingLocked] = createSignal(false);
  const [showConvertInput, setShowConvertInput] = createSignal(false);
  const [betPage, setBetPage] = createSignal(1);
  const [betSearch, setBetSearch] = createSignal('');
  const [debouncedBetSearch, setDebouncedBetSearch] = createSignal('');

  const [adjustPasswordConfirm, setAdjustPasswordConfirm] = createSignal<{
    open: boolean;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, onConfirm: async () => {} });

  const [convertPasswordConfirm, setConvertPasswordConfirm] = createSignal<{
    open: boolean;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, onConfirm: async () => {} });

  let scrollableContainerRef: HTMLDivElement | undefined;
  let debounceTimeout: number;
  let betDebounceTimeout: number;

  const [fullUser, { refetch: refetchFullUser }] = createResource(
    () => props.user._id,
    async (userId) => {
      return apiFetch<{ ETBCoinTransactions: any[] }>(`/admin/users/${userId}`);
    }
  );

  createEffect(() => {
    if (props.user._id) {
      refetchFullUser();
    }
  });

  const handleSearchInput = (value: string) => {
    setSearch(value);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => setDebouncedSearch(value), 500);
  };

  const handleBetSearchInput = (value: string) => {
    setBetSearch(value);
    if (betDebounceTimeout) clearTimeout(betDebounceTimeout);
    betDebounceTimeout = setTimeout(() => {
      setDebouncedBetSearch(value);
      setBetPage(1);
    }, 500);
  };

  onCleanup(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (betDebounceTimeout) clearTimeout(betDebounceTimeout);
  });

  onMount(() => {
    document.body.style.overflow = 'hidden';
    if (scrollableContainerRef) scrollableContainerRef.scrollTop = 0;
  });
  onCleanup(() => {
    document.body.style.overflow = 'auto';
  });

  const [transactions, { refetch: refetchTransactions }] = createResource(
    () => ({ userId: props.user._id, search: debouncedSearch(), type: typeFilter(), from: fromDate(), to: toDate() }),
    async ({ userId, search, type, from, to }) => {
      const params = new URLSearchParams();
      if (type !== 'all') params.append('type', type);
      if (search) params.append('search', search);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      return apiFetch<{ transactions: Transaction[]; count: number }>(`/admin/users/${userId}/transactions?${params.toString()}`);
    }
  );

  const [betHistory, { refetch: refetchBetHistory }] = createResource(
    () => ({ userId: props.user._id, search: debouncedBetSearch(), page: betPage() }),
    async ({ userId, search, page }) => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      return apiFetch<{ bets: Bet[]; total: number; page: number; limit: number }>(`/admin/users/${userId}/bet-history?${params.toString()}`);
    }
  );

  createEffect(() => {
    if (props.user._id) {
      refetchTransactions();
      refetchBetHistory();
    }
  });

  const triggerAdjustBalance = () => {
    if (adjustAmount() === 0) {
      showToast('Amount cannot be zero', 'error');
      return;
    }
    setAdjustPasswordConfirm({
      open: true,
      onConfirm: async (password: string) => {
        await performAdjustBalance(password);
      }
    });
  };

  const performAdjustBalance = async (settingsPassword: string) => {
    setAdjustingBalance(true);
    try {
      await apiFetch(`/admin/users/${props.user._id}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: adjustAmount(), settingsPassword }),
      });
      showToast('Balance adjusted successfully', 'success');
      setShowAdjustModal(false);
      props.onClose();
    } catch (err) {
      showToast('Failed to adjust balance', 'error');
    } finally {
      setAdjustingBalance(false);
      setAdjustAmount(0);
    }
  };

  const triggerConvertLocked = () => {
    if (!convertAmount() || convertAmount() <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    if (convertAmount() > (props.user.lockedBalance || 0)) {
      showToast(`Cannot exceed locked balance (${props.user.lockedBalance})`, 'error');
      return;
    }
    setConvertPasswordConfirm({
      open: true,
      onConfirm: async (password: string) => {
        await performConvertLocked(password);
      }
    });
  };

  const performConvertLocked = async (settingsPassword: string) => {
    setConvertingLocked(true);
    try {
      await apiFetch('/admin/users/convert-locked', {
        method: 'POST',
        body: JSON.stringify({ telegramId: props.user.telegramId, amount: convertAmount(), settingsPassword }),
      });
      showToast(`Converted ${convertAmount()} ETB successfully`, 'success');
      props.onClose();
    } catch (err: any) {
      showToast(err.message || 'Conversion failed', 'error');
    } finally {
      setConvertingLocked(false);
      setConvertAmount(0);
      setShowConvertInput(false);
    }
  };

  const getStatusStyle = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      confirmed: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      processed: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  // ── Numeric helpers ──────────────────────────────────────────
  const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const totalETB = () => num(props.user.ETBCoins);
  const withdrawable = () => num(props.user.balanceMain);
  const lockedTotal = () => num(props.user.lockedBalance);
  const bonusLocked = () => num(props.user.bonusBalance);
  const depositLocked = () => Math.max(0, lockedTotal() - bonusLocked());
  const pendingWD = () => num(props.user.lockedWithdrawAmount);

  return (
    <div class="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md p-0 md:p-4 flex items-center justify-center overflow-y-auto">
      <div class="glass-dark w-full max-w-6xl h-full md:h-[85vh] max-h-screen flex flex-col border-x md:border border-cyan-500/10 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div class="sticky top-0 z-20 flex justify-between items-center p-4 md:p-6 border-b border-cyan-500/10 bg-[#0a0a0a]/90 backdrop-blur-md shrink-0">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-tr from-cyan-400 to-green-600 flex items-center justify-center text-lg font-bold text-black">
              {props.user.firstName?.[0] || 'U'}
            </div>
            <div>
              <h2 class="text-lg md:text-xl font-bold tracking-tight text-white">User Details</h2>
              <p class="text-[10px] text-gray-500 font-mono">ID: {props.user._id}</p>
            </div>
          </div>
          <button onClick={props.onClose} class="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar" ref={scrollableContainerRef}>
          <div class="flex flex-col md:flex-row">
            {/* ════════════ Left Sidebar ════════════ */}
            <div class="w-full md:w-80 border-b md:border-b-0 md:border-r border-cyan-500/10 bg-white/[0.01] p-5 md:p-6 flex flex-col gap-5 shrink-0">

              {/* Identity block */}
              <section class="space-y-3">
                <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Username</p>
                  <p class="font-medium text-cyan-400 text-sm truncate">@{props.user.username || 'N/A'}</p>
                </div>
                <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Full Name</p>
                  <p class="font-medium text-sm">{props.user.firstName} {props.user.lastName}</p>
                </div>
                <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Telegram ID</p>
                  <p class="font-mono text-sm">{props.user.telegramId}</p>
                </div>
                <div
                  class="bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => copyToClipboard(props.user.phoneNumber || '')}
                >
                  <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Phone Number</p>
                  <p class="font-mono text-sm">{props.user.phoneNumber || 'Not provided'}</p>
                </div>
              </section>

              {/* ════════════ Balance breakdown ════════════ */}
              <section class="space-y-3">
                <div class="text-[10px] font-black uppercase tracking-widest text-cyan-400/70 border-b border-white/5 pb-2">
                  Balances
                </div>

                {/* Total — the single source of truth */}
                <div class="bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-4 rounded-2xl border border-cyan-500/25">
                  <p class="text-[10px] text-cyan-300 uppercase font-bold tracking-widest">Total ETB</p>
                  <p class="text-3xl font-black text-white tabular-nums leading-tight">
                    {totalETB().toFixed(2)}
                  </p>
                  <p class="text-[9px] text-gray-400 mt-1 tabular-nums">
                    = withdrawable + locked
                  </p>
                </div>

                {/* Withdrawable */}
                <div class="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                  <div class="flex items-center justify-between">
                    <p class="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">Withdrawable</p>
                    <span class="text-[8px] text-emerald-300/70 font-mono">balanceMain</span>
                  </div>
                  <p class="text-2xl font-black text-emerald-400 tabular-nums leading-tight">
                    {withdrawable().toFixed(2)}
                  </p>
                  <p class="text-[9px] text-gray-500 mt-1">Ready to withdraw</p>
                </div>

                {/* Locked — with split */}
                <div class="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                  <div class="flex items-center justify-between">
                    <p class="text-[10px] text-amber-400 uppercase font-bold tracking-widest">Locked</p>
                    <span class="text-[8px] text-amber-300/70 font-mono">lockedBalance</span>
                  </div>
                  <p class="text-2xl font-black text-amber-400 tabular-nums leading-tight">
                    {lockedTotal().toFixed(2)}
                  </p>
                  <div class="mt-2 pt-2 border-t border-amber-500/15 grid grid-cols-2 gap-2 text-[9px]">
                    <div>
                      <div class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                        <span class="text-violet-300 font-bold uppercase tracking-wider">Bonus</span>
                      </div>
                      <p class="text-violet-400 font-black tabular-nums text-xs mt-0.5">
                        {bonusLocked().toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <div class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span class="text-cyan-300 font-bold uppercase tracking-wider">Deposit</span>
                      </div>
                      <p class="text-cyan-400 font-black tabular-nums text-xs mt-0.5">
                        {depositLocked().toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pending withdrawal hold */}
                <div class={`p-4 rounded-2xl border ${pendingWD() > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/5'}`}>
                  <div class="flex items-center justify-between">
                    <p class={`text-[10px] uppercase font-bold tracking-widest ${pendingWD() > 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                      Pending W/D
                    </p>
                    <span class="text-[8px] text-gray-400 font-mono">lockedWithdrawAmount</span>
                  </div>
                  <p class={`text-xl font-black tabular-nums leading-tight ${pendingWD() > 0 ? 'text-rose-400' : 'text-gray-600'}`}>
                    {pendingWD().toFixed(2)}
                  </p>
                  <p class="text-[9px] text-gray-500 mt-1">
                    {pendingWD() > 0 ? 'Held for admin processing' : 'No pending withdrawal'}
                  </p>
                </div>
              </section>

              {/* Actions */}
              <button onClick={() => setShowAdjustModal(true)} class="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-all shadow-lg shadow-cyan-500/20">
                Adjust Balance
              </button>

              <div class="space-y-2">
                <button onClick={() => setShowConvertInput(!showConvertInput())} class="w-full py-2 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold transition-all border border-amber-500/20">
                  Unlock Bonus Funds
                </button>
                <Show when={showConvertInput()}>
                  <div class="flex gap-2 mt-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={convertAmount()}
                      onInput={(e) => setConvertAmount(parseFloat(e.currentTarget.value) || 0)}
                      class="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
                    />
                    <button onClick={triggerConvertLocked} disabled={convertingLocked()} class="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs disabled:opacity-50">
                      {convertingLocked() ? 'Unlocking...' : 'Confirm'}
                    </button>
                  </div>
                </Show>
              </div>
            </div>

            {/* ════════════ Right Content ════════════ */}
            <div class="flex-1 flex flex-col min-h-0">
              {/* Tabs */}
              <div class="flex px-4 border-b border-cyan-500/10 bg-white/[0.01] overflow-x-auto shrink-0">
                <For each={['deposits', 'withdrawals', 'game', 'bonus']}>
                  {(tab) => (
                    <button
                      onClick={() => setActiveTab(tab as any)}
                      class={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all relative whitespace-nowrap ${
                        activeTab() === tab ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {tab === 'bonus' ? 'Bonus History' : tab}
                      {activeTab() === tab && <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                    </button>
                  )}
                </For>
              </div>

              {/* Filters (not for game or bonus) */}
              <Show when={activeTab() !== 'game' && activeTab() !== 'bonus'}>
                <div class="p-4 flex gap-3 items-center bg-white/[0.01] flex-wrap shrink-0">
                  <div class="relative flex-1 min-w-[200px]">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
                    <input type="text" placeholder="Search by request ID, transaction ID, or destination..." onInput={(e) => handleSearchInput(e.currentTarget.value)} class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-cyan-500/50 outline-none transition-all" />
                  </div>
                  <select value={typeFilter()} onChange={(e) => setTypeFilter(e.currentTarget.value as any)} class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none hover:border-white/20 transition-all">
                    <option value="all">All Types</option>
                    <option value="deposit">Deposits</option>
                    <option value="withdrawal">Withdrawals</option>
                  </select>
                  <input type="date" onInput={(e) => setFromDate(e.currentTarget.value)} class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none hover:border-white/20 transition-all" />
                  <input type="date" onInput={(e) => setToDate(e.currentTarget.value)} class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none hover:border-white/20 transition-all" />
                </div>
              </Show>

              <Show when={activeTab() === 'game'}>
                <div class="p-4 flex gap-3 items-center bg-white/[0.01] flex-wrap shrink-0">
                  <div class="relative flex-1 min-w-[200px]">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
                    <input type="text" placeholder="Search by round ID or card ID..." onInput={(e) => handleBetSearchInput(e.currentTarget.value)} class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-cyan-500/50 outline-none transition-all" />
                  </div>
                </div>
              </Show>

              {/* Content Area */}
              <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {/* Deposits / Withdrawals */}
                <Show when={activeTab() !== 'game' && activeTab() !== 'bonus'}>
                  <Show when={!transactions.loading} fallback={<div class="flex flex-col items-center justify-center h-full space-y-4 text-gray-500"><div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div><p class="text-xs">Loading transactions...</p></div>}>
                    <div class="space-y-3">
                      <For each={transactions()?.transactions.filter(t => activeTab().startsWith(t.type))}>
                        {(tx) => (
                          <div class="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 p-4 rounded-xl transition-all">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                              <div class="flex items-center gap-3">
                                <div class={`h-10 w-10 rounded-lg flex items-center justify-center text-sm ${tx.type === 'deposit' ? 'bg-cyan-500/20 text-cyan-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                  {tx.type === 'deposit' ? '↓' : '↑'}
                                </div>
                                <div>
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-base">{tx.amount} ETB</span>
                                    <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-gray-400 uppercase tracking-tighter font-mono">{tx.method}</span>
                                  </div>
                                  <p class="text-[10px] text-gray-500 mt-1 font-mono uppercase tracking-widest cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => copyToClipboard(tx.requestId)}>{tx.requestId}</p>
                                </div>
                              </div>
                              <div class="text-right">
                                <span class={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-bold border uppercase ${getStatusStyle(tx.status)}`}>{tx.status}</span>
                                <p class="text-[9px] text-gray-600 mt-1 font-medium">{new Date(tx.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                            {tx.adminNotes && <p class="text-xs text-gray-400 mt-2 border-t border-white/5 pt-2">📝 {tx.adminNotes}</p>}
                          </div>
                        )}
                      </For>
                      <Show when={transactions()?.transactions.filter(t => activeTab().startsWith(t.type)).length === 0}>
                        <div class="text-center py-12 text-gray-500"><p class="text-4xl mb-2">📭</p><p class="text-sm">No {activeTab()} found.</p></div>
                      </Show>
                    </div>
                  </Show>
                </Show>

                {/* Game History */}
                <Show when={activeTab() === 'game'}>
                  <Show when={!betHistory.loading} fallback={<div class="flex flex-col items-center justify-center h-full space-y-4 text-gray-500"><div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div><p class="text-xs">Loading bet history...</p></div>}>
                    <div class="space-y-3">
                      <For each={betHistory()?.bets}>
                        {(bet) => (
                          <div class="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 p-4 rounded-xl transition-all">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                              <div class="flex items-center gap-3">
                                <div class={`h-10 w-10 rounded-lg flex items-center justify-center text-sm ${bet.action === 'buy' ? 'bg-amber-500/20 text-amber-500' : 'bg-cyan-500/20 text-cyan-500'}`}>
                                  {bet.action === 'buy' ? '🃏' : '🏆'}
                                </div>
                                <div>
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-base">{bet.amount} ETB</span>
                                    <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-gray-400 uppercase tracking-tighter font-mono">{bet.action === 'buy' ? 'Card Purchase' : 'Win'}</span>
                                  </div>
                                  <div class="flex gap-2 text-[10px] text-gray-500 mt-1">
                                    <span class="font-mono">Round: <span class="cursor-pointer hover:text-cyan-400" onClick={() => copyToClipboard(bet.roundId)}>{bet.roundId.slice(-6)}</span></span>
                                    {bet.cardId && <span class="font-mono">Card: <span class="cursor-pointer hover:text-cyan-400" onClick={() => copyToClipboard(bet.cardId!)}>{bet.cardId}</span></span>}
                                  </div>
                                </div>
                              </div>
                              <div class="text-right"><p class="text-[9px] text-gray-600 font-medium">{new Date(bet.createdAt).toLocaleString()}</p></div>
                            </div>
                          </div>
                        )}
                      </For>
                      <Show when={betHistory()?.bets.length === 0}>
                        <div class="text-center py-12 text-gray-500"><p class="text-4xl mb-2">🎮</p><p class="text-sm">No game history found.</p></div>
                      </Show>
                      <div class="flex justify-between items-center bg-white/[0.02] p-4 rounded-[1.5rem] border border-white/5 mt-4">
                        <button onClick={() => setBetPage(p => Math.max(1, p - 1))} disabled={betPage() === 1} class="px-5 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-all font-bold text-sm">← Previous</button>
                        <div class="flex items-center gap-2"><span class="text-xs font-mono text-gray-500 uppercase tracking-widest">Page</span><span class="text-sm font-black text-cyan-400">{betPage()}</span><span class="text-xs font-mono text-gray-500">of {Math.ceil((betHistory()?.total || 0) / 20)}</span></div>
                        <button onClick={() => setBetPage(p => p + 1)} disabled={betPage() * 20 >= (betHistory()?.total || 0)} class="px-5 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-all font-bold text-sm">Next →</button>
                      </div>
                    </div>
                  </Show>
                </Show>

                {/* Bonus History */}
                <Show when={activeTab() === 'bonus'}>
                  <Show when={!fullUser.loading} fallback={<div class="flex flex-col items-center justify-center h-full space-y-4 text-gray-500"><div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div><p class="text-xs">Loading bonus history...</p></div>}>
                    <div class="space-y-3">
                      <For each={fullUser()?.ETBCoinTransactions?.slice().reverse()}>
                        {(tx) => (
                          <div class="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 p-4 rounded-xl transition-all">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                              <div class="flex items-center gap-3">
                                <div class={`h-10 w-10 rounded-lg flex items-center justify-center text-sm ${
                                  tx.type === 'earned' ? 'bg-cyan-500/20 text-cyan-500' :
                                  tx.type === 'redeemed' ? 'bg-rose-500/20 text-rose-500' :
                                  'bg-blue-500/20 text-blue-500'
                                }`}>
                                  {tx.type === 'earned' ? '➕' : tx.type === 'redeemed' ? '➖' : '🔄'}
                                </div>
                                <div>
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-base">{tx.amount} ETB</span>
                                    <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-gray-400 uppercase tracking-tighter font-mono">{tx.type}</span>
                                  </div>
                                  <p class="text-[10px] text-gray-500 mt-1 font-mono uppercase tracking-widest cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => copyToClipboard(tx.reference)}>{tx.reference}</p>
                                </div>
                              </div>
                              <div class="text-right">
                                <p class="text-[9px] text-gray-600 font-medium">{new Date(tx.timestamp).toLocaleString()}</p>
                                <p class="text-[9px] text-gray-500 max-w-[200px] truncate">{tx.notes || ''}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                      <Show when={!fullUser()?.ETBCoinTransactions?.length}>
                        <div class="text-center py-12 text-gray-500"><p class="text-4xl mb-2">📜</p><p class="text-sm">No bonus transactions yet.</p></div>
                      </Show>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Adjustment Modal */}
      <Show when={showAdjustModal()}>
        <div class="fixed inset-0 z-[101] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div class="glass-dark rounded-2xl w-full max-w-sm p-6 text-center border border-cyan-500/10">
            <div class="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚡</div>
            <h3 class="text-xl font-black mb-2">Adjust Balance</h3>
            <p class="text-xs text-gray-500 mb-6">Enter amount (positive to add, negative to subtract).</p>
            <input type="number" placeholder="0.00" onInput={(e) => setAdjustAmount(parseFloat(e.currentTarget.value) || 0)} class="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-center text-xl font-black text-cyan-400 outline-none focus:border-cyan-500 mb-6" />
            <div class="flex gap-3">
              <button onClick={() => setShowAdjustModal(false)} class="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold">Cancel</button>
              <button onClick={triggerAdjustBalance} disabled={adjustingBalance()} class="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {adjustingBalance() ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <PasswordConfirmDialog
        open={adjustPasswordConfirm().open}
        title="Confirm Balance Adjustment"
        onConfirm={adjustPasswordConfirm().onConfirm}
        onCancel={() => setAdjustPasswordConfirm({ open: false, onConfirm: async () => {} })}
      />

      <PasswordConfirmDialog
        open={convertPasswordConfirm().open}
        title="Confirm Bonus Unlock"
        onConfirm={convertPasswordConfirm().onConfirm}
        onCancel={() => setConvertPasswordConfirm({ open: false, onConfirm: async () => {} })}
      />
    </div>
  );
}