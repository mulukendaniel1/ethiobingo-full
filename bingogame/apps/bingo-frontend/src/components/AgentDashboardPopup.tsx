// apps/bingo-frontend/src/components/AgentDashboardPopup.tsx
import { createSignal, onMount, Show, For } from 'solid-js';

interface AgentDashboardPopupProps {
  token: string;
  onClose: () => void;
  t: (key: string) => string;
}

export default function AgentDashboardPopup(props: AgentDashboardPopupProps) {
  const [data, setData] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'overview' | 'referrals' | 'commissions'>('overview');

  onMount(async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/user/agent-dashboard?token=${props.token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load agent data');
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  });

  // ── Stat chip ─────────────────────────────────────────────────────
  const StatCard = (p: { label: string; value: string; sub?: string; accent: string }) => (
    <div
      class="rounded-2xl p-3.5"
      style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${p.accent}22` }}
    >
      <div class="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#666' }}>
        {p.label}
      </div>
      <div class="text-xl font-black text-white tabular-nums leading-tight">{p.value}</div>
      <Show when={p.sub}>
        <div class="text-[10px] text-gray-500 mt-0.5">{p.sub}</div>
      </Show>
    </div>
  );

  // ── Tab button ────────────────────────────────────────────────────
  const TabBtn = (p: { id: 'overview' | 'referrals' | 'commissions'; label: string }) => (
    <button
      onClick={() => setActiveTab(p.id)}
      class={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
        activeTab() === p.id
          ? 'text-white'
          : 'text-gray-500 hover:text-gray-300'
      }`}
      style={
        activeTab() === p.id
          ? {
              background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(14,165,233,0.15))',
              border: '1px solid rgba(34,211,238,0.35)',
              'box-shadow': '0 0 12px rgba(34,211,238,0.15)',
            }
          : { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }
      }
    >
      {p.label}
    </button>
  );

  const shortName = (u: any) =>
    u.username ? `@${u.username}` : `${u.firstName || 'User'}`;

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  return (
    <div
      class="fixed inset-0 z-[10000] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', 'backdrop-filter': 'blur(14px)' }}
      onClick={props.onClose}
    >
      <div
        class="w-full max-w-sm overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #33205C 0%, #241541 100%)',
          border: '1px solid rgba(34,211,238,0.15)',
          'border-bottom': 'none',
          'border-radius': '24px 24px 0 0',
          'padding-bottom': 'env(safe-area-inset-bottom, 12px)',
          animation: 'agentSheetUp 0.3s cubic-bezier(0.32,0.72,0,1)',
          'box-shadow': '0 -8px 40px rgba(0,0,0,0.5)',
          'max-height': '92vh',
          display: 'flex',
          'flex-direction': 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div class="w-9 h-1 rounded-full bg-white/10" />
        </div>

        {/* Header */}
        <div class="px-5 pt-2 pb-3 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.18))',
                  border: '1px solid rgba(34,211,238,0.3)',
                }}
              >
                {/* Agent icon */}
                <svg class="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75M12 14a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              </div>
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider leading-tight">
                  Agent Dashboard
                </h2>
                <p class="text-[10px] text-cyan-400/70 font-medium">
                  Performance & earnings overview
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div class="flex-1 overflow-y-auto custom-scrollbar px-5 pb-5">
          <Show
            when={!loading()}
            fallback={
              <div class="py-16 flex flex-col items-center gap-3">
                <div class="w-9 h-9 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                <span class="text-xs text-gray-500">Loading your stats…</span>
              </div>
            }
          >
            <Show
              when={!error()}
              fallback={
                <div class="py-12 text-center">
                  <div class="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-3">
                    <svg class="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" stroke-linecap="round" />
                    </svg>
                  </div>
                  <p class="text-sm text-rose-400 font-bold">{error()}</p>
                </div>
              }
            >
              {/* Tabs */}
              <div class="flex gap-1.5 mb-4">
                <TabBtn id="overview" label="Overview" />
                <TabBtn id="referrals" label="Referrals" />
                <TabBtn id="commissions" label="Earnings" />
              </div>

              {/* ── OVERVIEW TAB ── */}
              <Show when={activeTab() === 'overview'}>
                {/* Hero stat */}
                <div
                  class="rounded-3xl p-5 mb-3 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                    border: '1px solid rgba(34,211,238,0.25)',
                  }}
                >
                  <div class="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-cyan-400/20 blur-2xl" />
                  <div class="relative">
                    <div class="text-[9px] font-black uppercase tracking-widest text-cyan-300/80 mb-1">
                      Total Lifetime Earnings
                    </div>
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-3xl font-black text-white tabular-nums">
                        {(
                          (data()?.commissionOnly || 0) +
                          (data()?.firstDepositOnly || 0) +
                          (data()?.signupBonuses || 0)
                        ).toFixed(2)}
                      </span>
                      <span class="text-sm font-bold text-cyan-300">ETB</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                      <div>
                        <div class="flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span class="text-gray-400">Commission</span>
                        </div>
                        <div class="font-bold text-emerald-300 tabular-nums mt-0.5">
                          {(data()?.commissionOnly || 0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div class="flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span class="text-gray-400">Bonus</span>
                        </div>
                        <div class="font-bold text-amber-300 tabular-nums mt-0.5">
                          {(data()?.firstDepositOnly || 0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div class="flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <span class="text-gray-400">Signup</span>
                        </div>
                        <div class="font-bold text-cyan-300 tabular-nums mt-0.5">
                          {(data()?.signupBonuses || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div class="grid grid-cols-2 gap-2 mb-3">
                  <StatCard
                    label="Referrals"
                    value={`${data()?.stats.totalReferrals || 0}`}
                    sub="active users"
                    accent="#22D3EE"
                  />
                  <StatCard
                    label="Referred Deposits"
                    value={`${(data()?.stats.totalReferredDeposits || 0).toFixed(0)}`}
                    sub="ETB total"
                    accent="#22C55E"
                  />
                  <StatCard
                    label="Avg Deposit"
                    value={`${(data()?.stats.averageDeposit || 0).toFixed(0)}`}
                    sub="per referral"
                    accent="#8B5CF6"
                  />
                  <StatCard
                    label="Earnings (30d)"
                    value={`${(data()?.stats.earnedLast30Days || 0).toFixed(0)}`}
                    sub={`${(data()?.stats.earnedLast7Days || 0).toFixed(0)} ETB last 7d`}
                    accent="#F59E0B"
                  />
                </div>

                {/* Agent info */}
                <div
                  class="rounded-2xl p-4"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Agent Profile
                  </div>
                  <div class="space-y-2 text-xs">
                    <div class="flex justify-between">
                      <span class="text-gray-500">Referral Code</span>
                      <span class="font-mono font-black text-cyan-300 tracking-wider">
                        {data()?.referralCode}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Agent Since</span>
                      <span class="text-white font-bold">
                        {data()?.agentApprovedAt
                          ? new Date(data().agentApprovedAt).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </Show>

              {/* ── REFERRALS TAB ── */}
              <Show when={activeTab() === 'referrals'}>
                <Show
                  when={data()?.referredUsers?.length > 0}
                  fallback={
                    <div class="py-12 text-center">
                      <div class="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                        <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75M12 14a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                      </div>
                      <p class="text-sm text-gray-500">No referrals yet</p>
                      <p class="text-[10px] text-gray-600 mt-1">Share your link to get started</p>
                    </div>
                  }
                >
                  <div class="space-y-1.5">
                    <For each={data().referredUsers}>
                      {(u: any) => (
                        <div
                          class="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div
                            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black"
                            style={{
                              background: 'rgba(34,211,238,0.1)',
                              border: '1px solid rgba(34,211,238,0.2)',
                              color: '#22D3EE',
                            }}
                          >
                            {(u.firstName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-white truncate">
                              {shortName(u)}
                            </div>
                            <div class="text-[10px] text-gray-500">
                              Joined {timeAgo(u.createdAt)}
                            </div>
                          </div>
                          <div class="text-right flex-shrink-0">
                            <div class="text-xs font-black text-emerald-400 tabular-nums">
                              {(u.totalConfirmedDepositsETB || 0).toFixed(0)}
                            </div>
                            <div class="text-[9px] text-gray-600">ETB</div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>

              {/* ── COMMISSIONS TAB ── */}
              <Show when={activeTab() === 'commissions'}>
                <Show
                  when={data()?.recentCommissions?.length > 0}
                  fallback={
                    <div class="py-12 text-center">
                      <div class="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                        <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12V6m0 12v-1m0-10c2.21 0 4 1.343 4 3" />
                        </svg>
                      </div>
                      <p class="text-sm text-gray-500">No commissions yet</p>
                      <p class="text-[10px] text-gray-600 mt-1">
                        You'll see earnings here when your referrals deposit
                      </p>
                    </div>
                  }
                >
                  <div class="space-y-1.5">
                    <For each={data().recentCommissions}>
                      {(c: any) => {
                        const isFirst = c.type === 'first_deposit';
                        const isSignup = c.type === 'signup';
                        const color = isSignup ? '#22D3EE' : isFirst ? '#F59E0B' : '#22C55E';
                        const bg = isSignup ? 'rgba(34,211,238,0.12)' : isFirst ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
                        const border = isSignup ? 'rgba(34,211,238,0.25)' : isFirst ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)';
                        const label = isSignup ? 'Signup Bonus' : isFirst ? 'First Deposit Bonus' : 'Commission';
                        return (
                          <div
                            class="flex items-center gap-3 p-3 rounded-xl"
                            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
                          >
                            <div
                              class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: bg, border: `1px solid ${border}` }}
                            >
                              <svg class="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke-linecap="round" />
                              </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="text-xs font-bold text-white">{label}</div>
                              <div class="text-[10px] text-gray-500 truncate">
                                {timeAgo(c.timestamp)}
                              </div>
                            </div>
                            <div class="text-right flex-shrink-0">
                              <div class="text-sm font-black text-emerald-400 tabular-nums">
                                +{c.amount.toFixed(2)}
                              </div>
                              <div class="text-[9px] text-gray-600">ETB</div>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </Show>
        </div>
      </div>

      <style>{`
        @keyframes agentSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}