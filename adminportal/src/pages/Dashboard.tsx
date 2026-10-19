// src/pages/Dashboard.tsx
import { createSignal, Show, onMount, For, createEffect } from 'solid-js';
import { useAuth } from '../context/auth';
import { apiFetch } from '../api/client';
import StatsFilters from '../components/StatsFilters';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import Chart from 'chart.js/auto';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [botStatus, setBotStatus] = createSignal<{ isActive: boolean } | null>(null);
  const [advancedStats, setAdvancedStats] = createSignal<any>(null);
  const [advancedLoading, setAdvancedLoading] = createSignal(false);
  const [activeFilters, setActiveFilters] = createSignal<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [gamePaused, setGamePaused] = createSignal(false);
  const [gameLoading, setGameLoading] = createSignal(false);
  const [passwordConfirm, setPasswordConfirm] = createSignal<{
    open: boolean;
    title: string;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, title: '', onConfirm: async () => {} });

  // ──────────────────────── data fetching ────────────────────────
  const fetchBotStatus = async () => {
    const data = await apiFetch<{ isActive: boolean }>('/admin/bot/status').catch(() => null);
    if (data) setBotStatus(data);
  };

  const fetchStats = async (from: Date | null, to: Date | null) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.append('from', from.toISOString());
    if (to) params.append('to', to.toISOString());
    try {
      const data = await apiFetch<any>(`/admin/stats?${params.toString()}`);
      setStats(data);
    } catch (err) {
      showToast('Failed to load statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvancedStats = async (from: Date | null, to: Date | null) => {
    setAdvancedLoading(true);
    const params = new URLSearchParams();
    if (from) params.append('from', from.toISOString());
    if (to) params.append('to', to.toISOString());
    try {
      const data = await apiFetch<any>(`/admin/stats/advanced?${params.toString()}`);
      setAdvancedStats(data);
      setTimeout(() => renderCharts(data), 100);
    } catch (err) {
      console.error('Failed to fetch advanced stats:', err);
    } finally {
      setAdvancedLoading(false);
    }
  };

  const fetchGameStatus = async () => {
    try {
      const data = await apiFetch<{ gamePaused: boolean }>('/admin/game/status');
      setGamePaused(data.gamePaused);
    } catch (err) {}
  };

  const toggleGame = () => {
    setPasswordConfirm({
      open: true,
      title: gamePaused() ? 'Confirm Game Resume' : 'Confirm Game Pause',
      onConfirm: async (password: string) => {
        const action = gamePaused() ? 'resume' : 'pause';
        try {
          await apiFetch(`/admin/game/${action}`, {
            method: 'POST',
            body: JSON.stringify({ settingsPassword: password }),
          });
          setGamePaused(!gamePaused());
          showToast(`Game ${action === 'pause' ? 'paused' : 'resumed'}`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Failed to toggle game', 'error');
        }
      }
    });
  };

  const handleRangeChange = (from: Date | null, to: Date | null) => {
    setActiveFilters({ from, to });
    fetchStats(from, to);
    fetchAdvancedStats(from, to);
  };

  const toggleBot = () => {
    setPasswordConfirm({
      open: true,
      title: botStatus()?.isActive ? 'Confirm Bot Pause' : 'Confirm Bot Resume',
      onConfirm: async (password: string) => {
        const action = botStatus()?.isActive ? 'pause' : 'resume';
        try {
          await apiFetch(`/admin/bot/${action}`, {
            method: 'POST',
            body: JSON.stringify({ settingsPassword: password }),
          });
          showToast(`System ${action === 'pause' ? 'Paused' : 'Resumed'}`, 'success');
          fetchBotStatus();
        } catch (err: any) {
          showToast(err.message || 'Command Failed', 'error');
        }
      }
    });
  };

  // ──────────────────────── chart rendering ────────────────────────
  const renderCharts = (data: any) => {
    if (!data) return;
    const chartIds = ['userRegChart', 'activeUsersChart', 'depositWithdrawChart', 'profitChart'];
    chartIds.forEach(id => {
      const existingChart = Chart.getChart(id);
      if (existingChart) existingChart.destroy();
    });

    const dates = data.userRegistrations.map((d: any) => d._id);

    if (document.getElementById('userRegChart')) {
      new Chart('userRegChart', {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'New Users',
            data: data.userRegistrations.map((d: any) => d.count),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#10b981',
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    if (document.getElementById('activeUsersChart')) {
      new Chart('activeUsersChart', {
        type: 'bar',
        data: {
          labels: data.activeUsers.map((d: any) => d._id),
          datasets: [{
            label: 'Active Users',
            data: data.activeUsers.map((d: any) => d.count),
            backgroundColor: 'rgba(16, 185, 129, 0.5)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6,
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    if (document.getElementById('depositWithdrawChart')) {
      new Chart('depositWithdrawChart', {
        type: 'line',
        data: {
          labels: data.dailyDeposits.map((d: any) => d._id),
          datasets: [
            {
              label: 'Deposits',
              data: data.dailyDeposits.map((d: any) => d.totalAmount),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.3,
              fill: true
            },
            {
              label: 'Withdrawals',
              data: data.dailyWithdrawals.map((d: any) => d.totalAmount),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    if (document.getElementById('profitChart')) {
      new Chart('profitChart', {
        type: 'line',
        data: {
          labels: data.dailyProfit.map((d: any) => d._id),
          datasets: [{
            label: 'GGR (Daily)',
            data: data.dailyProfit.map((d: any) => d.netProfit),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            tension: 0.3,
            fill: true
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
  };

  // ──────────────────────── liability doughnut ────────────────────────
  const renderLiabilityChart = (liability: any) => {
    const canvas = document.getElementById('liabilityChart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const existing = Chart.getChart('liabilityChart');
    if (existing) existing.destroy();

    const withdrawable = liability?.totalWithdrawable ?? 0;
    const bonusPool    = liability?.totalBonus ?? 0;
    // Deposit-origin locked = locked total − bonus portion
    const depositLocked = Math.max(
      0,
      (liability?.totalLocked ?? 0) - (liability?.totalBonus ?? 0)
    );

    new Chart('liabilityChart', {
      type: 'doughnut',
      data: {
        labels: ['Withdrawable', 'Locked Deposit', 'Bonus Pool'],
        datasets: [{
          data: [withdrawable, depositLocked, bonusPool],
          backgroundColor: [
            'rgba(34, 197, 94, 0.75)',    // emerald
            'rgba(34, 211, 238, 0.75)',   // cyan
            'rgba(168, 85, 247, 0.75)',   // violet
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(34, 211, 238, 1)',
            'rgba(168, 85, 247, 1)',
          ],
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.9)',
            borderColor: 'rgba(34,211,238,0.4)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx: any) => {
                const total = ctx.dataset.data.reduce((s: number, v: number) => s + v, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
                return `${ctx.label}: ${ctx.parsed.toFixed(2)} ETB (${pct}%)`;
              },
            },
          },
        },
      },
    });
  };

  // Re-render doughnut whenever stats change
  createEffect(() => {
    const s = stats();
    if (s?.liability) {
      setTimeout(() => renderLiabilityChart(s.liability), 60);
    }
  });

  onMount(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    Promise.all([
      fetchBotStatus(),
      fetchGameStatus(),
      fetchStats(start, end),
      fetchAdvancedStats(start, end),
    ]).catch(() => {});
  });

  return (
    <div class="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">

      {/* Hero */}
      <div class="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-black p-6 lg:p-8">
        <div class="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-xl bg-cyan-400/20 flex items-center justify-center">
                <svg class="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h1 class="text-2xl lg:text-3xl font-black text-white italic tracking-tighter uppercase">Dashboard</h1>
            </div>
            <p class="text-gray-400 text-xs font-bold uppercase tracking-[0.3em]">Real-time performance overview</p>
          </div>
          <StatsFilters onRangeChange={handleRangeChange} />
        </div>
      </div>

      {/* System Status */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="glass-dark rounded-2xl p-5 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${botStatus()?.isActive ? 'bg-cyan-500/10 text-cyan-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-wider">Bot System</p>
              <p class={`text-sm font-bold ${botStatus()?.isActive ? 'text-cyan-400' : 'text-rose-400'}`}>
                {botStatus()?.isActive ? 'Operational' : 'Offline'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleBot}
            class={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              botStatus()?.isActive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' : 'bg-cyan-500 text-black hover:bg-cyan-400'
            }`}
          >
            {botStatus()?.isActive ? 'Stop' : 'Start'}
          </button>
        </div>

        <div class="glass-dark rounded-2xl p-5 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${gamePaused() ? 'bg-rose-500/10 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-wider">Game Server</p>
              <p class={`text-sm font-bold ${gamePaused() ? 'text-rose-400' : 'text-cyan-400'}`}>
                {gamePaused() ? 'Paused' : 'Running'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleGame}
            disabled={gameLoading()}
            class={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              gamePaused() ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
            }`}
          >
            {gamePaused() ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* KPI row — 5 unique headline numbers, no duplicates below */}
      <Show when={!loading() && stats()} fallback={<DashboardSkeleton />}>
        {(s) => (
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard icon="users"  label="Total Users"  value={s().userStats.totalUsers}  color="cyan" />
            <MetricCard icon="active" label="Active (7d)"  value={s().userStats.activeUsers} color="cyan" />
            <MetricCard icon="profit" label="GGR"          value={s().profitStats?.ggr ?? 0} prefix="ETB" color="violet" />
            <MetricCard
              icon="profit"
              label="Net Cash"
              value={s().cashFlow?.netCashFlow ?? 0}
              prefix="ETB"
              color={(s().cashFlow?.netCashFlow ?? 0) >= 0 ? 'cyan' : 'rose'}
            />
            <MetricCard icon="balance" label="User Liability" value={s().liability?.totalETBCoins ?? 0} prefix="ETB" color="gray" />
          </div>
        )}
      </Show>

      {/* Secondary user metrics — small, only admins + banned */}
      <Show when={!loading() && stats()}>
        {(s) => (
          <div class="grid grid-cols-2 gap-4">
            <MetricCard icon="users"  label="Admins"        value={s().userStats.adminUsers}  color="gray" />
            <MetricCard icon="banned" label="Banned Users"  value={s().userStats.bannedUsers} color="rose" />
          </div>
        )}
      </Show>

      {/* Wagering */}
      <Show when={!loading() && stats()}>
        {(s) => (
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="h-8 w-1 bg-gradient-to-b from-cyan-400 to-violet-600 rounded-full" />
              <h2 class="text-xl font-black text-white uppercase tracking-tight">Wagering</h2>
              <span class="text-[10px] text-gray-400 font-bold ml-2">REAL USERS ONLY</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard icon="rounds" label="Rounds"       value={s().profitStats.roundCount}             color="gray" />
              <MetricCard icon="stake"  label="Staked Today" value={s().profitStats.totalStakedToday ?? 0}  prefix="ETB" color="gray" />
              <MetricCard icon="stake"  label="Staked Week"  value={s().profitStats.totalStakedWeek ?? 0}   prefix="ETB" color="gray" />
              <MetricCard icon="stake"  label="Staked Month" value={s().profitStats.totalStakedMonth ?? 0}  prefix="ETB" color="gray" />
            </div>
          </div>
        )}
      </Show>

      {/* Financial + Liability doughnut */}
      <Show when={!loading() && stats()}>
        {(s) => (
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="h-8 w-1 bg-gradient-to-b from-emerald-400 to-cyan-600 rounded-full" />
              <h2 class="text-xl font-black text-white uppercase tracking-tight">Financial</h2>
              <span class="text-[10px] text-gray-400 font-bold ml-2">REAL MONEY FLOW</span>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 2/3 — Cash flow + gaming */}
              <div class="lg:col-span-2 space-y-4">
                {/* Row 1 — cash flow */}
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CashCard label="Deposits"    value={s().cashFlow?.deposits ?? 0}    sub={`${s().cashFlow?.depositCount ?? 0} deposits`}       color="cyan" />
                  <CashCard label="Withdrawals" value={s().cashFlow?.withdrawals ?? 0} sub={`${s().cashFlow?.withdrawalCount ?? 0} withdrawals`} color="rose" />
                  <CashCard label="Commissions" value={s().cashFlow?.commissions ?? 0} sub="paid to agents"                                       color="violet" />
                </div>

                {/* Row 2 — gaming */}
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CashCard label="Wagered (Real)"    value={s().profitStats?.totalStaked ?? 0} sub={`${s().profitStats?.roundCount ?? 0} rounds`} color="cyan" />
                  <CashCard label="Paid Out (Wins)"   value={s().profitStats?.totalPayout ?? 0} sub="real users only"                            color="rose" />
                  <CashCard label="Commissions (agents)" value={s().cashFlow?.commissions ?? 0} sub="lifetime period"                            color="violet" />
                </div>
              </div>

              {/* Right 1/3 — Liability doughnut */}
              <div class="glass-dark rounded-2xl p-5 border border-cyan-500/10 flex flex-col">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xs font-black text-white uppercase tracking-widest">Liability Split</h3>
                  <span class="text-[9px] text-gray-500 font-mono">live</span>
                </div>

                {/* Chart */}
                <div class="relative h-48 mb-4">
                  <canvas id="liabilityChart"></canvas>
                  {/* Center label */}
                  <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span class="text-[9px] text-gray-500 uppercase tracking-widest">Total</span>
                    <span class="text-lg font-black text-white tabular-nums leading-none mt-0.5">
                      {(s().liability?.totalETBCoins ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span class="text-[9px] text-gray-500 font-bold">ETB</span>
                  </div>
                </div>

                {/* Legend / breakdown */}
                <div class="space-y-2 mt-auto">
                  <LiabilityRow
                    color="#22C55E"
                    label="Withdrawable"
                    value={s().liability?.totalWithdrawable ?? 0}
                  />
                  <LiabilityRow
                    color="#22D3EE"
                    label="Locked (deposit)"
                    value={Math.max(0, (s().liability?.totalLocked ?? 0) - (s().liability?.totalBonus ?? 0))}
                  />
                  <LiabilityRow
                    color="#A855F7"
                    label="Bonus Pool"
                    value={s().liability?.totalBonus ?? 0}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Charts */}
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="h-8 w-1 bg-gradient-to-b from-cyan-400 to-violet-600 rounded-full" />
          <h2 class="text-xl font-black text-white uppercase tracking-tight">Analytics</h2>
          <span class="text-[10px] text-gray-400 font-bold ml-2">ADVANCED CHARTS</span>
        </div>

        <Show when={!advancedLoading() && advancedStats()} fallback={
          <div class="flex justify-center py-20">
            <div class="w-10 h-10 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        }>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="glass-dark rounded-2xl p-6">
              <div class="flex items-center gap-2 mb-6">
                <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h3 class="text-sm font-black text-gray-200 uppercase tracking-wider">New Users</h3>
              </div>
              <div class="h-64"><canvas id="userRegChart"></canvas></div>
            </div>
            <div class="glass-dark rounded-2xl p-6">
              <div class="flex items-center gap-2 mb-6">
                <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h3 class="text-sm font-black text-gray-200 uppercase tracking-wider">Active Users</h3>
              </div>
              <div class="h-64"><canvas id="activeUsersChart"></canvas></div>
            </div>
            <div class="glass-dark rounded-2xl p-6">
              <div class="flex items-center gap-2 mb-6">
                <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h3 class="text-sm font-black text-gray-200 uppercase tracking-wider">Deposits vs Withdrawals</h3>
              </div>
              <div class="h-64"><canvas id="depositWithdrawChart"></canvas></div>
            </div>
            <div class="glass-dark rounded-2xl p-6">
              <div class="flex items-center gap-2 mb-6">
                <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h3 class="text-sm font-black text-gray-200 uppercase tracking-wider">GGR (Daily)</h3>
              </div>
              <div class="h-64"><canvas id="profitChart"></canvas></div>
            </div>
          </div>
        </Show>
      </div>

      <PasswordConfirmDialog
        open={passwordConfirm().open}
        title={passwordConfirm().title}
        onConfirm={passwordConfirm().onConfirm}
        onCancel={() => setPasswordConfirm({ open: false, title: '', onConfirm: async () => {} })}
      />
    </div>
  );
}

// ─────────── Helper components ───────────

function MetricCard(props: { label: string; value: number; prefix?: string; color: string; icon: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    rose: 'text-rose-400',
    gray: 'text-gray-400',
  };
  return (
    <div class="glass-dark rounded-2xl p-5 group hover:border-cyan-400/30 transition-all duration-300 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-3">
          <div class={colorMap[props.color] || 'text-gray-400'}>
            <Icon name={props.icon as any} class="w-4 h-4" />
          </div>
          <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest">{props.label}</span>
        </div>
        <div class="flex items-baseline gap-1">
          <Show when={props.prefix}>
            <span class="text-xs font-bold text-gray-500">{props.prefix}</span>
          </Show>
          <span class="text-2xl font-black text-white group-hover:scale-105 transition-transform duration-300 tabular-nums">
            {props.value.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
      <For each={[1, 2, 3, 4, 5]}>
        {() => <div class="h-28 bg-white/5 rounded-2xl border border-white/5" />}
      </For>
    </div>
  );
}

function CashCard(props: {
  label: string;
  value: number;
  sub?: string;
  color: 'cyan' | 'rose' | 'emerald' | 'violet' | 'amber' | 'gray';
}) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400',
    rose: 'text-rose-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    gray: 'text-gray-300',
  };
  return (
    <div class="glass-dark rounded-2xl p-4 border border-cyan-500/10 group hover:border-cyan-400/30 transition-all">
      <div class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
        {props.label}
      </div>
      <div class={`text-xl font-black ${colorMap[props.color]} tabular-nums`}>
        {props.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        <span class="text-xs font-bold text-gray-500 ml-1">ETB</span>
      </div>
      <Show when={props.sub}>
        <div class="text-[9px] text-gray-500 mt-1">{props.sub}</div>
      </Show>
    </div>
  );
}

function LiabilityRow(props: { color: string; label: string; value: number }) {
  return (
    <div class="flex items-center justify-between text-[10px]">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" style={{ background: props.color }} />
        <span class="text-gray-400 font-bold uppercase tracking-wider">{props.label}</span>
      </div>
      <span class="text-white font-black tabular-nums">
        {props.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}