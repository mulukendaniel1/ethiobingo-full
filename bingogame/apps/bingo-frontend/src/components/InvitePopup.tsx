// apps/bingo-frontend/src/components/InvitePopup.tsx
import { For, Show } from 'solid-js';
import { showToast } from './Toast';

interface InvitePopupProps {
  userId: string;
  token: string;
  referralData: any;
  loading: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export default function InvitePopup(props: InvitePopupProps) {
  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'ethio_bingoobot';
  const referralLink = () =>
    props.referralData
      ? `https://t.me/${botUsername}?start=ref_${props.referralData.referralCode}`
      : '';

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink());
    showToast(props.t('invite.copied'), 'success');
  };

  const commissionHistory = props.referralData?.commissionHistory || [];

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
          border: '1px solid rgba(34,211,238,0.12)',
          'border-bottom': 'none',
          'border-radius': '24px 24px 0 0',
          'padding-bottom': 'env(safe-area-inset-bottom, 12px)',
          animation: 'inviteSheetUp 0.3s cubic-bezier(0.32,0.72,0,1)',
          'box-shadow': '0 -8px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-9 h-1 rounded-full bg-white/10" />
        </div>

        <div class="px-5 pb-5 pt-2">
          {/* Header */}
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-lg font-black text-white uppercase tracking-wider">{props.t('invite.title')}</h2>
              <p class="text-[11px] text-gray-500">Earn ETB for every friend you bring</p>
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

          <Show when={!props.loading && props.referralData} fallback={
            <div class="py-10 flex flex-col items-center justify-center gap-3">
              <div class="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span class="text-xs text-gray-500">Loading referral data…</span>
            </div>
          }>

            {/* Stats row */}
            <div class="grid grid-cols-2 gap-2 mb-4">
              <div class="rounded-2xl p-4" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)' }}>
                <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">{props.t('invite.referrals')}</div>
                <div class="text-2xl font-black text-white tabular-nums">{props.referralData.referralCount || 0}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">friends</div>
              </div>
              <div class="rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">{props.t('invite.earnings')}</div>
                <div class="text-2xl font-black text-white tabular-nums">
                  {props.referralData.referralEarnings?.toFixed(0) || '0'}
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5">ETB earned</div>
              </div>
            </div>

            {/* Referral code block */}
            <div class="rounded-2xl p-4 mb-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">{props.t('invite.code')}</div>
              <div class="flex items-center justify-between">
                <code class="text-lg font-mono font-black text-white tracking-widest">
                  {props.referralData.referralCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(props.referralData.referralCode);
                    showToast('Code copied!', 'success');
                  }}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all active:scale-95"
                  style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.2)', color: '#22D3EE' }}
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div class="flex gap-2 mb-4">
              <button
                onClick={copyLink}
                class="flex-1 py-3.5 rounded-xl font-black uppercase tracking-wider text-sm text-white transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #22D3EE, #0EA5E9)', 'box-shadow': '0 4px 16px rgba(14,165,233,0.3)' }}
              >
                {props.t('invite.copy_link')}
              </button>
              <button
                onClick={() => window.open(referralLink(), '_blank')}
                class="flex-1 py-3.5 rounded-xl font-black uppercase tracking-wider text-sm text-gray-300 transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {props.t('invite.share')}
              </button>
            </div>

            {/* Commission history */}
            <Show when={commissionHistory.length > 0}>
              <div>
                <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {props.t('invite.recent_commissions')}
                </div>
                <div class="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                  <For each={commissionHistory}>
                    {(c: any) => (
                      <div class="flex justify-between items-center px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span class="text-[11px] font-black text-emerald-400">+{c.amount.toFixed(2)} ETB</span>
                        <span class="text-[10px] text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

          </Show>
        </div>
      </div>

      <style>{`
        @keyframes inviteSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}