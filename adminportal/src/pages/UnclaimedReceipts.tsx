// src/pages/UnclaimedReceipts.tsx
import { createResource, For, Show, createSignal, onCleanup } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function UnclaimedReceipts() {
  const [methodFilter, setMethodFilter] = createSignal('all');
  const [matchedFilter, setMatchedFilter] = createSignal('false');
  const [search, setSearch] = createSignal('');
  const [debouncedSearch, setDebouncedSearch] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [selectedReceipt, setSelectedReceipt] = createSignal<any>(null);
  const [matchRequestId, setMatchRequestId] = createSignal('');
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const [matchingId, setMatchingId] = createSignal<string | null>(null);

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

  const [receiptsData, { refetch }] = createResource(
    () => ({
      method: methodFilter(),
      matched: matchedFilter(),
      page: page(),
      search: debouncedSearch(),
    }),
    async ({ method, matched, page, search }) => {
      const params = new URLSearchParams();
      if (method !== 'all') params.append('method', method);
      if (matched !== 'all') params.append('matched', matched);
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      return apiFetch<{ receipts: any[]; total: number }>(`/admin/unclaimed-receipts?${params.toString()}`);
    }
  );

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/admin/unclaimed-receipts/${id}`, { method: 'DELETE' });
      showToast('Receipt deleted', 'success');
      refetch();
      window.dispatchEvent(new CustomEvent('unclaimed-updated'));
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleMatch = async (receipt: any) => {
    if (!matchRequestId().trim()) {
      showToast('Please enter a pending deposit Request ID', 'error');
      return;
    }
    setMatchingId(receipt._id);
    try {
      await apiFetch(`/admin/unclaimed-receipts/${receipt._id}/match`, {
        method: 'POST',
        body: JSON.stringify({ requestId: matchRequestId().trim() }),
      });
      showToast('Receipt matched and deposit confirmed', 'success');
      refetch();
      window.dispatchEvent(new CustomEvent('unclaimed-updated'));
      setSelectedReceipt(null);
      setMatchRequestId('');
    } catch (err: any) {
      showToast(err.message || 'Match failed', 'error');
    } finally {
      setMatchingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'success');
  };

  return (
    <div class="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-cyan-500/10 pb-6">
        <div>
          <h1 class="text-4xl font-black tracking-tight text-white">Unclaimed SMS Receipts</h1>
          <p class="text-gray-500 text-xs uppercase tracking-[0.2em] font-bold mt-1">SMS arrived before user submission</p>
        </div>
        <div class="flex flex-wrap gap-3 items-center">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by TX ID, sender, receiver..."
              value={search()}
              onInput={(e) => handleSearchInput(e.currentTarget.value)}
              class="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-cyan-500/50 outline-none w-64"
            />
          </div>
          <select
            value={methodFilter()}
            onChange={(e) => { setMethodFilter(e.currentTarget.value); setPage(1); }}
            class="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Methods</option>
            <option value="telebirr">Telebirr</option>
            <option value="cbebirr">CBE Birr</option>
          </select>
          <select
            value={matchedFilter()}
            onChange={(e) => { setMatchedFilter(e.currentTarget.value); setPage(1); }}
            class="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
          >
            <option value="false">Unmatched Only</option>
            <option value="true">Matched Only</option>
            <option value="all">All</option>
          </select>
          <button onClick={() => refetch()} class="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-colors">
            Refresh
          </button>
        </div>
      </div>

      <Show when={!receiptsData.loading} fallback={<div class="text-center py-8">Loading...</div>}>
        <div class="space-y-4">
          <For each={receiptsData()?.receipts}>
            {(receipt) => (
              <div class="glass-dark rounded-2xl p-5 border border-cyan-500/10">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div class="flex items-center gap-3">
                    <span class={`px-2 py-1 rounded-md text-xs font-bold uppercase ${receipt.method === 'telebirr' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {receipt.method}
                    </span>
                    <span class={`px-2 py-1 rounded-md text-xs ${receipt.matched ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {receipt.matched ? 'Matched' : 'Unmatched'}
                    </span>
                    <span class="text-xs text-gray-400">{new Date(receipt.createdAt).toLocaleString()}</span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      onClick={() => setSelectedReceipt(receipt)}
                      class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs transition-colors"
                    >
                      Details / Match
                    </button>
                    <button
                      onClick={() => handleDelete(receipt._id)}
                      disabled={deletingId() === receipt._id}
                      class="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs disabled:opacity-50"
                    >
                      {deletingId() === receipt._id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span class="text-gray-500 text-[10px] uppercase block">Transaction ID</span>
                    <span class="font-mono text-white cursor-pointer hover:text-cyan-400" onClick={() => copyToClipboard(receipt.transactionId)}>
                      {receipt.transactionId}
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-[10px] uppercase block">Amount</span>
                    <span class="text-cyan-400 font-bold">{receipt.amount} ETB</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-[10px] uppercase block">Sender → Receiver</span>
                    <span class="text-white">{receipt.senderName} → {receipt.receiverName}</span>
                  </div>
                </div>
                {receipt.matched && receipt.matchedDeposit && (
                  <div class="mt-3 pt-3 border-t border-white/5 text-xs">
                    <span class="text-gray-500">Matched to Deposit: </span>
                    <span class="font-mono text-cyan-400">{receipt.matchedDeposit.requestId}</span>
                    <span class="text-gray-400 ml-2">User: @{receipt.matchedDeposit.userId?.username || receipt.matchedDeposit.userId?.telegramId}</span>
                  </div>
                )}
              </div>
            )}
          </For>
          <Show when={receiptsData()?.receipts.length === 0}>
            <div class="text-center py-16 text-gray-500">No unclaimed receipts found.</div>
          </Show>

          {/* Pagination */}
          <div class="flex justify-between items-center bg-white/[0.02] p-4 rounded-xl border border-cyan-500/10">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page() === 1} class="px-4 py-2 bg-white/5 disabled:opacity-20 rounded-lg transition-colors">← Prev</button>
            <span class="text-sm font-bold text-cyan-400">Page {page()} of {Math.ceil((receiptsData()?.total || 0) / 20)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page() * 20 >= (receiptsData()?.total || 0)} class="px-4 py-2 bg-white/5 disabled:opacity-20 rounded-lg transition-colors">Next →</button>
          </div>
        </div>
      </Show>

      {/* Detail & Match Modal */}
      <Show when={selectedReceipt()}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md" onClick={() => setSelectedReceipt(null)}>
          <div class="glass-dark rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-cyan-500/10" onClick={(e) => e.stopPropagation()}>
            <h2 class="text-xl font-bold mb-4 text-white">Unclaimed Receipt Details</h2>
            <div class="space-y-3 text-sm">
              <div><span class="text-gray-500">Transaction ID:</span> <span class="font-mono">{selectedReceipt().transactionId}</span></div>
              <div><span class="text-gray-500">Method:</span> {selectedReceipt().method}</div>
              <div><span class="text-gray-500">Amount:</span> <span class="text-cyan-400 font-bold">{selectedReceipt().amount} ETB</span></div>
              <div><span class="text-gray-500">Sender:</span> {selectedReceipt().senderName}</div>
              <div><span class="text-gray-500">Receiver:</span> {selectedReceipt().receiverName}</div>
              <div><span class="text-gray-500">SMS Date:</span> {new Date(selectedReceipt().date).toLocaleString()}</div>
              <div><span class="text-gray-500">Created:</span> {new Date(selectedReceipt().createdAt).toLocaleString()}</div>
              {selectedReceipt().link && (
                <div><span class="text-gray-500">Receipt Link:</span> <a href={selectedReceipt().link} target="_blank" class="text-cyan-400 underline">Open</a></div>
              )}
              <div>
                <span class="text-gray-500 block mb-1">Raw SMS:</span>
                <pre class="bg-black/50 p-3 rounded-xl text-xs whitespace-pre-wrap max-h-40 overflow-auto">{selectedReceipt().rawSms}</pre>
              </div>
            </div>
            {!selectedReceipt().matched && (
              <div class="mt-6 border-t border-cyan-500/10 pt-4">
                <label class="text-sm text-gray-400 block mb-2">Match to Pending Deposit (enter Request ID):</label>
                <input
                  type="text"
                  placeholder="DEP-..."
                  value={matchRequestId()}
                  onInput={(e) => setMatchRequestId(e.currentTarget.value)}
                  class="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-sm mb-3 focus:border-cyan-500/50"
                />
                <div class="flex gap-3">
                  <button
                    onClick={() => handleMatch(selectedReceipt())}
                    disabled={matchingId() === selectedReceipt()._id}
                    class="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm disabled:opacity-50"
                  >
                    {matchingId() === selectedReceipt()._id ? 'Matching...' : 'Confirm Match & Deposit'}
                  </button>
                  <button onClick={() => setSelectedReceipt(null)} class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm">Close</button>
                </div>
              </div>
            )}
            {selectedReceipt().matched && (
              <div class="mt-6 border-t border-cyan-500/10 pt-4">
                <p class="text-cyan-400">✅ Already matched to deposit {selectedReceipt().matchedDeposit?.requestId}</p>
                <button onClick={() => setSelectedReceipt(null)} class="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm">Close</button>
              </div>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
}