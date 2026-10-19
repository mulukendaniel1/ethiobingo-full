// src/pages/Shamo.tsx
import { createSignal, createResource, Show, For, createMemo } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';

type Tab = 'live' | 'config' | 'history';

interface ShamoStatusResp {
  active: {
    roundId: string;
    status: string;
    startedAt: string;
    totalButtons: number;
    prizePerButton: number;
    claimedCount: number;
    claimedButtons: number[];
    claimedUsers: string[];
    eligibilityDepositDays: number;
    cooldownHours: number;
  } | null;
  config: {
    autoEnabled: boolean;
    dailyTime: string;
    prizePerButton: number;
    totalButtons: number;
    depositDays: number;
    cooldownHours: number;
    badgeEnabled: boolean;
    eligibilityEnabled: boolean;   // ← NEW
    minDepositAmount: number;      // ← NEW
  };
}

interface RoundHistoryRow {
  _id: string;
  roundId: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  endReason?: string;
  claimedCount: number;
  totalPayout: number;
  totalButtons: number;
  prizePerButton: number;
  triggeredBy: string;
}

export default function Shamo() {
  const [tab, setTab] = createSignal<Tab>('live');
  const [historyPage, setHistoryPage] = createSignal(1);
  const [submitting, setSubmitting] = createSignal(false);   // ← NEW

  const [status, { refetch: refetchStatus }] = createResource(
    () => apiFetch<ShamoStatusResp>('/admin/shamo/status')
  );

  const [history, { refetch: refetchHistory }] = createResource(
    () => ({ page: historyPage() }),
    ({ page }) =>
      apiFetch<{ rounds: RoundHistoryRow[]; total: number; page: number; limit: number }>(
        `/admin/shamo/rounds?page=${page}&limit=20`
      )
  );

  // Poll active round every 5s while on live tab
  const [pollOn, setPollOn] = createSignal(true);
  const startPolling = () => {
    setPollOn(true);
    const tick = async () => {
      if (!pollOn()) return;
      if (tab() === 'live') {
        await refetchStatus();
      }
      setTimeout(tick, 5000);
    };
    setTimeout(tick, 5000);
  };
  startPolling();

  // Claims of the currently active round
  const activeRoundId = createMemo(() => status()?.active?.roundId ?? '');
  const [claims, { refetch: refetchClaims }] = createResource(
    () => activeRoundId(),
    (rid) => (rid ? apiFetch<{ claims: any[]; total: number }>(`/admin/shamo/rounds/${rid}/claims?limit=100`) : Promise.resolve({ claims: [], total: 0 }))
  );

  // ── Password gating ──
  const [passwordConfirm, setPasswordConfirm] = createSignal<{
    open: boolean;
    title: string;
    onConfirm: (pw: string) => Promise<void>;
  }>({ open: false, title: '', onConfirm: async () => {} });

  const startRound = () => {
    if (submitting()) return;                                // ← NEW
    setPasswordConfirm({
      open: true,
      title: 'Start ሻሞ Giveaway now?',
      onConfirm: async (pw) => {
        if (submitting()) return;                            // ← NEW
        setSubmitting(true);                                 // ← NEW
        try {
          await apiFetch('/admin/shamo/start', {
            method: 'POST',
            body: JSON.stringify({ settingsPassword: pw }),
          });
          showToast('ሻሞ started', 'success');
          refetchStatus();
          refetchHistory();
        } catch (e: any) {
          showToast(e.message || 'Failed to start', 'error');
        } finally {
          setSubmitting(false);                              // ← NEW
        }
      },
    });
  };

  const endRound = (reason: 'manual' | 'cancelled') => {
    if (submitting()) return;                                // ← NEW
    setPasswordConfirm({
      open: true,
      title: reason === 'cancelled' ? 'Cancel active ሻሞ?' : 'End active ሻሞ?',
      onConfirm: async (pw) => {
        if (submitting()) return;                            // ← NEW
        setSubmitting(true);                                 // ← NEW
        try {
          await apiFetch('/admin/shamo/end', {
            method: 'POST',
            body: JSON.stringify({ settingsPassword: pw, reason }),
          });
          showToast('ሻሞ ended', 'success');
          refetchStatus();
          refetchHistory();
          refetchClaims();
        } catch (e: any) {
          showToast(e.message || 'Failed to end', 'error');
        } finally {
          setSubmitting(false);                              // ← NEW
        }
      },
    });
  };

  const updateConfig = (patch: Record<string, any>, title: string) => {
    if (submitting()) return;                                // ← NEW
    setPasswordConfirm({
      open: true,
      title,
      onConfirm: async (pw) => {
        if (submitting()) return;                            // ← NEW
        setSubmitting(true);                                 // ← NEW
        try {
          await apiFetch('/admin/shamo/schedule', {
            method: 'POST',
            body: JSON.stringify({ settingsPassword: pw, ...patch }),
          });
          showToast('Configuration saved', 'success');
          refetchStatus();
        } catch (e: any) {
          showToast(e.message || 'Save failed', 'error');
        } finally {
          setSubmitting(false);                              // ← NEW
        }
      },
    });
  };

  return (
    <div class="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <header class="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="text-4xl font-black tracking-tight text-white">ሻሞ Giveaway</h1>
          <p class="text-gray-500 text-xs uppercase tracking-[0.2em] font-bold mt-1">
            Daily bonus drop · 50 boxes × 50 ETB · non‑withdrawable
          </p>
        </div>
        <div class="flex gap-2">
          <button
            onClick={startRound}
            disabled={!!status()?.active || submitting()}
            class="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting() ? '● Working…' : '▶ Start Now'}
          </button>
          <button
            onClick={() => endRound('manual')}
            disabled={!status()?.active || submitting()}
            class="px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-black uppercase text-xs tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting() ? '● Working…' : '⏹ End'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div class="flex p-1 bg-white/5 rounded-2xl border border-cyan-500/10 w-fit">
        <For each={['live', 'config', 'history'] as Tab[]}>
          {(t) => (
            <button
              onClick={() => setTab(t)}
              class={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                tab() === t
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          )}
        </For>
      </div>

      {/* ── LIVE TAB ── */}
      <Show when={tab() === 'live'}>
        <Show
          when={status()?.active}
          fallback={
            <div class="glass-dark rounded-2xl p-10 text-center border border-cyan-500/10">
              <div class="text-5xl mb-3">🎁</div>
              <div class="text-lg font-black text-white">No active ሻሞ round</div>
              <div class="text-xs text-gray-500 mt-2">
                {status()?.config.autoEnabled
                  ? `Auto‑starts every day at ${status()!.config.dailyTime} Ethiopian time`
                  : 'Auto‑start is disabled. Use “Start Now” above.'}
              </div>
            </div>
          }
        >
          {(active) => (
            <div class="space-y-6">
              {/* Stat cards */}
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Round" value={active().roundId.slice(-8)} />
                <StatCard
                  label="Claimed"
                  value={`${active().claimedCount} / ${active().totalButtons}`}
                  accent="cyan"
                />
                <StatCard
                  label="Total Payout"
                  value={`${(active().claimedCount * active().prizePerButton).toFixed(0)} ETB`}
                  accent="emerald"
                />
                <StatCard
                  label="Started"
                  value={new Date(active().startedAt).toLocaleTimeString()}
                />
              </div>

              {/* Progress bar */}
              <div class="glass-dark rounded-2xl p-6 border border-cyan-500/10">
                <div class="flex justify-between text-xs font-bold mb-2">
                  <span class="text-gray-400">Boxes opened</span>
                  <span class="text-cyan-400">
                    {Math.round((active().claimedCount / active().totalButtons) * 100)}%
                  </span>
                </div>
                <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(active().claimedCount / active().totalButtons) * 100}%`,
                      background: 'linear-gradient(90deg,#f59e0b,#22c55e)',
                    }}
                  />
                </div>
              </div>

              {/* Claims table */}
              <div class="glass-dark rounded-2xl border border-cyan-500/10 overflow-hidden">
                <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center">
                  <h3 class="text-sm font-black uppercase tracking-widest text-white">
                    Live Claims
                  </h3>
                  <button
                    onClick={() => refetchClaims()}
                    class="text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300"
                  >
                    Refresh
                  </button>
                </div>
                <div class="overflow-x-auto max-h-[480px]">
                  <table class="w-full text-sm">
                    <thead class="bg-white/[0.02] text-[10px] uppercase tracking-widest text-gray-500">
                      <tr>
                        <th class="px-4 py-3 text-left">Time</th>
                        <th class="px-4 py-3 text-left">User</th>
                        <th class="px-4 py-3 text-left">Telegram ID</th>
                        <th class="px-4 py-3 text-left">Phone</th>
                        <th class="px-4 py-3 text-left">Box #</th>
                        <th class="px-4 py-3 text-left">IP</th>
                        <th class="px-4 py-3 text-right">Prize</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                      <For each={claims()?.claims || []}>
                        {(c: any) => (
                          <tr class="hover:bg-white/[0.02]">
                            <td class="px-4 py-2 font-mono text-xs text-gray-400">
                              {new Date(c.claimedAt).toLocaleTimeString()}
                            </td>
                            <td class="px-4 py-2 text-white">
                              @{c.userId?.username || c.userId?.firstName || '—'}
                            </td>
                            <td class="px-4 py-2 font-mono text-xs text-gray-400">
                              {c.telegramId}
                            </td>
                            <td class="px-4 py-2 font-mono text-xs text-gray-400">
                              {c.phoneNumber || '—'}
                            </td>
                            <td class="px-4 py-2 font-mono text-cyan-400">
                              #{c.buttonIndex + 1}
                            </td>
                            <td class="px-4 py-2 font-mono text-xs text-gray-500">
                              {c.ipAddress || '—'}
                            </td>
                            <td class="px-4 py-2 text-right font-bold text-emerald-400">
                              {c.prizeAmount} ETB
                            </td>
                          </tr>
                        )}
                      </For>
                      <Show when={(claims()?.claims || []).length === 0}>
                        <tr>
                          <td colspan="7" class="px-4 py-10 text-center text-gray-500">
                            No claims yet.
                          </td>
                        </tr>
                      </Show>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Show>
      </Show>

      {/* ── CONFIG TAB ── */}
      <Show when={tab() === 'config'}>
        <Show when={status()}>
          {(s) => (
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConfigCard title="Schedule">
                <ToggleRow
                  label="Auto‑start daily"
                  value={s().config.autoEnabled}
                  onChange={(v) => updateConfig({ autoEnabled: v }, 'Toggle auto‑start')}
                />
                <TextField
                  label="Daily time (Ethiopian, HH:MM)"
                  value={s().config.dailyTime}
                  onSave={(v) => updateConfig({ dailyTime: v }, 'Change daily time')}
                  placeholder="21:00"
                />
                <ToggleRow
                  label="Show floating badge on game"
                  value={s().config.badgeEnabled}
                  onChange={(v) => updateConfig({ badgeEnabled: v }, 'Toggle badge')}
                />
              </ConfigCard>

              <ConfigCard title="Reward">
                <NumberField
                  label="Prize per box (ETB)"
                  value={s().config.prizePerButton}
                  onSave={(v) => updateConfig({ prizePerButton: v }, 'Change prize')}
                  min={1}
                />
                <NumberField
                  label="Total boxes"
                  value={s().config.totalButtons}
                  onSave={(v) => updateConfig({ totalButtons: v }, 'Change box count')}
                  min={1}
                  max={500}
                />
              </ConfigCard>

              <ConfigCard title="Eligibility & Cooldown">
                {/* ── Master switch: deposit check on/off ── */}
                <ToggleRow
                  label="Require a deposit to claim ሻሞ"
                  value={s().config.eligibilityEnabled !== false}
                  onChange={(v) =>
                    updateConfig(
                      { eligibilityEnabled: v },
                      v ? 'Turn ON deposit requirement' : 'Turn OFF deposit requirement'
                    )
                  }
                />

                {/* ── Only show these when the check is ON ── */}
                <Show when={s().config.eligibilityEnabled !== false}>
                  <NumberField
                    label="Minimum total deposit (ETB) — 0 = any deposit counts"
                    value={s().config.minDepositAmount ?? 0}
                    onSave={(v) => updateConfig({ minDepositAmount: Math.max(0, v) }, 'Change minimum deposit')}
                    min={0}
                  />

                  <NumberField
                    label="Check window (last N days)"
                    value={s().config.depositDays}
                    onSave={(v) => updateConfig({ depositDays: v }, 'Change eligibility window')}
                    min={0}
                    max={90}
                  />

                  <div class="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                    <p class="text-[10px] text-cyan-300 leading-relaxed">
                      A player must have deposited{' '}
                      <b class="text-white">
                        ≥ {s().config.minDepositAmount || 0} ETB total
                      </b>{' '}
                      within the last <b class="text-white">{s().config.depositDays}</b> days to be
                      allowed to claim.
                      {s().config.minDepositAmount > 0
                        ? ` Deposits below ${s().config.minDepositAmount} ETB won't qualify.`
                        : ' Any confirmed deposit qualifies.'}
                    </p>
                  </div>
                </Show>

                {/* ── Warning shown when the check is off ── */}
                <Show when={s().config.eligibilityEnabled === false}>
                  <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3">
                    <span class="text-lg leading-none">⚠️</span>
                    <p class="text-[10px] text-amber-300 leading-relaxed font-bold uppercase">
                      Deposit check is OFF — anyone can claim ሻሞ, even with zero deposits.
                      Cooldown and one-claim-per-round rules still apply.
                    </p>
                  </div>
                </Show>

                {/* ── Cooldown — always visible, independent of the deposit gate ── */}
                <NumberField
                  label="Prize cooldown (hours)"
                  value={s().config.cooldownHours}
                  onSave={(v) => updateConfig({ cooldownHours: v }, 'Change cooldown')}
                  min={1}
                  max={168}
                />
                <p class="text-[10px] text-gray-500 italic">
                  A user cannot win more than one ሻሞ prize every {s().config.cooldownHours}h,
                  even if two rounds occur in the same window.
                </p>
              </ConfigCard>

              <ConfigCard title="Money Flow">
                <div class="text-xs text-gray-400 space-y-3 leading-relaxed">
                  <p>
                    Each prize increments{' '}
                    <code class="text-cyan-400 bg-black/40 px-1 rounded">ETBCoins</code> (total) and lands
                    in{' '}
                    <code class="text-cyan-400 bg-black/40 px-1 rounded">lockedBalance</code> +{' '}
                    <code class="text-cyan-400 bg-black/40 px-1 rounded">bonusBalance</code>{' '}
                    (bonus pool).
                </p>
                  <p>
                    User must wager from deposit funds (Option C) before they can withdraw it, exactly
                    like any other bonus. No exception.
                  </p>
                  <p class="text-emerald-400">
                    ✔ Duplicate‑claim protection: DB unique indexes + Redis Lua reserve.
                    <br />✔ Multi‑account: recorded IP + phone hash stored on each claim.
                  </p>
                </div>
              </ConfigCard>
            </div>
          )}
        </Show>
      </Show>

      {/* ── HISTORY TAB ── */}
      <Show when={tab() === 'history'}>
        <div class="glass-dark rounded-2xl border border-cyan-500/10 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-white/[0.02] text-[10px] uppercase tracking-widest text-gray-500">
                <tr>
                  <th class="px-4 py-3 text-left">Round</th>
                  <th class="px-4 py-3 text-left">Status</th>
                  <th class="px-4 py-3 text-left">Trigger</th>
                  <th class="px-4 py-3 text-left">Started</th>
                  <th class="px-4 py-3 text-left">Ended</th>
                  <th class="px-4 py-3 text-left">Reason</th>
                  <th class="px-4 py-3 text-right">Claims</th>
                  <th class="px-4 py-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <For each={history()?.rounds || []}>
                  {(r) => (
                    <tr class="hover:bg-white/[0.02]">
                      <td class="px-4 py-3 font-mono text-xs text-cyan-400">
                        {r.roundId}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            r.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : r.status === 'completed'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-xs uppercase text-gray-400">
                        {r.triggeredBy}
                      </td>
                      <td class="px-4 py-3 text-xs">
                        {new Date(r.startedAt).toLocaleString()}
                      </td>
                      <td class="px-4 py-3 text-xs">
                        {r.endedAt ? new Date(r.endedAt).toLocaleString() : '—'}
                      </td>
                      <td class="px-4 py-3 text-xs text-gray-400">
                        {r.endReason || '—'}
                      </td>
                      <td class="px-4 py-3 text-right font-bold text-white">
                        {r.claimedCount} / {r.totalButtons}
                      </td>
                      <td class="px-4 py-3 text-right font-bold text-emerald-400">
                        {r.totalPayout.toFixed(0)} ETB
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={(history()?.rounds || []).length === 0}>
                  <tr>
                    <td colspan="8" class="px-4 py-10 text-center text-gray-500">
                      No rounds yet.
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div class="flex justify-between items-center p-4 border-t border-white/5">
            <button
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage() === 1}
              class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 font-bold text-sm"
            >
              ← Prev
            </button>
            <span class="text-xs font-black text-cyan-400">
              Page {historyPage()} of{' '}
              {Math.max(1, Math.ceil((history()?.total || 0) / 20))}
            </span>
            <button
              onClick={() => setHistoryPage((p) => p + 1)}
              disabled={historyPage() * 20 >= (history()?.total || 0)}
              class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 font-bold text-sm"
            >
              Next →
            </button>
          </div>
        </div>
      </Show>

      <PasswordConfirmDialog
        open={passwordConfirm().open}
        title={passwordConfirm().title}
        onConfirm={passwordConfirm().onConfirm}
        onCancel={() =>
          setPasswordConfirm({ open: false, title: '', onConfirm: async () => {} })
        }
      />
    </div>
  );
}

// ── Small helper components ──
function StatCard(props: { label: string; value: string; accent?: 'cyan' | 'emerald' }) {
  const color =
    props.accent === 'emerald'
      ? 'text-emerald-400'
      : props.accent === 'cyan'
      ? 'text-cyan-400'
      : 'text-white';
  return (
    <div class="glass-dark rounded-2xl p-4 border border-cyan-500/10">
      <div class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
        {props.label}
      </div>
      <div class={`text-xl font-black ${color} truncate`}>{props.value}</div>
    </div>
  );
}

function ConfigCard(props: { title: string; children: any }) {
  return (
    <div class="glass-dark rounded-2xl p-6 border border-cyan-500/10 space-y-4">
      <h3 class="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-white/5 pb-3">
        {props.title}
      </h3>
      {props.children}
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div class="flex justify-between items-center py-2">
      <span class="text-sm font-bold text-gray-200">{props.label}</span>
      <button
        onClick={() => props.onChange(!props.value)}
        class={`relative inline-flex h-6 w-12 items-center rounded-full transition-all ${
          props.value ? 'bg-cyan-500' : 'bg-gray-700'
        }`}
      >
        <span
          class={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            props.value ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [val, setVal] = createSignal(props.value);
  return (
    <div class="space-y-1">
      <label class="text-[10px] font-black uppercase tracking-widest text-gray-500">
        {props.label}
      </label>
      <input
        type="text"
        value={val()}
        placeholder={props.placeholder}
        onInput={(e) => setVal(e.currentTarget.value)}
        onBlur={() => val() !== props.value && props.onSave(val())}
        class="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-sm focus:border-cyan-500/50 outline-none"
      />
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onSave: (v: number) => void;
}) {
  const [val, setVal] = createSignal(props.value);
  return (
    <div class="space-y-1">
      <label class="text-[10px] font-black uppercase tracking-widest text-gray-500">
        {props.label}
      </label>
      <input
        type="number"
        value={val()}
        min={props.min}
        max={props.max}
        onInput={(e) => setVal(Number(e.currentTarget.value))}
        onBlur={() => val() !== props.value && props.onSave(val())}
        class="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-sm font-mono focus:border-cyan-500/50 outline-none"
      />
    </div>
  );
}