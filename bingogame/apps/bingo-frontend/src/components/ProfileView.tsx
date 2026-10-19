// apps/bingo-frontend/src/components/ProfileView.tsx
import { createSignal, Show, onMount } from 'solid-js';
import WalletPopup from './WalletPopup';
import InvitePopup from './InvitePopup';
import AgentDashboardPopup from './AgentDashboardPopup';
import { showToast } from './Toast';

interface ProfileViewProps {
  userData: any;
  token: string;
  t: (key: string) => string;
}

export default function ProfileView(props: ProfileViewProps) {
  const [showWallet, setShowWallet] = createSignal(false);
  const [showInvite, setShowInvite] = createSignal(false);
  const [referralData, setReferralData] = createSignal<any>(null);
  const [loadingReferral, setLoadingReferral] = createSignal(false);
  const [codeCopied, setCodeCopied] = createSignal(false);
  const [showAgentDashboard, setShowAgentDashboard] = createSignal(false);

  const loadReferralData = async () => {
    if (!props.token) return;
    setLoadingReferral(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/user/referral?token=${props.token}`);
      if (res.ok) {
        const data = await res.json();
        setReferralData(data);
      } else {
        console.error('Failed to load referral data');
      }
    } catch (err) {
      console.error('Referral API error:', err);
    } finally {
      setLoadingReferral(false);
    }
  };

  onMount(() => { loadReferralData(); });

  const copyReferralCode = () => {
    const code = referralData()?.referralCode || props.userData.referralCode;
    if (!code) { showToast('Referral code not available', 'error'); return; }
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    showToast('Referral code copied!', 'success');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // ── Stat chip ────────────────────────────────────────────────────────────
  const StatChip = (p: { label: string; value: string; accent: string }) => (
    <div class="rounded-2xl p-3.5" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${p.accent}18` }}>
      <div class="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#555' }}>{p.label}</div>
      <div class="text-xl font-black text-white tabular-nums">{p.value}</div>
    </div>
  );

  return (
    <div class="h-full overflow-y-auto custom-scrollbar px-4 pt-4 pb-24 max-w-sm mx-auto">

      {/* ── Profile card ── */}
      <div class="rounded-3xl p-5 mb-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(0,0,0,0.3) 100%)',
          border: '1px solid rgba(34,211,238,0.14)',
        }}>
        <div class="flex items-center gap-4">
          {/* Avatar */}
          <div class="relative flex-shrink-0">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.25)' }}>
              {/* Bingo-grid avatar icon */}
              <svg class="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.6" />
              </svg>
            </div>
            {/* Online indicator */}
            <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2"
              style={{ 'border-color': '#241541' }} />
          </div>

          {/* Name + username */}
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-black text-white truncate">{props.userData.firstName}</h2>
            <p class="text-[11px] text-indigo-400/80 font-medium">@{props.userData.username || 'user'}</p>
          </div>
        </div>

        {/* Referral code row */}
        <div class="flex items-center justify-between mt-4 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div class="flex items-center gap-2">
            <span class="text-[9px] font-bold uppercase tracking-widest text-gray-600">Ref code</span>
            <code class="text-xs font-mono font-black text-indigo-300 tracking-wider">
              {referralData()?.referralCode || props.userData.referralCode || '…'}
            </code>
          </div>
          <button
            onClick={copyReferralCode}
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
            style={{
              background: codeCopied() ? 'rgba(34,197,94,0.12)' : 'rgba(34,211,238,0.1)',
              border: codeCopied() ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(34,211,238,0.18)',
              color: codeCopied() ? '#22C55E' : '#22D3EE',
            }}
          >
            {codeCopied() ? (
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {codeCopied() ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* ── Referral stats ── */}
      <Show when={referralData()}>
        <div class="grid grid-cols-2 gap-2 mb-4">
          <StatChip
            label="Referrals"
            value={`${referralData()?.referralCount || 0}`}
            accent="#22D3EE"
          />
          <StatChip
            label="Earned"
            value={`${(referralData()?.referralEarnings || 0).toFixed(0)} ETB`}
            accent="#22C55E"
          />
        </div>
      </Show>

            {/* ── Bonus Clear Progress ── */}
      <Show when={(props.userData?.lockedBalance || 0) > 0}>
        <Show
          when={!props.userData?.isAgent}
          fallback={
            <div class="mb-4 rounded-2xl p-4"
              style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}>
              <div class="text-[9px] font-bold uppercase tracking-widest text-cyan-400 mb-1">
                Agent Account
              </div>
              <div class="text-sm font-black text-white">Withdrawals Unlocked</div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                Locked bonus does not restrict your withdrawals.
              </div>
            </div>
          }
        >
        {(() => {
          const locked = () => props.userData?.lockedBalance || 0;
          const threshold = 10;
          const cleared = () => locked() < threshold;
          // Progress: 0% when locked >= threshold+? (round up to next 10 for a
          // clear visual scale). We'll use `threshold + ceil(locked - threshold)`.
          const denominator = () => Math.max(threshold, locked());
          const pct = () => Math.min(100, Math.round(((denominator() - locked()) / (denominator() - threshold)) * 100));
          // Simpler: show spend progress on the excess above threshold.
          const remaining = () => Math.max(0, locked() - threshold);
          const spendPct = () => {
            if (locked() < threshold) return 100;
            // If locked is between 10 and 60, progress = (1 - (locked-10)/50) * 100
            // We cap at 60 to make the bar meaningful when locked is large.
            const scale = Math.max(60, Math.ceil(locked() / 10) * 10);
            const total = scale - threshold;
            const done = Math.max(0, total - remaining());
            return Math.round((done / total) * 100);
          };

          return (
            <div class="mb-4">
              <div class="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-1">
                Withdrawal Status
              </div>
              <div
                class="rounded-2xl p-4"
                style={{
                  background: cleared()
                    ? 'rgba(34,197,94,0.06)'
                    : 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(0,0,0,0.25) 100%)',
                  border: cleared()
                    ? '1px solid rgba(34,197,94,0.2)'
                    : '1px solid rgba(251,191,36,0.25)',
                }}
              >
                <div class="flex items-start gap-3 mb-3">
                  <div
                    class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: cleared() ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                      border: cleared()
                        ? '1px solid rgba(34,197,94,0.3)'
                        : '1px solid rgba(251,191,36,0.3)',
                    }}
                  >
                    <Show
                      when={!cleared()}
                      fallback={
                        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      }
                    >
                      <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" stroke-linecap="round" />
                      </svg>
                    </Show>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-black text-white leading-tight">
                      {cleared() ? 'Withdrawals Unlocked' : 'Bonus Still Locked'}
                    </div>
                    <div class="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                      {cleared()
                        ? 'You can now withdraw your balance.'
                        : `Play ${remaining().toFixed(2)} ETB more to unlock withdrawals.`}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div class="h-1.5 bg-black/40 rounded-full overflow-hidden mb-1.5">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${spendPct()}%`,
                      background: cleared()
                        ? 'linear-gradient(90deg,#22C55E,#16A34A)'
                        : 'linear-gradient(90deg,#FBBF24,#F59E0B)',
                    }}
                  />
                </div>
                <div class="flex items-center justify-between text-[9px] font-bold text-gray-500">
                  <span>{locked().toFixed(2)} ETB locked</span>
                  <span class={cleared() ? 'text-emerald-400' : 'text-amber-400'}>
                    {cleared() ? '✓ Cleared' : `${threshold} ETB target`}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>
    </Show>


      {/* ── Agent card (only if user is an agent) ── */}
<Show when={props.userData?.isAgent}>
  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-1 mt-4">
    Agent Program
  </div>
  <button
    onClick={() => setShowAgentDashboard(true)}
    class="w-full flex items-center gap-4 p-4 rounded-2xl mb-2 text-left transition-all active:scale-[0.98] relative overflow-hidden"
    style={{
      background:
        'linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(139,92,246,0.08) 100%)',
      border: '1px solid rgba(34,211,238,0.25)',
      'box-shadow': '0 0 20px rgba(34,211,238,0.08)',
    }}
  >
    {/* subtle glow */}
    <div class="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" />

    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
      style={{
        background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(139,92,246,0.2))',
        border: '1px solid rgba(34,211,238,0.35)',
      }}
    >
      <svg
        class="w-5 h-5 text-cyan-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75M12 14a4 4 0 100-8 4 4 0 000 8z"
        />
      </svg>
    </div>

    <div class="flex-1 min-w-0 relative z-10">
      <div class="flex items-center gap-2">
        <div class="text-sm font-black text-white">Agent Dashboard</div>
        <span
          class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            background: 'rgba(34,211,238,0.15)',
            border: '1px solid rgba(34,211,238,0.3)',
            color: '#67E8F9',
          }}
        >
          Active
        </span>
      </div>
      <div class="text-[10px] text-gray-400 mt-0.5">
        Track referrals, earnings &amp; performance
      </div>
    </div>

    <svg
      class="w-4 h-4 text-cyan-400/60 flex-shrink-0 relative z-10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  </button>
</Show>

      {/* ── Divider label ── */}
      <div class="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-1">Actions</div>

      {/* ── Wallet action ── */}
      <button
        onClick={() => setShowWallet(true)}
        class="w-full flex items-center gap-4 p-4 rounded-2xl mb-2 text-left transition-all active:scale-[0.98]"
        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}
      >
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.18)' }}>
          <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 11h.01M12 3h4l2 4H6l2-4h4z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-black text-white">{props.t('wallet.title')}</div>
          <div class="text-[10px] text-gray-500">Deposit &amp; withdraw funds</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-sm font-black text-white tabular-nums">{props.userData.balanceMain?.toFixed(0) || 0}</div>
          <div class="text-[9px] text-gray-600">ETB</div>
        </div>
      </button>

      {/* ── Invite action ── */}
      <button
        onClick={() => setShowInvite(true)}
        class="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)' }}
      >
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.18)' }}>
          <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-black text-white">{props.t('invite.title')}</div>
          <div class="text-[10px] text-gray-500">Earn from every friend you refer</div>
        </div>
        <svg class="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* ── Modals ── */}
      <Show when={showWallet()}>
        <WalletPopup
          balanceETB={props.userData.ETBCoins}
          balanceMain={props.userData.balanceMain}
          lockedBalance={props.userData.lockedBalance || 0}
          isAgent={props.userData?.isAgent === true} 
          token={props.token}
          onClose={() => setShowWallet(false)}
          onBalanceRefresh={() => {
            if (props.token) {
              const apiBase = import.meta.env.VITE_API_URL || '';
              fetch(`${apiBase}/api/user/me?token=${props.token}`)
                .then(res => res.json())
                .then(() => window.location.reload())
                .catch(() => {});
            }
          }}
          t={props.t}
        />
      </Show>

      <Show when={showInvite()}>
        <InvitePopup
          userId={props.userData._id}
          token={props.token}
          referralData={referralData()}
          loading={loadingReferral()}
          onClose={() => setShowInvite(false)}
          t={props.t}
        />
      </Show>

      <Show when={showAgentDashboard()}>
        <AgentDashboardPopup
          token={props.token}
          onClose={() => setShowAgentDashboard(false)}
          t={props.t}
        />
      </Show>
    </div>
  );
}