// Ethiogames/adminportal/src/components/WeeklyRewardHub.tsx
import { createSignal, createResource, For, Show, createMemo, createEffect, on, onMount, onCleanup } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from './Toast';
import PasswordConfirmDialog from './PasswordConfirmDialog';

type RewardRule = { from: number; to: number; amount: number };
type RewardType = 'depositor' | 'referrer';

interface Props {
  type: RewardType;
  settings: any;
  onUpdate: (key: string, value: any) => void;
  onBatchUpdate: (
    updates: Array<{ key: string; value: any }>,
    title: string
  ) => Promise<boolean>;
}

/* ─────────────────────────── Week date formatting (EAT, Sunday→Saturday) ─────────────────────────── */
// Week boundaries are Sunday 00:00 EAT → Saturday 23:59 EAT.
// We shift by +3h so the UTC fields line up with EAT-local calendar days.
const formatWeekDate = (d: string | Date) => {
  const shifted = new Date(new Date(d).getTime() + 3 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/* ─────────────────────────── SVG Icons ─────────────────────────── */
function IconEye(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconChartBar(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconClock(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconBanknote(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function IconSave(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconTrophy(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.5 7.5 0 10-10.014 0m9.768-2.25c.843-.523 1.492-1.226 1.492-2.25 0-1.024-.649-1.727-1.492-2.25m-9.768 4.5a7.5 7.5 0 01-1.492-2.25m9.768 0c-.843.523-1.492 1.226-1.492 2.25 0 1.024.649 1.727 1.492 2.25m-9.768 0c.843-.523 1.492-1.226 1.492-2.25 0-1.024-.649-1.727-1.492-2.25" />
    </svg>
  );
}

function IconPlus(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconTrash(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function IconWarning(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function IconCheck(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconClose(props: { class?: string }) {
  return (
    <svg class={props.class || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/* ─────────────────────── Number Stepper Input ─────────────────────── */
function NumberStepper(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: string;
}) {
  const stepAmt = () => props.step ?? 1;
  const minVal = () => props.min ?? 0;
  const maxVal = () => props.max ?? Infinity;

  const clamp = (v: number) => Math.max(minVal(), Math.min(maxVal(), v));

  const dec = () => props.onChange(clamp(props.value - stepAmt()));
  const inc = () => props.onChange(clamp(props.value + stepAmt()));

  return (
    <div class={`flex items-stretch bg-black border border-white/10 rounded-2xl overflow-hidden focus-within:border-cyan-500/50 transition-all ${props.width || ''}`}>
      <button
        type="button"
        onClick={dec}
        class="w-9 flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:bg-white/5 transition"
        tabIndex={-1}
      >
        −
      </button>
      <input
        type="number"
        value={props.value}
        onInput={(e) => props.onChange(parseFloat(e.currentTarget.value) || 0)}
        class="w-full bg-transparent text-white text-center font-mono text-sm outline-none py-2.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={inc}
        class="w-9 flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:bg-white/5 transition"
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}

/* ─────────────────────── Week Status Pill ─────────────────────── */
function WeekStatusPill(props: {
  weekStart: string | Date;
  weekEnd: string | Date;
  weekId: string;
  alreadyPaid: boolean;
  enabled: boolean;
  eligibleCount: number;
  totalToPay: number;
}) {
  const stateLabel = () => {
    if (!props.enabled) return 'DISABLED';
    if (props.alreadyPaid) return 'PAID';
    if (props.eligibleCount === 0) return 'NO ELIGIBLE USERS';
    return 'UNPAID — READY TO PAY';
  };

  const palette = () => {
    if (!props.enabled) return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    if (props.alreadyPaid) return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
    if (props.eligibleCount === 0) return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  };

  return (
    <div class={`rounded-2xl border px-4 py-3 flex items-center justify-between flex-wrap gap-3 ${palette()}`}>
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center">
          {props.alreadyPaid ? <IconCheck class="w-4 h-4" /> : <IconWarning class="w-4 h-4" />}
        </div>
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest opacity-80">Last Completed Week</p>
          <p class="text-sm font-bold text-white">
            {formatWeekDate(props.weekStart)} → {formatWeekDate(props.weekEnd)}
            <span class="text-gray-500 font-mono text-[10px] ml-2">({props.weekId})</span>
          </p>
        </div>
      </div>
      <div class="text-right">
        <span class="text-[10px] font-black uppercase tracking-widest">{stateLabel()}</span>
        <Show when={props.enabled && !props.alreadyPaid && props.eligibleCount > 0}>
          <p class="text-[10px] text-gray-400 mt-0.5">
            {props.eligibleCount} eligible · {props.totalToPay.toFixed(2)} ETB to pay
          </p>
        </Show>
      </div>
    </div>
  );
}

/* ─────────────────────── Main Component ─────────────────────── */
export default function WeeklyRewardHub(props: Props) {
  const prefix = () => (props.type === 'depositor' ? 'depositor' : 'referrer');
  const enabledKey = () => `${prefix()}_reward_enabled`;
  const autoKey = () => `${prefix()}_reward_auto_enabled`;
  const topCountKey = () => `${prefix()}_reward_top_count`;
  const rulesKey = () => `${prefix()}_reward_rules`;

  const [showTopList, setShowTopList] = createSignal(false);
  const [showHistory, setShowHistory] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(false);
  const [previewData, setPreviewData] = createSignal<any>(null);
  const [previewLoading, setPreviewLoading] = createSignal(false);

  const [localRules, setLocalRules] = createSignal<RewardRule[]>([]);
  const [localTopCount, setLocalTopCount] = createSignal<number>(10);
  const [rulesDirty, setRulesDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  // Week status (previous completed week)
   const [statusKey, setStatusKey] = createSignal(0);
  const [statusData] = createResource(
    () => ({ type: props.type, key: statusKey() }),
    async ({ type }) =>
      apiFetch<any>(`/admin/weekly-rewards/preview?type=${type}&weekOffset=-1`)
  );

  // Refresh status on payout events
  onMount(() => {
    const refresh = () => setStatusKey((k) => k + 1);
    window.addEventListener('weekly-rewards-updated', refresh);
    onCleanup(() => window.removeEventListener('weekly-rewards-updated', refresh));
  });

  // Reactive sync from settings when NOT dirty
  createEffect(
    on(
      () => [props.settings[rulesKey()], props.settings[topCountKey()]] as const,
      ([rawRules, rawTop]) => {
        if (rulesDirty()) return;
        const arr =
          Array.isArray(rawRules) && rawRules.length > 0
            ? rawRules
            : [{ from: 1, to: 1, amount: 50 }];
        setLocalRules(JSON.parse(JSON.stringify(arr)));
        setLocalTopCount(Number(rawTop) || 10);
      }
    )
  );

  const title = () => (props.type === 'depositor' ? 'Top Depositors' : 'Top Referrers');
  const subtitle = () =>
    props.type === 'depositor'
      ? 'Reward the users who deposited the most last week.'
      : 'Reward the users who referred the most verified players last week.';

  const validate = (): string[] => {
    const errors: string[] = [];
    const rules = localRules();
    const top = localTopCount();
    if (!Number.isInteger(top) || top < 1) errors.push('Top count must be a positive integer.');
    if (!rules.length) errors.push('At least one rule required.');
    const sorted = [...rules].sort((a, b) => a.from - b.from);
    sorted.forEach((r, i) => {
      if (!Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 1 || r.to < r.from)
        errors.push(`Invalid range: ${r.from}-${r.to}`);
      if (r.to > top) errors.push(`Range end ${r.to} exceeds top count ${top}.`);
      if (typeof r.amount !== 'number' || r.amount < 0 || !isFinite(r.amount))
        errors.push(`Invalid amount for ${r.from}-${r.to}.`);
      if (i > 0) {
        const prev = sorted[i - 1];
        if (r.from <= prev.to)
          errors.push(`Overlap between ${prev.from}-${prev.to} and ${r.from}-${r.to}.`);
      }
    });
    return errors;
  };

  const saveRules = async () => {
    const errors = validate();
    if (errors.length) {
      showToast(errors[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const ok = await props.onBatchUpdate(
        [
          { key: topCountKey(), value: localTopCount() },
          { key: rulesKey(), value: localRules() },
        ],
        `Save ${props.type === 'depositor' ? 'Depositor' : 'Referrer'} reward rules?`
      );
      if (ok) setRulesDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const addRuleRow = () => {
    const rules = [...localRules()];
    const last = rules[rules.length - 1];
    const nextFrom = last ? last.to + 1 : 1;
    if (nextFrom > localTopCount()) {
      showToast('Add more top slots first (increase Top Count).', 'error');
      return;
    }
    rules.push({ from: nextFrom, to: nextFrom, amount: 0 });
    setLocalRules(rules);
    setRulesDirty(true);
  };

  const removeRuleRow = (idx: number) => {
    const rules = [...localRules()];
    rules.splice(idx, 1);
    setLocalRules(rules);
    setRulesDirty(true);
  };

  const updateRule = (idx: number, field: keyof RewardRule, value: number) => {
    const rules = [...localRules()];
    rules[idx] = { ...rules[idx], [field]: value };
    setLocalRules(rules);
    setRulesDirty(true);
  };

    const [previewWeekOffset, setPreviewWeekOffset] = createSignal(0);

  const openPreview = async () => {
    setPreviewWeekOffset(0); // always open on the CURRENT week
    setPreviewLoading(true);
    setShowPreview(true);
    setPreviewData(null);
    try {
      const data = await apiFetch<any>(
        `/admin/weekly-rewards/preview?type=${props.type}&weekOffset=0`
      );
      setPreviewData(data);
    } catch (err: any) {
      showToast(err.message || 'Preview failed', 'error');
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadPreviewWeek = async (offset: number) => {
    setPreviewWeekOffset(offset);
    setPreviewLoading(true);
    try {
      const data = await apiFetch<any>(
        `/admin/weekly-rewards/preview?type=${props.type}&weekOffset=${offset}`
      );
      setPreviewData(data);
    } catch (err: any) {
      showToast(err.message || 'Preview failed', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div class="glass-dark rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <IconTrophy class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-lg font-black text-white tracking-tight">{title()} Reward Hub</h2>
            <p class="text-xs text-gray-500 mt-0.5">{subtitle()}</p>
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button
            onClick={openPreview}
            class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 text-xs font-black uppercase tracking-wider text-cyan-400 transition"
          >
            <IconEye class="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setShowTopList(true)}
            class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 text-xs font-black uppercase tracking-wider text-cyan-400 transition"
          >
            <IconChartBar class="w-4 h-4" />
            Top List
          </button>
          <button
            onClick={() => setShowHistory(true)}
            class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 text-xs font-black uppercase tracking-wider text-cyan-400 transition"
          >
            <IconClock class="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      {/* ─── Previous week status pill ─── */}
      <Show when={statusData()}>
        <WeekStatusPill
          weekStart={statusData()!.weekRange.weekStart}
          weekEnd={statusData()!.weekRange.weekEnd}
          weekId={statusData()!.weekRange.weekId}
          alreadyPaid={statusData()!.alreadyPaid}
          enabled={statusData()!.enabled !== false}
          eligibleCount={statusData()!.users?.length || 0}
          totalToPay={statusData()!.totalToPay || 0}
        />
      </Show>

      {/* Toggles */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
              <IconCheck class="w-4 h-4" />
            </div>
            <div>
              <p class="text-sm font-bold text-white">Feature Enabled</p>
              <p class="text-[10px] text-gray-500">Master switch — allows manual payouts</p>
            </div>
          </div>
          <button
            onClick={() => props.onUpdate(enabledKey(), !props.settings[enabledKey()])}
            class={`relative inline-flex h-6 w-12 items-center rounded-full transition-all shrink-0 ${
              props.settings[enabledKey()] ? 'bg-cyan-500' : 'bg-gray-700'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                props.settings[enabledKey()] ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
              <IconClock class="w-4 h-4" />
            </div>
            <div>
            <p class="text-sm font-bold text-white">Auto Payout</p>
              <p class="text-[10px] text-gray-500">Sunday 12:05 AM Ethiopian · 5 min after week ends</p>
            </div>
          </div>
          <button
            onClick={() => props.onUpdate(autoKey(), !props.settings[autoKey()])}
            class={`relative inline-flex h-6 w-12 items-center rounded-full transition-all shrink-0 ${
              props.settings[autoKey()] ? 'bg-cyan-500' : 'bg-gray-700'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                props.settings[autoKey()] ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Top Count */}
      <div class="space-y-2">
        <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">
          How many top users to reward
        </label>
        <NumberStepper
          value={localTopCount()}
          onChange={(v) => {
            setLocalTopCount(Math.max(1, Math.floor(v)));
            setRulesDirty(true);
          }}
          min={1}
          max={100}
          width="max-w-[220px]"
        />
      </div>

      {/* Rules */}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">
            Reward Rules (rank ranges)
          </label>
          <button
            onClick={addRuleRow}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition"
          >
            <IconPlus class="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>

        <div class="space-y-2">
          <For each={localRules()}>
            {(rule, idx) => (
              <div class="flex gap-2 items-center flex-wrap p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition">
                <span class="text-[10px] uppercase font-black text-gray-500 tracking-widest w-12">Rank</span>
                <NumberStepper
                  value={rule.from}
                  onChange={(v) => updateRule(idx(), 'from', Math.max(1, Math.floor(v)))}
                  min={1}
                  max={localTopCount()}
                  width="w-24"
                />
                <span class="text-xs text-gray-500">to</span>
                <NumberStepper
                  value={rule.to}
                  onChange={(v) => updateRule(idx(), 'to', Math.max(1, Math.floor(v)))}
                  min={1}
                  max={localTopCount()}
                  width="w-24"
                />
                <span class="text-xs text-gray-500">→ reward</span>
                <NumberStepper
                  value={rule.amount}
                  onChange={(v) => updateRule(idx(), 'amount', Math.max(0, v))}
                  min={0}
                  step={5}
                  width="w-32"
                />
                <span class="text-xs text-gray-500">ETB</span>
                <button
                  onClick={() => removeRuleRow(idx())}
                  class="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase transition"
                  title="Remove rule"
                >
                  <IconTrash class="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            )}
          </For>
        </div>

        <Show when={rulesDirty()}>
          <div class="flex justify-end pt-2">
            <button
              onClick={saveRules}
              disabled={saving()}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition disabled:opacity-50"
            >
              <IconSave class="w-4 h-4" />
              {saving() ? 'Saving…' : 'Save Rules'}
            </button>
          </div>
        </Show>
      </div>

            {/* Pay Now */}
      <div class="pt-4 border-t border-white/5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">Manual payout target</p>
          <Show when={statusData()}>
            <p class="text-xs font-bold text-white mt-1">
              Last completed week:{' '}
              <span class="text-cyan-400">
                {formatWeekDate(statusData()!.weekRange.weekStart)} →{' '}
                {formatWeekDate(statusData()!.weekRange.weekEnd)}
              </span>
            </p>
          </Show>
          <p class="text-[9px] text-gray-600 mt-0.5">
            Only completed weeks can be paid. Auto-payout runs Sunday 12:05 AM Ethiopian.
          </p>
        </div>
        <PayNowButton
          type={props.type}
          weekLabel={
            statusData()
              ? `${formatWeekDate(statusData()!.weekRange.weekStart)} → ${formatWeekDate(statusData()!.weekRange.weekEnd)}`
              : undefined
          }
        />
      </div>

      {/* Modals */}
       <Show when={showPreview()}>
        <PreviewModal
          type={props.type}
          loading={previewLoading()}
          data={previewData()}
          weekOffset={previewWeekOffset()}
          onLoadWeek={loadPreviewWeek}
          onClose={() => setShowPreview(false)}
        />
      </Show>
      <Show when={showTopList()}>
        <TopListModal type={props.type} onClose={() => setShowTopList(false)} />
      </Show>
      <Show when={showHistory()}>
        <HistoryModal type={props.type} onClose={() => setShowHistory(false)} />
      </Show>
    </div>
  );
}

/* ─────────────────────── Pay Now Button ─────────────────────── */
function PayNowButton(props: { type: RewardType; weekLabel?: string }) {
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const handleConfirm = async (password: string) => {
    setBusy(true);
    try {
      const res = await apiFetch<any>('/admin/weekly-rewards/pay-now', {
        method: 'POST',
        body: JSON.stringify({ type: props.type, settingsPassword: password }),
      });
      showToast(`Paid ${res.paidCount} users (${res.totalPaid.toFixed(2)} ETB)`, 'success');
      window.dispatchEvent(new CustomEvent('weekly-rewards-updated'));
    } catch (err: any) {
      showToast(err.message || 'Payout failed', 'error');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const confirmTitle = () =>
    props.weekLabel
      ? `Confirm payout for ${props.type}s · ${props.weekLabel}?`
      : `Confirm payout for ${props.type}s?`;

  return (
    <>
      <button
        disabled={busy()}
        onClick={() => setConfirmOpen(true)}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-xs uppercase tracking-wider transition disabled:opacity-50 whitespace-nowrap"
        title={props.weekLabel ? `Will pay: ${props.weekLabel}` : 'Pay last completed week'}
      >
        <IconBanknote class="w-4 h-4" />
        {busy()
          ? 'Processing…'
          : props.weekLabel
            ? `Pay Now · ${props.weekLabel}`
            : 'Pay Now'}
      </button>
      <PasswordConfirmDialog
        open={confirmOpen()}
        title={confirmTitle()}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/* ─────────────────────── Preview Modal ─────────────────────── */
function PreviewModal(props: {
  type: RewardType;
  loading: boolean;
  data: any;
  weekOffset: number;
  onLoadWeek: (offset: number) => void;
  onClose: () => void;
}) {
  const weekLabel = () => {
    if (!props.data) return '';
    if (props.data.isCurrentWeek) return 'Current week · in progress';
    if (props.weekOffset === -1) return 'Last week · completed';
    return `${Math.abs(props.weekOffset)} weeks ago · completed`;
  };

  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="glass-dark rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-cyan-500/10 shadow-2xl flex flex-col">
        <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <IconEye class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-lg font-black text-white">Payout Preview</h3>
              <Show when={props.data}>
                <p class="text-[10px] text-gray-500 mt-0.5 font-mono">
                  {formatWeekDate(props.data.weekRange.weekStart)} →{' '}
                  {formatWeekDate(props.data.weekRange.weekEnd)} · {props.data.weekRange.weekId}
                  <span class="text-cyan-400 ml-2">({weekLabel()})</span>
                </p>
              </Show>
            </div>
          </div>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white transition">
            <IconClose class="w-5 h-5" />
          </button>
        </div>

        {/* Week navigation */}
        <div class="px-6 py-2 border-b border-white/5 flex items-center justify-center gap-3 shrink-0 bg-black/20">
          <button
            onClick={() => props.onLoadWeek(props.weekOffset - 1)}
            class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition"
          >
            ← Prev week
          </button>
          <span class="text-[10px] text-gray-500 font-mono">
            {props.data?.weekRange?.weekId || '—'}
          </span>
          <button
            disabled={props.weekOffset >= 0}
            onClick={() => props.onLoadWeek(Math.min(0, props.weekOffset + 1))}
            class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-30"
          >
            Next week →
          </button>
        </div>

        <div class="p-6 overflow-y-auto custom-scrollbar">
          <Show when={props.loading}>
            <p class="text-center text-gray-500 py-10 animate-pulse">Loading preview…</p>
          </Show>
          <Show when={!props.loading && props.data}>
            <div class="space-y-3">
              {/* Disabled banner */}
              <Show when={props.data.enabled === false}>
                <div class="p-3 bg-gray-500/10 border border-gray-500/30 rounded-xl text-gray-400 text-xs font-bold flex items-start gap-2">
                  <IconWarning class="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    This reward feature is currently <b>DISABLED</b>. Numbers below show what
                    <i> would</i> be paid if you enable it.
                  </span>
                </div>
              </Show>

                           {/* In-progress info */}
              <Show when={props.data.enabled !== false && props.data.isCurrentWeek}>
                <div class="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-bold flex items-start gap-2">
                  <IconClock class="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    This week is still <b>in progress</b>. The list updates live and will be paid
                    automatically <b>this coming Sunday at 12:05 AM Ethiopian time</b> — 5 minutes
                    after the week ends.
                  </span>
                </div>
              </Show>

              {/* PAID banner (past weeks) */}
              <Show
                when={
                  props.data.enabled !== false &&
                  !props.data.isCurrentWeek &&
                  props.data.alreadyPaid
                }
              >
                <div class="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-bold flex items-start gap-2">
                  <IconCheck class="w-4 h-4 mt-0.5 shrink-0" />
                  <span><b>PAID.</b> This week's rewards have already been distributed.</span>
                </div>
              </Show>

              {/* UNPAID banner (past weeks) */}
              <Show
                when={
                  props.data.enabled !== false &&
                  !props.data.isCurrentWeek &&
                  !props.data.alreadyPaid &&
                  props.data.users.length > 0
                }
              >
                <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-bold flex items-start gap-2">
                  <IconWarning class="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    <b>UNPAID — ready to pay.</b> This week is complete. Click <b>Pay Now</b> on the
                    hub to distribute these rewards.
                  </span>
                </div>
              </Show>

              {/* Empty */}
              <Show when={props.data.enabled !== false && props.data.users.length === 0}>
                <div class="p-3 bg-gray-500/10 border border-gray-500/30 rounded-xl text-gray-400 text-xs font-bold flex items-start gap-2">
                  <IconWarning class="w-4 h-4 mt-0.5 shrink-0" />
                  <span>No eligible users for this week — nothing to pay.</span>
                </div>
              </Show>

              <div class="rounded-2xl overflow-hidden border border-white/5">
                <table class="w-full text-sm">
                  <thead class="bg-white/5 text-gray-400 text-[10px] uppercase">
                    <tr>
                      <th class="px-3 py-2 text-left">Rank</th>
                      <th class="px-3 py-2 text-left">User</th>
                      <th class="px-3 py-2 text-left">Metric</th>
                      <th class="px-3 py-2 text-right">Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={props.data.users}>
                      {(u: any) => (
                        <tr class="border-b border-white/5">
                          <td class="px-3 py-2 font-mono">#{u.rank}</td>
                          <td class="px-3 py-2">@{u.username || u.telegramId}</td>
                          <td class="px-3 py-2 font-mono">{u.metricValue.toFixed(2)}</td>
                          <td class="px-3 py-2 text-right font-mono text-cyan-400">
                            {u.rewardAmount.toFixed(2)} ETB
                          </td>
                        </tr>
                      )}
                    </For>
                    <Show when={!props.data.users.length}>
                      <tr>
                        <td colspan="4" class="py-8 text-center text-gray-500">
                          No eligible users for this week.
                        </td>
                      </tr>
                    </Show>
                  </tbody>
                </table>
              </div>

              <div class="text-right text-sm font-black">
                Total to pay:{' '}
                <span class="text-cyan-400">{props.data.totalToPay.toFixed(2)} ETB</span>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Top List Modal ─────────────────────── */
function TopListModal(props: { type: RewardType; onClose: () => void }) {
  const [page, setPage] = createSignal(1);
  const [weekOffset, setWeekOffset] = createSignal(0); // 0 = current week
  const limit = 10;

  const [data] = createResource(
    () => ({ page: page(), type: props.type, weekOffset: weekOffset() }),
    async ({ page, type, weekOffset }) =>
      apiFetch<any>(
        `/admin/weekly-rewards/top-${type === 'depositor' ? 'depositors' : 'referrers'}?page=${page}&limit=${limit}&weekOffset=${weekOffset}`
      )
  );

  const totalPages = createMemo(() => {
    const d = data();
    if (!d) return 1;
    return Math.max(1, Math.ceil((d.total || 0) / limit));
  });

  const metricLabel = () =>
    props.type === 'depositor' ? 'Total Deposited (ETB)' : 'Verified Referrals';

  const weekSubtitle = () => {
    if (!data()) return '';
    if (data().isCurrentWeek) return 'Current week · in progress';
    if (weekOffset() === -1) return 'Last week · completed';
    return `${Math.abs(weekOffset())} weeks ago · completed`;
  };

  const changeWeek = (newOffset: number) => {
    setWeekOffset(newOffset);
    setPage(1);
  };

  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="glass-dark rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-cyan-500/10 shadow-2xl flex flex-col">
        <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <IconChartBar class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-lg font-black text-white">
                Top {props.type === 'depositor' ? 'Depositors' : 'Referrers'}
              </h3>
              <Show when={data()?.weekRange}>
                <p class="text-[10px] text-gray-500 mt-0.5 font-mono">
                  Week {data().weekRange.weekId} ·{' '}
                  {formatWeekDate(data().weekRange.weekStart)} →{' '}
                  {formatWeekDate(data().weekRange.weekEnd)}
                  <span class="text-cyan-400 ml-2">({weekSubtitle()})</span>
                </p>
              </Show>
            </div>
          </div>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white transition">
            <IconClose class="w-5 h-5" />
          </button>
        </div>

        {/* Week navigation */}
        <div class="px-6 py-2 border-b border-white/5 flex items-center justify-center gap-3 shrink-0 bg-black/20">
          <button
            onClick={() => changeWeek(weekOffset() - 1)}
            class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition"
          >
            ← Prev week
          </button>
          <span class="text-[10px] text-gray-500 font-mono min-w-[90px] text-center">
            {data()?.weekRange?.weekId || '—'}
          </span>
          <button
            disabled={weekOffset() >= 0}
            onClick={() => changeWeek(Math.min(0, weekOffset() + 1))}
            class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-30"
          >
            Next week →
          </button>
        </div>

        <div class="p-6 overflow-y-auto custom-scrollbar flex-1">
          <Show when={data.loading}>
            <p class="text-center text-gray-500 py-10 animate-pulse">Loading…</p>
          </Show>
          <Show when={data()}>
            <Show when={data().isCurrentWeek}>
              <p class="text-[11px] text-blue-400/80 mb-3 flex items-center gap-2">
                <IconClock class="w-3.5 h-3.5" />
                Week is still in progress — this list updates live. Auto-payout runs this coming
                Sunday at 12:05 AM Ethiopian time.
              </p>
            </Show>
            <Show when={!data().isCurrentWeek && (data()?.total || 0) < 10}>
              <p class="text-[11px] text-amber-400/80 mb-3">
                Only <b>{data().total}</b> eligible{' '}
                {props.type === 'depositor' ? 'depositors' : 'referrers'} in this week — the list
                fills to the cap, not beyond it.
              </p>
            </Show>
            <div class="rounded-2xl overflow-hidden border border-white/5">
              <table class="w-full text-sm">
                <thead class="bg-white/5 text-gray-400 text-[10px] uppercase">
                  <tr>
                    <th class="px-3 py-2 text-left">Rank</th>
                    <th class="px-3 py-2 text-left">User</th>
                    <th class="px-3 py-2 text-right">{metricLabel()}</th>
                    <th class="px-3 py-2 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={data().users}>
                    {(u: any) => (
                      <tr class="border-b border-white/5 hover:bg-white/[0.02]">
                        <td class="px-3 py-2 font-mono">#{u.rank}</td>
                        <td class="px-3 py-2">
                          @{u.username || u.telegramId}
                          <Show when={u.firstName}>
                            <span class="text-gray-500 text-xs ml-2">({u.firstName})</span>
                          </Show>
                        </td>
                        <td class="px-3 py-2 text-right font-mono">
                          {props.type === 'depositor' ? u.metricValue.toFixed(2) : u.metricValue}
                        </td>
                        <td class="px-3 py-2 text-right font-mono text-cyan-400">
                          {u.rewardAmount > 0 ? `${u.rewardAmount.toFixed(2)} ETB` : '—'}
                        </td>
                      </tr>
                    )}
                  </For>
                  <Show when={!data().users.length}>
                    <tr>
                      <td colspan="4" class="py-8 text-center text-gray-500">
                        No data for this week.
                      </td>
                    </tr>
                  </Show>
                </tbody>
              </table>
            </div>
          </Show>
        </div>

        <div class="px-6 py-3 border-t border-white/5 flex items-center justify-between shrink-0">
          <span class="text-xs text-gray-500">
            Page {page()} of {totalPages()} · {data()?.total || 0} total
          </span>
          <div class="flex gap-2">
            <button
              disabled={page() <= 1}
              onClick={() => setPage((p) => p - 1)}
              class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase disabled:opacity-30 transition"
            >
              ← Prev
            </button>
            <button
              disabled={page() >= totalPages()}
              onClick={() => setPage((p) => p + 1)}
              class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase disabled:opacity-30 transition"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── History Modal ─────────────────────── */
function HistoryModal(props: { type: RewardType; onClose: () => void }) {
  const [page, setPage] = createSignal(1);
  const limit = 15;
  const [refreshKey, setRefreshKey] = createSignal(0);

  const [data] = createResource(
    () => ({ page: page(), type: props.type, refreshKey: refreshKey() }),
    async ({ page, type }) =>
      apiFetch<any>(`/admin/weekly-rewards/history?type=${type}&page=${page}&limit=${limit}`)
  );

  const [revertTarget, setRevertTarget] = createSignal<any>(null);

  const totalPages = createMemo(() => {
    const d = data();
    if (!d) return 1;
    return Math.max(1, Math.ceil((d.total || 0) / limit));
  });

  const doRevert = async (password: string, reason: string) => {
    const target = revertTarget();
    if (!target) return;
    try {
      const res = await apiFetch<any>(`/admin/weekly-rewards/${target._id}/revert`, {
        method: 'POST',
        body: JSON.stringify({ settingsPassword: password, reason }),
      });
      showToast(`Reverted ${res.revertedAmount.toFixed(2)} ETB`, 'success');
      setRevertTarget(null);
      setRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent('weekly-rewards-updated'));
    } catch (err: any) {
      showToast(err.message || 'Revert failed', 'error');
      throw err;
    }
  };

  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="glass-dark rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-cyan-500/10 shadow-2xl flex flex-col">
        <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <IconClock class="w-4 h-4" />
            </div>
            <h3 class="text-lg font-black text-white">
              {props.type === 'depositor' ? 'Depositor' : 'Referrer'} Payout History
            </h3>
          </div>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white transition">
            <IconClose class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto custom-scrollbar flex-1">
          <Show when={data.loading}>
            <p class="text-center text-gray-500 py-10 animate-pulse">Loading…</p>
          </Show>
          <Show when={data()}>
            <div class="rounded-2xl overflow-hidden border border-white/5">
              <table class="w-full text-sm">
                <thead class="bg-white/5 text-gray-400 text-[10px] uppercase">
                  <tr>
                    <th class="px-3 py-2 text-left">Week</th>
                    <th class="px-3 py-2 text-left">User</th>
                    <th class="px-3 py-2 text-left">Rank</th>
                    <th class="px-3 py-2 text-right">Amount</th>
                    <th class="px-3 py-2 text-left">Status</th>
                    <th class="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={data().payouts}>
                    {(p: any) => (
                      <tr class="border-b border-white/5">
                        <td class="px-3 py-2 font-mono text-xs">{p.weekId}</td>
                        <td class="px-3 py-2">@{p.username || p.telegramId}</td>
                        <td class="px-3 py-2 font-mono">#{p.rank}</td>
                        <td class="px-3 py-2 text-right font-mono">
                          {p.rewardAmount.toFixed(2)} ETB
                        </td>
                        <td class="px-3 py-2">
                          <Show
                            when={p.status === 'paid'}
                            fallback={
                              <span class="text-rose-400 text-xs font-bold uppercase">
                                Reverted
                              </span>
                            }
                          >
                            <span class="text-cyan-400 text-xs font-bold uppercase">Paid</span>
                          </Show>
                        </td>
                        <td class="px-3 py-2 text-right">
                          <Show when={p.canRevert}>
                            <button
                              onClick={() => setRevertTarget(p)}
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase transition"
                            >
                              <IconTrash class="w-3 h-3" />
                              Revert
                            </button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                  <Show when={!data().payouts.length}>
                    <tr>
                      <td colspan="6" class="py-8 text-center text-gray-500">
                        No payout history yet.
                      </td>
                    </tr>
                  </Show>
                </tbody>
              </table>
            </div>
          </Show>
        </div>

        <div class="px-6 py-3 border-t border-white/5 flex items-center justify-between shrink-0">
          <span class="text-xs text-gray-500">
            Page {page()} of {totalPages()} · {data()?.total || 0} total
          </span>
          <div class="flex gap-2">
            <button
              disabled={page() <= 1}
              onClick={() => setPage((p) => p - 1)}
              class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase disabled:opacity-30 transition"
            >
              ← Prev
            </button>
            <button
              disabled={page() >= totalPages()}
              onClick={() => setPage((p) => p + 1)}
              class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase disabled:opacity-30 transition"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <Show when={revertTarget()}>
        <RevertDialog
          target={revertTarget()}
          onConfirm={doRevert}
          onCancel={() => setRevertTarget(null)}
        />
      </Show>
    </div>
  );
}

/* ─────────────────────── Revert Dialog ─────────────────────── */
function RevertDialog(props: {
  target: any;
  onConfirm: (password: string, reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = createSignal('');
  const [reason, setReason] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const handle = async (e: Event) => {
    e.preventDefault();
    if (!password()) {
      showToast('Password required', 'error');
      return;
    }
    setBusy(true);
    try {
      await props.onConfirm(password(), reason());
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <form
        onSubmit={handle}
        class="glass-dark rounded-2xl max-w-md w-full p-6 border border-rose-500/20 shadow-2xl space-y-4"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <IconWarning class="w-5 h-5" />
          </div>
          <h3 class="text-lg font-black text-rose-400">Revert Reward</h3>
        </div>
        <p class="text-xs text-gray-400 leading-relaxed">
          You are about to revert{' '}
          <b class="text-white">@{props.target.username || props.target.telegramId}</b>'s reward
          of <b class="text-white">{props.target.rewardAmount.toFixed(2)} ETB</b> from week{' '}
          <span class="font-mono">{props.target.weekId}</span>. We'll only recover what remains in
          their balance — spent funds won't push anyone negative.
        </p>
        <input
          type="password"
          placeholder="Settings password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-center font-mono focus:border-rose-500/50 outline-none transition-all"
        />
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason()}
          onInput={(e) => setReason(e.currentTarget.value)}
          class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm focus:border-rose-500/50 outline-none transition-all"
        />
        <div class="flex gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            class="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy()}
            class="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black uppercase disabled:opacity-50 transition"
          >
            {busy() ? 'Reverting…' : 'Confirm Revert'}
          </button>
        </div>
      </form>
    </div>
  );
}