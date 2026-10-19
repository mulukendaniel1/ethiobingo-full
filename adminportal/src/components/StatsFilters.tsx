// src/components/StatsFilters.tsx
import { createSignal, createEffect, For } from 'solid-js';

interface Props {
  onRangeChange: (from: Date | null, to: Date | null) => void;
}

export default function StatsFilters(props: Props) {
  const [period, setPeriod] = createSignal<'day' | 'week' | 'month'>('month');
  const [fromDate, setFromDate] = createSignal<string>('');
  const [toDate, setToDate] = createSignal<string>('');

  const setDateRange = (periodType: string) => {
    const now = new Date();
    let from = new Date();
    switch (periodType) {
      case 'day': from.setHours(0, 0, 0, 0); break;
      case 'week': from.setDate(now.getDate() - 7); break;
      case 'month': from.setMonth(now.getMonth() - 1); break;
    }
    
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = new Date().toISOString().slice(0, 10);
    
    setFromDate(fromStr);
    setToDate(toStr);
    props.onRangeChange(new Date(fromStr), new Date(toStr));
  };

  createEffect(() => setDateRange(period()));

  const handleDateChange = () => {
    if (fromDate() && toDate()) {
      props.onRangeChange(new Date(fromDate()), new Date(toDate()));
    }
  };

  return (
    <div class="flex flex-col sm:flex-row items-center gap-3">
      {/* Quick Select Buttons */}
      <div class="flex bg-black/40 p-1 rounded-xl border border-cyan-500/10">
        <For each={(['day', 'week', 'month'] as const)}>
          {(p) => (
            <button
              onClick={() => setPeriod(p)}
              class={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                period() === p ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          )}
        </For>
      </div>

      {/* Manual Inputs */}
      <div class="flex items-center gap-2 bg-black/40 border border-cyan-500/10 rounded-xl px-2 py-1">
        <input
          type="date"
          class="bg-transparent text-[10px] font-bold text-white outline-none w-24"
          value={fromDate()}
          onInput={(e) => {
            setFromDate(e.currentTarget.value);
            handleDateChange();
          }}
        />
        <div class="w-1 h-1 rounded-full bg-cyan-500/30" />
        <input
          type="date"
          class="bg-transparent text-[10px] font-bold text-white outline-none w-24"
          value={toDate()}
          onInput={(e) => {
            setToDate(e.currentTarget.value);
            handleDateChange();
          }}
        />
      </div>
    </div>
  );
}