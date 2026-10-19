// src/pages/BonusCleanup.tsx
import { createSignal, Show, For } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';

interface PreviewRow {
  userId: string;
  telegramId: number;
  username?: string;
  firstName: string;
  bonusBalance: number;
  lockedBalance: number;
  ETBCoins: number;
  phoneRefGranted: number;
  toRemove: number;
  isAbuser: boolean;
  totalConfirmedDepositsETB: number;
}

interface Preview {
  affectedUsers: number;
  totalToRemove: number;
  totalETBCoinsAfter: number;
  breakdown: { fromBonus: number; fromLocked: number; fromETBCoins: number };
  preview: PreviewRow[];
  skipped: { pendingWithdrawal: number; mixedBonuses: number; nothingToClean: number };
}

export default function BonusCleanup() {
  const [preview, setPreview] = createSignal<Preview | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [executing, setExecuting] = createSignal(false);
  const [lastResult, setLastResult] = createSignal<any>(null);

  const [confirm, setConfirm] = createSignal<{
    open: boolean;
    onConfirm: (pw: string) => Promise<void>;
  }>({ open: false, onConfirm: async () => {} });

  const runPreview = async () => {
    setLoading(true);
    setLastResult(null);
    try {
      const data = await apiFetch<Preview>('/admin/bonuses/cleanup-non-agents/preview', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setPreview(data);
      showToast(`Preview ready: ${data.affectedUsers} users affected`, 'info');
    } catch (e: any) {
      showToast(e.message || 'Preview failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const runExecute = () => {
    if (!preview() || preview()!.affectedUsers === 0) return;
    setConfirm({
      open: true,
      onConfirm: async (pw) => {
        setExecuting(true);
        try {
          const res = await apiFetch('/admin/bonuses/cleanup-non-agents/execute', {
            method: 'POST',
            body: JSON.stringify({ settingsPassword: pw }),
          });
          setLastResult(res);
          showToast(`✅ Removed ${(res as any).totalRemoved.toFixed(2)} ETB from ${(res as any).processed} users`, 'success');
          setPreview(null);
        } catch (e: any) {
          showToast(e.message || 'Cleanup failed', 'error');
          throw e;
        } finally {
          setExecuting(false);
        }
      },
    });
  };

  return (
    <div class="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div>
        <h1 class="text-4xl font-black tracking-tight text-white">Bonus Cleanup</h1>
        <p class="text-gray-500 text-xs uppercase tracking-[0.2em] font-bold mt-1">
          Remove phone &amp; referral bonuses from non-agent users
        </p>
      </div>

      {/* Warning banner */}
      <div class="rounded-2xl p-5 border border-amber-500/30 bg-amber-500/10">
        <div class="flex items-start gap-3">
          <svg class="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
          </svg>
          <div class="flex-1">
            <h2 class="text-base font-black text-amber-400 uppercase tracking-wider mb-2">
              ⚠️ Financial Operation — Cannot Be Undone
            </h2>
            <p class="text-xs text-amber-200/80 leading-relaxed">
              This permanently removes <b>phone-sharing</b> and <b>referral</b> bonuses from every <b>non-agent</b> user who received them.
              Balances are reduced in <code class="bg-black/40 px-1 rounded">bonusBalance</code>, <code class="bg-black/40 px-1 rounded">lockedBalance</code>, and <code class="bg-black/40 px-1 rounded">ETBCoins</code>.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div class="rounded-xl p-4 bg-rose-500/10 border border-rose-500/20">
            <div class="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">❌ Removed</div>
            <ul class="text-[11px] text-rose-200/80 space-y-1 leading-relaxed">
              <li>• Non-agent phone bonuses</li>
              <li>• Non-agent referral bonuses</li>
              <li>• Equal amount from user's ETBCoins</li>
            </ul>
          </div>
          <div class="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/20">
            <div class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">✓ Not Touched</div>
            <ul class="text-[11px] text-emerald-200/80 space-y-1 leading-relaxed">
              <li>• Withdrawable balance (balanceMain)</li>
              <li>• Deposit-locked balance</li>
              <li>• Agent bonuses &amp; commissions</li>
              <li>• Users with pending withdrawals</li>
              <li>• Deposit bonus / weekly / shamo prizes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div class="flex flex-wrap gap-3">
        <button
          onClick={runPreview}
          disabled={loading()}
          class="px-6 py-3 rounded-xl bg-white/5 border border-cyan-500/20 text-cyan-300 font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
        >
          {loading() ? '● Scanning…' : '🔍 Preview Impact'}
        </button>

        <Show when={preview() && preview()!.affectedUsers > 0}>
          <button
            onClick={runExecute}
            disabled={executing()}
            class="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-rose-500/30"
          >
            {executing() ? '● Executing…' : `⚠️ Execute Cleanup (${preview()!.affectedUsers} users)`}
          </button>
        </Show>
      </div>

      {/* Preview results */}
      <Show when={preview()}>
        {(p) => (
          <div class="space-y-6">

            {/* Summary cards */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Affected Users" value={p().affectedUsers.toString()} color="rose" />
              <StatCard label="Total to Remove" value={`${p().totalToRemove.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`} color="amber" />
              <StatCard label="New ETBCoins Total" value={`${p().totalETBCoinsAfter.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`} color="cyan" />
              <StatCard label="Skipped" value={`${p().skipped.pendingWithdrawal + p().skipped.mixedBonuses + p().skipped.nothingToClean}`} color="gray" />
            </div>

            {/* Breakdown */}
            <div class="glass-dark rounded-2xl p-5 border border-cyan-500/10">
              <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Balance Impact</div>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <div class="text-[9px] text-violet-400 font-bold uppercase tracking-wider mb-1">Bonus Balance</div>
                  <div class="text-lg font-black text-violet-400 tabular-nums">
                    −{p().breakdown.fromBonus.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div class="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">Locked Balance</div>
                  <div class="text-lg font-black text-amber-400 tabular-nums">
                    −{p().breakdown.fromLocked.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div class="text-[9px] text-rose-400 font-bold uppercase tracking-wider mb-1">ETBCoins (Total)</div>
                  <div class="text-lg font-black text-rose-400 tabular-nums">
                    −{p().breakdown.fromETBCoins.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Skipped reasons */}
            <div class="glass-dark rounded-2xl p-5 border border-cyan-500/10">
              <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Skipped Users</div>
              <div class="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div class="text-gray-500 mb-0.5">Pending withdrawal</div>
                  <div class="text-white font-black tabular-nums">{p().skipped.pendingWithdrawal}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-0.5">Mixed bonuses (protected)</div>
                  <div class="text-white font-black tabular-nums">{p().skipped.mixedBonuses}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-0.5">Nothing to clean</div>
                  <div class="text-white font-black tabular-nums">{p().skipped.nothingToClean}</div>
                </div>
              </div>
            </div>

            {/* Table of top users */}
            <div class="glass-dark rounded-2xl border border-cyan-500/10 overflow-hidden">
              <div class="px-6 py-4 border-b border-white/5">
                <h3 class="text-sm font-black uppercase tracking-widest text-white">
                  Top 100 Users (by amount)
                </h3>
              </div>
              <div class="overflow-x-auto max-h-[600px]">
                <table class="w-full text-xs">
                  <thead class="bg-white/[0.02] text-[10px] uppercase tracking-widest text-gray-500 sticky top-0">
                    <tr>
                      <th class="px-4 py-3 text-left">User</th>
                      <th class="px-4 py-3 text-left">Telegram ID</th>
                      <th class="px-4 py-3 text-right">Current ETBCoins</th>
                      <th class="px-4 py-3 text-right">Current Bonus</th>
                      <th class="px-4 py-3 text-right">Phone+Ref Granted</th>
                      <th class="px-4 py-3 text-right">Will Remove</th>
                      <th class="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    <For each={p().preview}>
                      {(row) => (
                        <tr class="hover:bg-white/[0.02]">
                          <td class="px-4 py-2 text-white">
                            {row.username ? `@${row.username}` : row.firstName}
                          </td>
                          <td class="px-4 py-2 font-mono text-gray-400">{row.telegramId}</td>
                          <td class="px-4 py-2 text-right tabular-nums text-white">{row.ETBCoins.toFixed(2)}</td>
                          <td class="px-4 py-2 text-right tabular-nums text-violet-400">{row.bonusBalance.toFixed(2)}</td>
                          <td class="px-4 py-2 text-right tabular-nums text-cyan-400">{row.phoneRefGranted.toFixed(2)}</td>
                          <td class="px-4 py-2 text-right tabular-nums font-black text-rose-400">
                            −{row.toRemove.toFixed(2)}
                          </td>
                          <td class="px-4 py-2 text-center">
                            <Show when={row.isAbuser}>
                              <span class="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                flagged
                              </span>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <Show when={p().affectedUsers > 100}>
                <div class="px-6 py-3 text-center text-[10px] text-gray-500 border-t border-white/5">
                  Showing 100 of {p().affectedUsers} affected users
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>

      {/* Last result */}
      <Show when={lastResult()}>
        {(r) => (
          <div class="rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/5">
            <h3 class="text-lg font-black text-emerald-400 mb-3">✅ Cleanup Complete</h3>
            <div class="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Batch ID</div>
                <div class="font-mono text-xs text-white">{r().batchId}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Users Processed</div>
                <div class="text-xl font-black text-white">{r().processed}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Total Removed</div>
                <div class="text-xl font-black text-emerald-400 tabular-nums">
                  {r().totalRemoved.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB
                </div>
              </div>
            </div>
            <Show when={r().failed && r().failed.length > 0}>
              <div class="mt-4 pt-4 border-t border-emerald-500/20">
                <div class="text-[10px] uppercase tracking-widest text-rose-400 mb-2">
                  {r().failed.length} users failed (guard rejected — probably raced with a game action)
                </div>
                <div class="text-[10px] text-gray-400 max-h-32 overflow-y-auto custom-scrollbar">
                  <For each={r().failed.slice(0, 20)}>
                    {(f: any) => <div class="font-mono">{f.telegramId} — {f.reason}</div>}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        )}
      </Show>

      <PasswordConfirmDialog
        open={confirm().open}
        title="Confirm Bonus Cleanup"
        onConfirm={confirm().onConfirm}
        onCancel={() => setConfirm({ open: false, onConfirm: async () => {} })}
      />
    </div>
  );
}

function StatCard(props: { label: string; value: string; color: 'rose' | 'amber' | 'cyan' | 'gray' }) {
  const map: Record<string, string> = {
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    gray: 'text-gray-300',
  };
  return (
    <div class="glass-dark rounded-2xl p-5 border border-cyan-500/10">
      <div class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{props.label}</div>
      <div class={`text-xl font-black tabular-nums ${map[props.color]}`}>{props.value}</div>
    </div>
  );
}