// src/pages/RoundWinners.tsx
import { createSignal, createResource, For, Show } from 'solid-js';
import { apiFetch } from '../api/client';
import { format } from 'date-fns';
import { showToast } from '../components/Toast';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';
import WinnerCardPopup from '../components/WinnerCardPopup';

export default function RoundWinners() {
  const [page, setPage] = createSignal(1);
  const [filters, setFilters] = createSignal({ roundId: '', userId: '', from: '', to: '' });
  const [selectedWinner, setSelectedWinner] = createSignal<any>(null);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [viewCard, setViewCard] = createSignal<{ cardId: number; drawnBalls: number[] } | null>(null);

  const fetchWinners = async () => {
    const params = new URLSearchParams({
      page: page().toString(),
      limit: '20',
      ...filters()
    });
    const res = await apiFetch<{ winners: any[]; total: number }>(`/admin/round-winners?${params}`);
    return res;
  };

  const [winnersData, { refetch }] = createResource(fetchWinners);

  const winners = () => winnersData()?.winners || [];
  const total = () => winnersData()?.total || 0;

  const handleDelete = async (password: string) => {
    const winner = selectedWinner();
    if (!winner) return;
    try {
      await apiFetch(`/admin/round-winners/${winner._id}`, {
        method: 'DELETE',
        body: JSON.stringify({ settingsPassword: password })
      });
      showToast('Winner record deleted', 'success');
      setShowDeleteModal(false);
      refetch();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-black text-white uppercase tracking-wider">Round Winners</h1>
      </div>

      {/* Filters */}
      <div class="glass-dark p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Round ID"
          class="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 outline-none"
          onInput={(e) => setFilters({ ...filters(), roundId: e.currentTarget.value })}
        />
        <input
          type="text"
          placeholder="User ID"
          class="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 outline-none"
          onInput={(e) => setFilters({ ...filters(), userId: e.currentTarget.value })}
        />
        <input
          type="date"
          class="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none"
          onInput={(e) => setFilters({ ...filters(), from: e.currentTarget.value })}
        />
        <input
          type="date"
          class="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none"
          onInput={(e) => setFilters({ ...filters(), to: e.currentTarget.value })}
        />
        <button
          onClick={() => { setPage(1); refetch(); }}
          class="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-lg transition"
        >
          Apply Filters
        </button>
      </div>

      {/* Table */}
      <div class="glass-dark overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-cyan-500/10 text-gray-400 text-xs uppercase">
            <tr>
              <th class="p-4 text-left">Round ID</th>
              <th class="p-4 text-left">User</th>
              <th class="p-4 text-left">Card ID</th>
              <th class="p-4 text-left">Win Amount</th>
              <th class="p-4 text-left">Date</th>
              <th class="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <Show when={!winnersData.loading} fallback={<tr><td colSpan={6} class="p-4 text-center">Loading...</td></tr>}>
              <For each={winners()}>
                {(winner) => (
                  <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="p-4 font-mono text-xs">{winner.roundId}</td>
                    <td class="p-4">
                      <div class="font-medium">{winner.user?.username || winner.user?.firstName || 'Unknown'}</div>
                      <div class="text-xs text-gray-500">ID: {winner.userId}</div>
                    </td>
                    <td class="p-4">{winner.cardId || '—'}</td>
                    <td class="p-4 text-cyan-400 font-bold">{winner.winAmount.toFixed(2)} ETB</td>
                    <td class="p-4 text-gray-400">{format(new Date(winner.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td class="p-4">
                      <button
                        onClick={() => setViewCard({ cardId: winner.cardId, drawnBalls: winner.drawnBalls })}
                        disabled={!winner.cardId}
                        class="text-cyan-400 hover:text-cyan-300 text-xs font-bold uppercase mr-2 disabled:opacity-50"
                      >
                        View Card
                      </button>
                      <button
                        onClick={() => { setSelectedWinner(winner); setShowDeleteModal(true); }}
                        class="text-rose-400 hover:text-rose-300 text-xs font-bold uppercase"
                      >
                        Force Cleanup
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div class="flex justify-between items-center">
        <span class="text-gray-400 text-sm">Total: {total()}</span>
        <div class="flex gap-2">
          <button
            disabled={page() === 1}
            onClick={() => setPage(p => p - 1)}
            class="px-4 py-2 rounded-lg bg-white/5 disabled:opacity-30"
          >
            Previous
          </button>
          <button
            disabled={winners().length < 20}
            onClick={() => setPage(p => p + 1)}
            class="px-4 py-2 rounded-lg bg-white/5 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      <Show when={viewCard()}>
        <WinnerCardPopup
          cardId={viewCard()!.cardId}
          drawnBalls={viewCard()!.drawnBalls}
          onClose={() => setViewCard(null)}
        />
      </Show>

      {/* Delete Confirmation Modal */}
      <PasswordConfirmDialog
        open={showDeleteModal()}
        title="Force Cleanup Winner Record"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}