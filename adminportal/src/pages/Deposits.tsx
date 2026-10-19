// src/pages/Deposits.tsx
import { createResource, For, Show, createSignal, onCleanup } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/auth';

export default function Deposits() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = createSignal('pending');
  const [search, setSearch] = createSignal('');
  const [debouncedSearch, setDebouncedSearch] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [selected, setSelected] = createSignal<{ requestId: string; action: 'confirm' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = createSignal('');
  const [confirmingId, setConfirmingId] = createSignal<string | null>(null);
  const [rejectingId, setRejectingId] = createSignal<string | null>(null);
  const [confirmWarningRequest, setConfirmWarningRequest] = createSignal<string | null>(null);

  let debounceTimeout: number;

  const handleSearchInput = (value: string) => {
    setSearch(value);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 500);
  };

  onCleanup(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
  });

  const [depositsData, { refetch }] = createResource(
    () => ({ user: user(), status: statusFilter(), page: page(), search: debouncedSearch() }),
    async ({ status, page, search }) => {
      const params = new URLSearchParams();
      params.append('status', status);
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      return apiFetch<{ deposits: any[]; total: number; page: number; limit: number }>(`/admin/deposits?${params.toString()}`);
    }
  );

  const handleConfirm = async (requestId: string) => {
    setConfirmingId(requestId);
    try {
      const verifyRes = await apiFetch<{ exists: boolean }>(`/admin/deposits/${requestId}/verify`);
      if (verifyRes.exists) {
        // Auto-confirm directly
        await apiFetch(`/admin/deposits/${requestId}/confirm`, { method: 'POST' });
        showToast('Deposit confirmed (unclaimed receipt matched)', 'success');
        refetch();
        window.dispatchEvent(new CustomEvent('deposit-updated'));
      } else {
        // Show warning modal
        setConfirmWarningRequest(requestId);
      }
    } catch (err) {
      showToast('Verification failed', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectReason().trim()) return showToast('Reason required', 'error');
    setRejectingId(requestId);
    try {
      await apiFetch(`/admin/deposits/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason() }),
      });
      showToast('Deposit rejected', 'success');
      refetch();
      window.dispatchEvent(new CustomEvent('deposit-updated'));
      setSelected(null);
      setRejectReason('');
    } catch (err) {
      showToast('Action failed', 'error');
    } finally {
      setRejectingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  return (
    <div class="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-cyan-500/10 pb-6">
        <div>
          <h1 class="text-4xl font-black tracking-tight text-white">Deposits</h1>
          <p class="text-gray-500 text-xs uppercase tracking-[0.2em] font-bold mt-1">Payment Requests</p>
        </div>
        <div class="flex flex-wrap gap-3 items-center">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by request ID, transaction ID..."
              value={search()}
              onInput={(e) => handleSearchInput(e.currentTarget.value)}
              class="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-cyan-500/50 outline-none w-64 transition-all"
            />
          </div>
          <select
            value={statusFilter()}
            onChange={(e) => { setStatusFilter(e.currentTarget.value); setPage(1); }}
            class="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button onClick={() => refetch()} class="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
            Refresh
          </button>
        </div>
      </div>

      <Show when={!depositsData.loading} fallback={
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
          <div class="h-48 bg-white/5 rounded-3xl animate-pulse"></div>
          <div class="h-48 bg-white/5 rounded-3xl animate-pulse"></div>
        </div>
      }>
        <div class="space-y-6">
          <For each={depositsData()?.deposits}>
            {(deposit) => (
              <div class="glass-dark rounded-2xl p-6 shadow-2xl hover:border-cyan-500/20 transition-all">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-white">@{deposit.userId?.username || 'User'}</p>
                      <p class="text-[10px] text-gray-500 font-mono italic">{deposit.userId?.telegramId}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="text-right">
                      <p class="text-2xl font-black text-white">{deposit.amountETB} <span class="text-xs text-gray-500">ETB</span></p>
                      <span class="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md font-bold uppercase">{deposit.method}</span>
                    </div>
                    <span class={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase border ${deposit.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        deposit.status === 'confirmed' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                          'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                      {deposit.status}
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-4 rounded-2xl border border-cyan-500/10 mb-6">
                  <div class="space-y-2">
                    <div class="flex justify-between items-center group cursor-pointer" onClick={() => copyToClipboard(deposit.transactionId)}>
                      <span class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Transaction ID</span>
                      <span class="text-xs font-mono text-gray-300 group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                        {deposit.transactionId}
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                    <div class="flex justify-between items-center group cursor-pointer" onClick={() => copyToClipboard(deposit.requestId)}>
                      <span class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Request ID</span>
                      <span class="text-xs font-mono text-gray-300 group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                        {deposit.requestId}
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                    <Show when={deposit.accountDetails}>
                      <div class="pt-2 border-t border-white/5">
                        <span class="text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Payer Details</span>
                        <p class="text-xs text-gray-400 break-all">{deposit.accountDetails}</p>
                      </div>
                    </Show>
                  </div>

                  <Show when={deposit.method === 'telebirr'}>
                    <div class="space-y-2 border-l border-white/5 pl-4">
                      <div><span class="text-[10px] text-gray-500">Sender:</span> <span class="text-sm text-white">{deposit.senderName || 'N/A'}</span></div>
                      <div><span class="text-[10px] text-gray-500">Receiver:</span> <span class="text-sm text-white">{deposit.receiverName || 'N/A'}</span></div>
                      <div><span class="text-[10px] text-gray-500">Extracted Amount:</span> <span class="text-sm text-cyan-400">{deposit.extractedAmount} ETB</span></div>
                      <div><span class="text-[10px] text-gray-500">Date:</span> <span class="text-sm text-gray-300">{deposit.extractedDate ? new Date(deposit.extractedDate).toLocaleString() : 'N/A'}</span></div>
                      <Show when={deposit.receiptLink}>
                        <div><a href={deposit.receiptLink} target="_blank" rel="noopener noreferrer" class="text-xs text-cyan-400 hover:underline">Receipt Link</a></div>
                      </Show>
                    </div>
                  </Show>
                </div>

                <div class="flex justify-between items-center">
                  <p class="text-[10px] text-gray-500">Requested: {new Date(deposit.createdAt).toLocaleString()}</p>
                  <Show when={deposit.status === 'pending'}>
                    <div class="flex gap-3">
                      <button
                        onClick={() => handleConfirm(deposit.requestId)}
                        disabled={confirmingId() === deposit.requestId}
                        class="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase rounded-xl transition-all shadow-lg shadow-cyan-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {confirmingId() === deposit.requestId ? 'Confirming...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setSelected({ requestId: deposit.requestId, action: 'reject' })}
                        disabled={rejectingId() === deposit.requestId}
                        class="px-6 py-2 bg-white/5 hover:bg-rose-500/10 text-gray-500 hover:text-rose-500 font-bold text-xs uppercase rounded-xl transition-all border border-white/10 disabled:opacity-50"
                      >
                        {rejectingId() === deposit.requestId ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </Show>
                  <Show when={deposit.status !== 'pending' && deposit.adminNotes}>
                    <p class="text-xs text-rose-400 max-w-md truncate" title={deposit.adminNotes}>Note: {deposit.adminNotes}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>

          <Show when={depositsData()?.deposits.length === 0}>
            <div class="text-center py-32 bg-white/[0.02] rounded-[3rem] border-2 border-dashed border-white/5">
              <div class="text-4xl mb-4 opacity-20">📭</div>
              <h2 class="text-gray-400 font-bold uppercase tracking-widest">No deposits found</h2>
              <p class="text-gray-600 text-sm mt-1">Try adjusting your search or filter.</p>
            </div>
          </Show>

          {/* Pagination */}
          <div class="flex justify-between items-center bg-white/[0.02] p-4 rounded-[1.5rem] border border-cyan-500/10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page() === 1}
              class="px-5 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-all font-bold text-sm"
            >
              ← Previous
            </button>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-gray-500 uppercase tracking-widest">Page</span>
              <span class="text-sm font-black text-cyan-400">{page()}</span>
              <span class="text-xs font-mono text-gray-500">of {Math.ceil((depositsData()?.total || 0) / 20)}</span>
            </div>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page() * 20 >= (depositsData()?.total || 0)}
              class="px-5 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-all font-bold text-sm"
            >
              Next →
            </button>
          </div>
        </div>
      </Show>

      {/* Rejection Modal */}
      <ConfirmDialog
        open={!!selected() && selected()!.action === 'reject'}
        title="Decline Deposit"
        message={
          <div class="text-left space-y-4">
            <p class="text-sm text-gray-400 font-medium">Please provide a reason for declining this transaction. This will be visible to the user.</p>
            <textarea
              placeholder="e.g. Transaction ID not found in bank statement..."
              class="w-full h-28 px-4 py-3 rounded-2xl bg-black border border-white/10 text-sm text-white focus:border-rose-500 outline-none transition-all resize-none"
              value={rejectReason()}
              onInput={(e) => setRejectReason(e.currentTarget.value)}
            />
          </div>
        }
        onConfirm={() => selected() && handleReject(selected()!.requestId)}
        onCancel={() => {
          setSelected(null);
          setRejectReason('');
        }}
      />

      {/* Verification Warning Modal */}
      <ConfirmDialog
        open={!!confirmWarningRequest()}
        title="⚠️ Manual Verification Needed"
        message={
          <div class="text-left space-y-4">
            <p class="text-sm text-amber-400 font-bold">
              This transaction ID was not found in the system's unclaimed SMS receipts.
            </p>
            <p class="text-sm text-gray-300">
              Please manually verify the payment before confirming:
            </p>
            <ul class="text-xs text-gray-400 list-disc pl-4 space-y-1">
              <li><span class="font-mono">Telebirr:</span> SuperApp → Profile → Verify Payment → enter Transaction ID</li>
              <li><span class="font-mono">CBE Birr:</span> Check app transaction history</li>
              <li>Ensure amount and receiver match the deposit request.</li>
            </ul>
            <p class="text-sm text-rose-400 font-medium">
              ⚠️ Confirming without verification may result in financial loss.
            </p>
          </div>
        }
        onConfirm={async () => {
          const reqId = confirmWarningRequest();
          if (!reqId) return;
          setConfirmingId(reqId);
          try {
            await apiFetch(`/admin/deposits/${reqId}/confirm`, { method: 'POST' });
            showToast('Deposit confirmed', 'success');
            refetch();
            window.dispatchEvent(new CustomEvent('deposit-updated'));
          } catch (err) {
            showToast('Confirmation failed', 'error');
          } finally {
            setConfirmingId(null);
            setConfirmWarningRequest(null);
          }
        }}
        onCancel={() => setConfirmWarningRequest(null)}
      />
    </div>
  );
}