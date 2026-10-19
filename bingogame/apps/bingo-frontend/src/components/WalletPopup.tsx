// apps/bingo-frontend/src/components/WalletPopup.tsx
import { createSignal, Show, onMount } from 'solid-js';

interface WalletPopupProps {
  balanceETB: number;
  balanceMain: number;
  lockedBalance: number;
  isAgent: boolean;            // ← NEW
  token: string;
  onClose: () => void;
  onBalanceRefresh: () => void;
  t: (key: string) => string;
}

export default function WalletPopup(props: WalletPopupProps) {
  const [mode, setMode] = createSignal<'menu' | 'deposit' | 'withdraw'>('menu');
  const [depositReceipt, setDepositReceipt] = createSignal('');
  const [depositLoading, setDepositLoading] = createSignal(false);
  const [depositError, setDepositError] = createSignal('');
  const [depositResult, setDepositResult] = createSignal<any>(null);
  const [depositInfo, setDepositInfo] = createSignal<{ telebirr?: any; cbebirr?: any } | null>(null);

  const [phoneCopied, setPhoneCopied] = createSignal(false);

  const [selectedMethod, setSelectedMethod] = createSignal<'telebirr' | 'cbebirr' | null>(null);
  const [depositStep, setDepositStep] = createSignal<'chooseMethod' | 'info' | 'enterReceipt' | 'result'>('chooseMethod');
  const [withdrawStep, setWithdrawStep] = createSignal<'chooseMethod' | 'info' | 'enterAmount' | 'enterDestination' | 'result'>('chooseMethod');
  const [withdrawAmount, setWithdrawAmount] = createSignal<number>(0);
  const [withdrawDestination, setWithdrawDestination] = createSignal('');
  const [withdrawLoading, setWithdrawLoading] = createSignal(false);
  const [withdrawError, setWithdrawError] = createSignal('');
  const [withdrawResult, setWithdrawResult] = createSignal<any>(null);

const [withdrawEligibility, setWithdrawEligibility] = createSignal<{
  canWithdraw: boolean;
  maxWithdrawableNow: number | null;
  totalConfirmedDepositsETB: number;
  hasPlacedFirstBet: boolean;
  lockedBalance: number;
  bonusCleared: boolean;
  bonusClearThreshold: number;
  isAgent: boolean;            // ← NEW
} | null>(null);
const [eligibilityLoading, setEligibilityLoading] = createSignal(false);

  onMount(() => { fetchDepositInfo(); });

  const fetchDepositInfo = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/user/deposit-info`);
      if (res.ok) {
        const data = await res.json();
        setDepositInfo(data);
      }
    } catch {}
  };

  const submitDeposit = async () => {
    if (!depositReceipt().trim()) return;
    setDepositLoading(true);
    setDepositError('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/user/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${props.token}` },
        body: JSON.stringify({ method: selectedMethod(), receiptText: depositReceipt() }),
      });
      const data = await res.json();
      if (data.success) {
        setDepositResult({ requestId: data.requestId, amount: data.amount, autoConfirmed: data.autoConfirmed });
        setDepositStep('result');
        props.onBalanceRefresh();
      } else {
        setDepositError(data.error || 'Deposit failed');
      }
    } catch {
      setDepositError('Network error. Try again.');
    } finally {
      setDepositLoading(false);
    }
  };

  const fetchWithdrawEligibility = async () => {
  setEligibilityLoading(true);
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(
      `${apiBase}/api/user/withdrawal-eligibility?token=${props.token}`
    );
    if (res.ok) {
      setWithdrawEligibility(await res.json());
    }
  } catch {
  } finally {
    setEligibilityLoading(false);
  }
};

  const submitWithdraw = async () => {
    const phone = withdrawDestination().replace(/\D/g, '');
    if (phone.length !== 10 || !phone.startsWith('09')) {
      setWithdrawError('Invalid phone number. Must start with 09.');
      return;
    }
    setWithdrawLoading(true);
    setWithdrawError('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/user/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${props.token}` },
        body: JSON.stringify({ method: selectedMethod(), amountETB: withdrawAmount(), destination: phone }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawResult({ requestId: data.requestId, amountETB: data.amountETB, destination: data.destination });
        setWithdrawStep('result');
        props.onBalanceRefresh();
      } else {
        setWithdrawError(data.error || 'Withdrawal failed');
      }
    } catch {
      setWithdrawError('Network error');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const resetDeposit = () => {
    setDepositStep('chooseMethod');
    setSelectedMethod(null);
    setDepositError('');
    setDepositReceipt('');
    setDepositResult(null);
  };
  const resetWithdraw = () => {
    setWithdrawStep('chooseMethod');
    setSelectedMethod(null);
    setWithdrawError('');
    setWithdrawAmount(0);
    setWithdrawDestination('');
    setWithdrawResult(null);
  };
  const closeAll = () => {
    setMode('menu');
    resetDeposit();
    resetWithdraw();
    props.onClose();
  };

  // ── Step progress indicator ──────────────────────────────────────────────
  const Progress = (p: { step: number; total: number; color: string }) => (
    <div class="flex items-center gap-0 mb-5">
      {Array.from({ length: p.total }).map((_, i) => (
        <>
          <div style={{
            width: i < p.step ? '20px' : '7px',
            height: '7px',
            'border-radius': i < p.step ? '4px' : '50%',
            background: i < p.step ? p.color : 'rgba(255,255,255,0.1)',
            'box-shadow': i < p.step ? `0 0 8px ${p.color}60` : 'none',
            transition: 'all 0.35s ease',
            'flex-shrink': 0,
          }} />
          {i < p.total - 1 && (
            <div style={{
              flex: 1,
              height: '1px',
              background: i < p.step - 1 ? p.color : 'rgba(255,255,255,0.08)',
              transition: 'background 0.35s ease',
            }} />
          )}
        </>
      ))}
    </div>
  );

  // ── Shared input style ───────────────────────────────────────────────────
  const inputCls = "w-full bg-black/30 border border-indigo-500/15 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition-all font-medium text-sm";

  // ── Method picker button ─────────────────────────────────────────────────
  const MethodBtn = (p: { logoSrc: string; label: string; sub: string; onClick: () => void }) => (
    <button
      onClick={p.onClick}
      class="flex items-center gap-3 w-full p-4 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 hover:border-indigo-500/25 active:scale-[0.98] transition-all text-left"
    >
      <div class="w-10 h-10 rounded-xl bg-black/40 border border-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img
          src={p.logoSrc}
          alt={p.label}
          class="w-7 h-7 object-contain"
          loading="lazy"
        />
      </div>
      <div>
        <div class="text-sm font-black text-white">{p.label}</div>
        <div class="text-[10px] text-gray-500">{p.sub}</div>
      </div>
      <svg class="w-4 h-4 text-gray-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );

  // ── Back button ──────────────────────────────────────────────────────────
  const BackBtn = (p: { onClick: () => void; label?: string }) => (
    <button
      onClick={p.onClick}
      class="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-gray-300 transition-colors py-1"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
      </svg>
      {p.label || 'Back'}
    </button>
  );

  // ── Primary action button ─────────────────────────────────────────────────
  const PrimaryBtn = (p: { onClick: () => void; disabled?: boolean; children: any; color?: string }) => (
    <button
      onClick={p.onClick}
      disabled={p.disabled}
      class="w-full py-3.5 rounded-xl font-black uppercase tracking-wider text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: p.disabled ? 'rgba(255,255,255,0.06)' : (p.color || 'linear-gradient(135deg, #22D3EE, #0EA5E9)'),
        color: p.disabled ? '#555' : '#fff',
        'box-shadow': p.disabled ? 'none' : '0 4px 16px rgba(14,165,233,0.3)',
      }}
    >
      {p.children}
    </button>
  );

  return (
    <div
      class="fixed inset-0 z-[10000] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', 'backdrop-filter': 'blur(14px)' }}
      onClick={closeAll}
    >
      <div
        class="w-full max-w-sm overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #33205C 0%, #241541 100%)',
          border: '1px solid rgba(34,211,238,0.12)',
          'border-bottom': 'none',
          'border-radius': '24px 24px 0 0',
          'padding-bottom': 'env(safe-area-inset-bottom, 12px)',
          animation: 'walletSheetUp 0.3s cubic-bezier(0.32,0.72,0,1)',
          'box-shadow': '0 -8px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-9 h-1 rounded-full bg-white/10" />
        </div>

        {/* ══════════════ MENU ══════════════ */}
        <Show when={mode() === 'menu'}>
          <div class="px-5 pb-5 pt-2">
            {/* Header */}
            <div class="flex items-center justify-between mb-5">
              <div>
                <h2 class="text-lg font-black text-white uppercase tracking-wider">{props.t('wallet.title')}</h2>
                <p class="text-[11px] text-gray-500">Manage your funds</p>
              </div>
              <button onClick={closeAll} class="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Balance cards */}
            <div class="grid grid-cols-2 gap-2 mb-5">
              <div class="rounded-2xl p-4" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)' }}>
                <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">{props.t('wallet.balance_etb')}</div>
                <div class="text-2xl font-black text-white tabular-nums">{props.balanceETB.toFixed(0)}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">ETB</div>
              </div>
              <div class="rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">{props.t('wallet.balance_main')}</div>
                <div class="text-2xl font-black text-white tabular-nums">{props.balanceMain.toFixed(0)}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">ETB</div>
              </div>
            </div>

            {/* Action buttons */}
            <div class="flex gap-2">
              <button
                onClick={() => { setMode('deposit'); setDepositStep('chooseMethod'); }}
                class="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase tracking-wider text-sm text-white transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', 'box-shadow': '0 4px 16px rgba(34,197,94,0.25)' }}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path d="M12 2v10M7 7l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
                  <rect x="3" y="14" width="18" height="8" rx="2" />
                </svg>
                {props.t('wallet.deposit')}
              </button>
              <button
                onClick={() => { setMode('withdraw'); resetWithdraw(); fetchWithdrawEligibility(); }}
                class="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase tracking-wider text-sm text-white transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path d="M12 22V12M7 17l5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
                  <rect x="3" y="2" width="18" height="8" rx="2" />
                </svg>
                {props.t('wallet.withdraw')}
              </button>
            </div>
          </div>
        </Show>

        {/* ══════════════ DEPOSIT FLOW ══════════════ */}
        <Show when={mode() === 'deposit'}>
          <div class="px-5 pb-5 pt-2">
            {/* Header */}
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-black text-white uppercase tracking-wider">{props.t('wallet.deposit')}</h2>
                <p class="text-[11px] text-gray-500">
                  {depositStep() === 'chooseMethod' && 'Choose payment method'}
                  {depositStep() === 'info' && `Send via ${selectedMethod() === 'telebirr' ? 'Telebirr' : 'CBE Birr'} Min 10 ETB `}
                  {depositStep() === 'enterReceipt' && 'Paste your SMS receipt'}
                  {depositStep() === 'result' && 'Deposit submitted'}
                </p>
              </div>
              <button onClick={closeAll} class="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 0: Choose method */}
            <Show when={depositStep() === 'chooseMethod'}>
              <div class="space-y-2">
                <MethodBtn logoSrc="/logos/telebirr.svg" label="Telebirr" sub="Ethio Telecom wallet" onClick={() => { setSelectedMethod('telebirr'); setDepositStep('info'); }} />
                <MethodBtn logoSrc="/logos/cbebirr.svg" label="CBE Birr" sub="Commercial Bank of Ethiopia" onClick={() => { setSelectedMethod('cbebirr'); setDepositStep('info'); }} />
                <div class="pt-1">
                  <BackBtn onClick={() => setMode('menu')} label="Back to wallet" />
                </div>
              </div>
            </Show>

            {/* Step 1: Info */}
            <Show when={depositStep() === 'info'}>
              <Progress step={1} total={3} color="#22C55E" />
              <div class="space-y-3">
                <div class="rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Min 10 ETB Send to this number</div>
                  <Show when={depositInfo() && depositInfo()![selectedMethod()!]} fallback={
                    <div class="text-sm text-gray-600">Loading account details…</div>
                  }>
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-xl font-black text-white tracking-wider">
                          {depositInfo()![selectedMethod()!].phone}
                        </div>
                        <div class="text-[11px] text-gray-500 mt-0.5">
                          {depositInfo()![selectedMethod()!].accountName}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(depositInfo()![selectedMethod()!].phone);
                          setPhoneCopied(true);
                          setTimeout(() => setPhoneCopied(false), 2000);
                        }}
                        class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all"
                        style={{
                          background: phoneCopied() ? 'rgba(34,197,94,0.15)' : 'rgba(34,211,238,0.12)',
                          border: phoneCopied() ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,211,238,0.2)',
                          color: phoneCopied() ? '#22C55E' : '#22D3EE',
                        }}
                      >
                        {phoneCopied() ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </Show>
                </div>

                {/* Info strip */}
                <div class="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.12)' }}>
                  <svg class="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke-width="2" />
                    <path d="M12 8v4M12 16h.01" stroke-linecap="round" stroke-width="2" />
                  </svg>
                  <p class="text-[10px] text-gray-500 leading-relaxed">After sending, copy the full SMS and paste it on the next step.</p>
                </div>

                <PrimaryBtn onClick={() => setDepositStep('enterReceipt')}>I've sent — Enter receipt ›</PrimaryBtn>
                <BackBtn onClick={() => setDepositStep('chooseMethod')} />
              </div>
            </Show>

            {/* Step 2: Enter receipt */}
            <Show when={depositStep() === 'enterReceipt'}>
              <Progress step={2} total={3} color="#22C55E" />
              <div class="space-y-3">
                <div>
                  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                    {selectedMethod() === 'telebirr' ? 'Telebirr' : 'CBE Birr'} SMS receipt
                  </div>
                  <textarea
                    value={depositReceipt()}
                    onInput={(e) => setDepositReceipt(e.currentTarget.value)}
                    placeholder={"Dear Customer, you have transferred ETB ... to ... on ..."}
                    class="w-full bg-black/30 border border-indigo-500/15 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-indigo-400/40 focus:ring-1 focus:ring-indigo-400/15 transition-all font-medium text-sm resize-none min-h-[100px] leading-relaxed"
                  />
                </div>
                <Show when={depositError()}>
                  <div class="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    <svg class="w-3.5 h-3.5 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke-width="2" /><path d="M12 8v4M12 16h.01" stroke-linecap="round" stroke-width="2" />
                    </svg>
                    <p class="text-[11px] text-rose-400">{depositError()}</p>
                  </div>
                </Show>
                <PrimaryBtn onClick={submitDeposit} disabled={depositLoading() || !depositReceipt().trim()}>
                  {depositLoading() ? '● Submitting…' : 'Submit Receipt ›'}
                </PrimaryBtn>
                <BackBtn onClick={() => setDepositStep('info')} />
              </div>
            </Show>

            {/* Step 3: Result */}
            <Show when={depositStep() === 'result' && depositResult()}>
              <Progress step={3} total={3} color="#22C55E" />
              <div class="text-center py-2">
                <div class="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: depositResult()!.autoConfirmed ? 'rgba(34,197,94,0.12)' : 'rgba(34,211,238,0.12)',
                    border: depositResult()!.autoConfirmed ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,211,238,0.3)',
                  }}>
                  <svg class="w-7 h-7" style={{ color: depositResult()!.autoConfirmed ? '#22C55E' : '#22D3EE' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div class="text-lg font-black text-white uppercase tracking-wider mb-1">
                  {depositResult()!.autoConfirmed ? 'Confirmed!' : 'Submitted'}
                </div>
                <p class="text-sm text-gray-400 mb-1">
                  {depositResult()!.autoConfirmed
                    ? `${depositResult()!.amount.toFixed(2)} ETB added to your balance.`
                    : `${depositResult()!.amount.toFixed(2)} ETB pending admin approval.`}
                </p>
                <div class="inline-block text-[10px] font-mono text-gray-600 bg-white/5 px-3 py-1 rounded-lg mb-4">
                  {depositResult()!.requestId}
                </div>
                <PrimaryBtn onClick={() => { setMode('menu'); resetDeposit(); props.onBalanceRefresh(); }}>Close</PrimaryBtn>
              </div>
            </Show>
          </div>
        </Show>

        {/* ══════════════ WITHDRAW FLOW ══════════════ */}
        <Show when={mode() === 'withdraw'}>
          <div class="px-5 pb-5 pt-2">
            {/* Header */}
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-black text-white uppercase tracking-wider">{props.t('wallet.withdraw')}</h2>
                <p class="text-[11px] text-gray-500">
                  {withdrawStep() === 'chooseMethod' && 'Choose withdrawal method'}
                  {withdrawStep() === 'info' && `Balance & fees`}
                  {withdrawStep() === 'enterAmount' && 'How much to withdraw?'}
                  {withdrawStep() === 'enterDestination' && 'Your phone number'}
                  {withdrawStep() === 'result' && 'Withdrawal submitted'}
                </p>
              </div>
              <button onClick={closeAll} class="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 0: Choose method */}
            <Show when={withdrawStep() === 'chooseMethod'}>
              <div class="space-y-2">
                <MethodBtn logoSrc="/logos/telebirr.svg" label="Telebirr" sub="Ethio Telecom wallet" onClick={() => { setSelectedMethod('telebirr'); setWithdrawStep('info'); }} />
                <MethodBtn logoSrc="/logos/cbebirr.svg" label="CBE Birr" sub="Commercial Bank of Ethiopia" onClick={() => { setSelectedMethod('cbebirr'); setWithdrawStep('info'); }} />
                <div class="pt-1">
                  <BackBtn onClick={() => setMode('menu')} label="Back to wallet" />
                </div>
              </div>
            </Show>

            {/* Step 1: Info */}
            <Show when={withdrawStep() === 'info'}>
              <Progress step={1} total={4} color="#22D3EE" />
              <div class="space-y-3">
                <div class="rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Withdrawable balance</div>
                  <div class="text-3xl font-black text-white tabular-nums">
                    {props.balanceMain.toFixed(0)} <span class="text-sm text-gray-500">ETB</span>
                  </div>
                  <div class="text-[10px] text-emerald-500 mt-1">Min withdrawal 50 ETB · No fee</div>

                  <Show when={!eligibilityLoading() && withdrawEligibility()}>
                    <Show
                      when={withdrawEligibility()!.canWithdraw}
                      fallback={
                        <div class="mt-3 pt-3 border-t border-white/10 flex items-start gap-2">
                          <svg class="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
                          </svg>
                          <p class="text-[10px] text-amber-400 leading-relaxed">
                            {withdrawEligibility()!.hasPlacedFirstBet
                              ? 'You have no confirmed deposits to withdraw from yet.'
                              : 'Place at least one bet to unlock withdrawals. Deposit 200 ETB total, or deposit 10+ ETB and wager from it.'}
                          </p>
                        </div>
                      }
                    >
                      <div class="mt-3 pt-3 border-t border-white/10 text-[10px] text-cyan-400 leading-relaxed">
                        {withdrawEligibility()!.maxWithdrawableNow === null
                          ? '✓ Unlocked — you can withdraw any amount up to your balance.'
                          : `You can withdraw up to ${withdrawEligibility()!.maxWithdrawableNow!.toFixed(2)} ETB. Place a bet or deposit 200 ETB to unlock more.`}
                      </div>
                    </Show>
                  </Show>
                </div>
              <Show
                when={!props.isAgent && props.lockedBalance >= 10}
                fallback={
                  <PrimaryBtn onClick={() => setWithdrawStep('enterAmount')}>
                    Enter Amount ›
                  </PrimaryBtn>
                }
              >
                <div class="rounded-xl px-3 py-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 leading-relaxed">
                  🔒 You have {props.lockedBalance.toFixed(2)} ETB in locked bonus.
                  Play {(props.lockedBalance - 10).toFixed(2)} ETB more to unlock withdrawals.
                </div>
              </Show>

              {/* Agents bypass the bonus-clear gate — show a small badge */}
              <Show when={props.isAgent && props.lockedBalance >= 10}>
                <div class="rounded-xl px-3 py-2.5 text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 leading-relaxed">
                  ✓ Agent account — locked bonus does not block your withdrawals.
                </div>
              </Show>
            <BackBtn onClick={() => setWithdrawStep('chooseMethod')} />
          </div>
        </Show>

            {/* Step 2: Enter amount */}
            <Show when={withdrawStep() === 'enterAmount'}>
              <Progress step={2} total={4} color="#22D3EE" />
              <div class="space-y-3">
                <div>
                  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Amount (ETB)</div>
                  <div class="relative">
                    <input
                      type="number"
                      value={withdrawAmount() || ''}
                      onInput={(e) => setWithdrawAmount(Number(e.currentTarget.value))}
                      class="w-full bg-black/30 border border-indigo-500/15 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-indigo-400/40 focus:ring-1 focus:ring-indigo-400/15 transition-all font-black text-2xl tabular-nums pr-16"
                      placeholder="0"
                    />
                    <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">ETB</span>
                  </div>
                </div>
                <Show when={withdrawError()}>
                  <div class="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    <svg class="w-3.5 h-3.5 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke-width="2" /><path d="M12 8v4M12 16h.01" stroke-linecap="round" stroke-width="2" />
                    </svg>
                    <p class="text-[11px] text-rose-400">{withdrawError()}</p>
                  </div>
                </Show>
                    <PrimaryBtn onClick={() => {
                      if (withdrawAmount() < 50) { setWithdrawError('Minimum 50 ETB'); return; }
                      if (withdrawAmount() > props.balanceMain) { setWithdrawError('Insufficient withdrawable balance'); return; }
                      const elig = withdrawEligibility();
                      if (elig && !elig.canWithdraw) {
                        setWithdrawError(
                          elig.hasPlacedFirstBet
                            ? 'You have no confirmed deposits to withdraw from yet.'
                            : 'Place at least one bet to unlock withdrawals.'
                        );
                        return;
                      }
                      if (elig && elig.maxWithdrawableNow !== null && withdrawAmount() > elig.maxWithdrawableNow) {
                        setWithdrawError(`You can only withdraw up to ${elig.maxWithdrawableNow.toFixed(2)} ETB right now.`);
                        return;
                      }
                      setWithdrawError('');
                      setWithdrawStep('enterDestination');
                    }}>
                  Continue ›
                </PrimaryBtn>
                <BackBtn onClick={() => setWithdrawStep('info')} />
              </div>
            </Show>

            {/* Step 3: Enter destination */}
            <Show when={withdrawStep() === 'enterDestination'}>
              <Progress step={3} total={4} color="#22D3EE" />
              <div class="space-y-3">
                {/* Summary */}
                <div class="flex justify-between items-center rounded-xl px-4 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span class="text-[10px] text-gray-500 uppercase tracking-widest">Withdrawing</span>
                  <span class="text-base font-black text-white tabular-nums">{withdrawAmount()} ETB</span>
                </div>
                {/* Phone input */}
                <div>
                  <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                    {selectedMethod() === 'telebirr' ? 'Telebirr' : 'CBE Birr'} phone number
                  </div>
                  <div class="relative">
                    <div class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-500 pointer-events-none">
                      <span class="text-base">🇪🇹</span>
                      <span class="text-xs font-bold">+251</span>
                      <div class="w-px h-4 bg-white/10" />
                    </div>
                    <input
                      type="tel"
                      value={withdrawDestination()}
                      onInput={(e) => setWithdrawDestination(e.currentTarget.value)}
                      maxlength="10"
                      placeholder="09 1234 5678"
                      class="w-full bg-black/30 border border-indigo-500/15 rounded-xl py-3 text-white placeholder-gray-700 focus:outline-none focus:border-indigo-400/40 focus:ring-1 focus:ring-indigo-400/15 transition-all font-bold text-base"
                      style={{ 'padding-left': '82px' }}
                    />
                  </div>
                  <p class="text-[10px] text-gray-600 mt-1.5">Must be registered with {selectedMethod() === 'telebirr' ? 'Telebirr' : 'CBE Birr'}</p>
                </div>
                <Show when={withdrawError()}>
                  <div class="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    <svg class="w-3.5 h-3.5 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke-width="2" /><path d="M12 8v4M12 16h.01" stroke-linecap="round" stroke-width="2" />
                    </svg>
                    <p class="text-[11px] text-rose-400">{withdrawError()}</p>
                  </div>
                </Show>
                <PrimaryBtn onClick={submitWithdraw} disabled={withdrawLoading()}>
                  {withdrawLoading() ? '● Submitting…' : 'Submit ›'}
                </PrimaryBtn>
                <BackBtn onClick={() => setWithdrawStep('enterAmount')} />
              </div>
            </Show>

            {/* Step 4: Result */}
            <Show when={withdrawStep() === 'result' && withdrawResult()}>
              <Progress step={4} total={4} color="#22D3EE" />
              <div class="text-center py-2">
                <div class="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <svg class="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div class="text-lg font-black text-white uppercase tracking-wider mb-1">Submitted</div>
                <p class="text-sm text-gray-400 mb-1">
                  {withdrawResult()!.amountETB} ETB to {withdrawResult()!.destination}
                </p>
                <p class="text-[11px] text-gray-600 mb-3">Waiting for admin approval</p>
                <div class="inline-block text-[10px] font-mono text-gray-600 bg-white/5 px-3 py-1 rounded-lg mb-4">
                  {withdrawResult()!.requestId}
                </div>
                <PrimaryBtn onClick={() => { setMode('menu'); resetWithdraw(); props.onBalanceRefresh(); }}>Close</PrimaryBtn>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      <style>{`
        @keyframes walletSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}