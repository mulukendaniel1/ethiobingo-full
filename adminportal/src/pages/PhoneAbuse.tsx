// apps/etm-frontend/src/pages/PhoneAbuse.tsx
import { createSignal, createResource, createEffect, For, Show, Switch, Match } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';

type Tab = 'logs' | 'users';

interface Stats {
  totalAttempts: number;
  uniquePhones: number;
  uniqueAttempters: number;
  uniqueOwners: number;
  duplicateFlagged: number;
  fastFlagged: number;
}

interface UserMini {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  riskScore?: number;
  riskLevel?: string;
  riskFlags?: string[];
  isBanned?: boolean;
  phoneNumber?: string | null;
  createdAt?: string;
}

interface AbuseLog {
  _id: string;
  normalizedPhone: string;
  attemptedByTelegramId: number;
  existingOwnerTelegramId: number | null;
  secondsSinceStart: number | null;
  createdAt: string;
  attacker: UserMini | null;
  owner: UserMini | null;
}

const RISK_COLOR = (level?: string) =>
  level === 'CRITICAL'
    ? 'text-rose-300 border-rose-500/40 bg-rose-500/10'
    : level === 'HIGH'
    ? 'text-orange-300 border-orange-500/40 bg-orange-500/10'
    : level === 'MEDIUM'
    ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
    : 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10';

function formatDate(d: string) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PhoneAbuse() {
  const [tab, setTab] = createSignal<Tab>('logs');
  const [page, setPage] = createSignal(1);
  const [limit] = createSignal(20);
  const [search, setSearch] = createSignal('');
  const [flagFilter, setFlagFilter] = createSignal<'' | 'duplicate_phone_number' | 'fast_contact_share'>('');
  const [phoneFilter, setPhoneFilter] = createSignal('');

  // ── Stats ──────────────────────────────────────────────────────
  const [stats, { refetch: refetchStats }] = createResource<Stats>(() =>
    apiFetch<Stats>('/admin/phone-abuse/stats').catch(() => ({
      totalAttempts: 0, uniquePhones: 0, uniqueAttempters: 0,
      uniqueOwners: 0, duplicateFlagged: 0, fastFlagged: 0,
    }))
  );

  // ── Logs ───────────────────────────────────────────────────────
  const [logsData, { refetch: refetchLogs }] = createResource(
    () => ({ page: page(), limit: limit(), phone: phoneFilter() }),
    async ({ page, limit, phone }) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (phone.trim()) params.set('phone', phone.trim());
      return apiFetch<{ logs: AbuseLog[]; total: number }>(
        `/admin/phone-abuse/logs?${params.toString()}`
      );
    }
  );

  // ── Flagged users ──────────────────────────────────────────────
  const [usersData, { refetch: refetchUsers }] = createResource(
    () => ({ page: page(), limit: limit(), search: search(), flag: flagFilter() }),
    async ({ page, limit, search, flag }) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search.trim()) params.set('search', search.trim());
      if (flag) params.set('flag', flag);
      return apiFetch<{ users: UserMini[]; total: number }>(
        `/admin/phone-abuse/flagged-users?${params.toString()}`
      );
    }
  );

  // Reset to page 1 whenever the tab or filters change
  createEffect(() => {
    tab();
    search();
    flagFilter();
    phoneFilter();
    setPage(1);
  });

  const refreshAll = () => {
    refetchStats();
    refetchLogs();
    refetchUsers();
  };

  const totalPages = () => {
    const total = tab() === 'logs' ? (logsData()?.total ?? 0) : (usersData()?.total ?? 0);
    return Math.max(1, Math.ceil(total / limit()));
  };

  const unban = async (u: UserMini) => {
    try {
      await apiFetch(`/admin/users/${u._id}/unban`, { method: 'POST' });
      showToast(`User ${u.telegramId} unbanned`, 'success');
      refreshAll();
    } catch (e: any) {
      showToast(e?.message || 'Failed to unban', 'error');
    }
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-white uppercase tracking-tight italic">
            Phone <span class="text-cyan-400">Abuse Guard</span>
          </h1>
          <p class="text-xs text-gray-400 mt-1">
            Duplicate‑phone attempts & users flagged for fast contact sharing.
          </p>
        </div>
        <button
          onClick={refreshAll}
          class="self-start px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-cyan-400/20 text-xs font-black uppercase text-gray-300 hover:text-white transition"
        >
          ⟳ Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div class="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Attempts',  value: stats()?.totalAttempts,    accent: 'text-white' },
          { label: 'Unique Phones',   value: stats()?.uniquePhones,     accent: 'text-cyan-300' },
          { label: 'Attackers',       value: stats()?.uniqueAttempters, accent: 'text-orange-300' },
          { label: 'Victim Owners',   value: stats()?.uniqueOwners,     accent: 'text-violet-300' },
          { label: 'Duplicate Flag',  value: stats()?.duplicateFlagged, accent: 'text-rose-300' },
          { label: 'Fast Share Flag', value: stats()?.fastFlagged,      accent: 'text-amber-300' },
        ].map(card => (
          <div class="bg-slate-900/70 backdrop-blur-md border border-cyan-400/15 rounded-2xl p-4 shadow-lg shadow-cyan-500/5">
            <p class="text-[10px] uppercase font-black tracking-widest text-gray-500">{card.label}</p>
            <p class={`text-2xl font-black mt-2 ${card.accent}`}>
              {card.value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div class="flex items-center gap-2 border-b border-cyan-400/10">
        <button
          onClick={() => setTab('logs')}
          class={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${
            tab() === 'logs'
              ? 'text-cyan-300 border-cyan-400'
              : 'text-gray-500 border-transparent hover:text-white'
          }`}
        >
          Abuse Attempts
        </button>
        <button
          onClick={() => setTab('users')}
          class={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${
            tab() === 'users'
              ? 'text-cyan-300 border-cyan-400'
              : 'text-gray-500 border-transparent hover:text-white'
          }`}
        >
          Flagged Users
        </button>
      </div>

      {/* Filters */}
      <div class="flex flex-wrap gap-3 items-center">
        <Switch>
          <Match when={tab() === 'logs'}>
            <input
              type="text"
              placeholder="Filter by phone (e.g. 2519…)"
              value={phoneFilter()}
              onInput={e => setPhoneFilter(e.currentTarget.value)}
              class="bg-slate-900/70 border border-cyan-400/20 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 w-72"
            />
          </Match>
          <Match when={tab() === 'users'}>
            <input
              type="text"
              placeholder="Search username / telegramId / name…"
              value={search()}
              onInput={e => setSearch(e.currentTarget.value)}
              class="bg-slate-900/70 border border-cyan-400/20 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 w-72"
            />
            <select
              value={flagFilter()}
              onChange={e => setFlagFilter(e.currentTarget.value as any)}
              class="bg-slate-900/70 border border-cyan-400/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400/60"
            >
              <option value="">All Flags</option>
              <option value="duplicate_phone_number">Duplicate Phone</option>
              <option value="fast_contact_share">Fast Contact Share</option>
            </select>
          </Match>
        </Switch>
      </div>

      {/* Content */}
      <div class="bg-slate-900/70 backdrop-blur-md border border-cyan-400/15 rounded-2xl overflow-hidden shadow-lg shadow-cyan-500/5">
        <Switch>
          {/* ── Abuse Attempts ─────────────────────────────── */}
          <Match when={tab() === 'logs'}>
            <Show
              when={!logsData.loading}
              fallback={<div class="p-10 text-center text-gray-500 text-xs uppercase tracking-widest">Loading…</div>}
            >
              <Show
                when={(logsData()?.logs?.length ?? 0) > 0}
                fallback={<div class="p-10 text-center text-gray-500 text-xs uppercase tracking-widest">No abuse attempts recorded</div>}
              >
                <div class="overflow-x-auto">
                  <table class="w-full text-left">
                    <thead class="bg-black/30 border-b border-cyan-400/10">
                      <tr class="text-[10px] uppercase tracking-widest text-gray-500">
                        <th class="px-4 py-3 font-black">When</th>
                        <th class="px-4 py-3 font-black">Phone</th>
                        <th class="px-4 py-3 font-black">Attacker</th>
                        <th class="px-4 py-3 font-black">Existing Owner</th>
                        <th class="px-4 py-3 font-black">Δt (start)</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-cyan-400/5">
                      <For each={logsData()!.logs}>
                        {log => (
                          <tr class="hover:bg-white/[0.02] transition-colors">
                            <td class="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </td>
                            <td class="px-4 py-3 text-xs font-mono text-cyan-300">
                              +{log.normalizedPhone}
                            </td>
                            <td class="px-4 py-3 text-xs">
                              <div class="flex items-center gap-2">
                                <div>
                                  <p class="text-white font-bold">
                                    {log.attacker?.username
                                      ? `@${log.attacker.username}`
                                      : log.attacker?.firstName || 'Unknown'}
                                  </p>
                                  <p class="text-[10px] text-gray-500 font-mono">
                                    {log.attemptedByTelegramId}
                                  </p>
                                </div>
                                <Show when={log.attacker && (log.attacker.riskScore ?? 0) > 0}>
                                  <span class={`text-[9px] px-1.5 py-0.5 rounded border font-black ${RISK_COLOR(log.attacker!.riskLevel)}`}>
                                    {log.attacker!.riskLevel} · {log.attacker!.riskScore}
                                  </span>
                                </Show>
                              </div>
                            </td>
                            <td class="px-4 py-3 text-xs">
                              <Show when={log.owner} fallback={<span class="text-gray-600 italic">— unclaimed —</span>}>
                                <div>
                                  <p class="text-white font-bold">
                                    {log.owner!.username
                                      ? `@${log.owner!.username}`
                                      : log.owner!.firstName || 'Unknown'}
                                  </p>
                                  <p class="text-[10px] text-gray-500 font-mono">
                                    {log.existingOwnerTelegramId}
                                  </p>
                                </div>
                              </Show>
                            </td>
                            <td class="px-4 py-3 text-xs">
                              <Show
                                when={log.secondsSinceStart !== null}
                                fallback={<span class="text-gray-600">—</span>}
                              >
                                <span
                                  class={
                                    (log.secondsSinceStart ?? 99) < 2
                                      ? 'text-rose-300 font-black'
                                      : 'text-gray-400'
                                  }
                                >
                                  {log.secondsSinceStart!.toFixed(1)}s
                                </span>
                              </Show>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Show>
          </Match>

          {/* ── Flagged Users ──────────────────────────────── */}
          <Match when={tab() === 'users'}>
            <Show
              when={!usersData.loading}
              fallback={<div class="p-10 text-center text-gray-500 text-xs uppercase tracking-widest">Loading…</div>}
            >
              <Show
                when={(usersData()?.users?.length ?? 0) > 0}
                fallback={<div class="p-10 text-center text-gray-500 text-xs uppercase tracking-widest">No flagged users</div>}
              >
                <div class="overflow-x-auto">
                  <table class="w-full text-left">
                    <thead class="bg-black/30 border-b border-cyan-400/10">
                      <tr class="text-[10px] uppercase tracking-widest text-gray-500">
                        <th class="px-4 py-3 font-black">User</th>
                        <th class="px-4 py-3 font-black">Telegram ID</th>
                        <th class="px-4 py-3 font-black">Phone</th>
                        <th class="px-4 py-3 font-black">Risk</th>
                        <th class="px-4 py-3 font-black">Flags</th>
                        <th class="px-4 py-3 font-black">Joined</th>
                        <th class="px-4 py-3 font-black">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-cyan-400/5">
                      <For each={usersData()!.users}>
                        {u => (
                          <tr class="hover:bg-white/[0.02] transition-colors">
                            <td class="px-4 py-3 text-xs">
                              <p class="text-white font-bold">
                                {u.username ? `@${u.username}` : u.firstName || 'Unknown'}
                              </p>
                              <p class="text-[10px] text-gray-500">
                                {u.firstName} {u.lastName}
                              </p>
                            </td>
                            <td class="px-4 py-3 text-xs font-mono text-gray-400">
                              {u.telegramId}
                            </td>
                            <td class="px-4 py-3 text-xs font-mono">
                              <Show when={u.phoneNumber} fallback={<span class="text-gray-600">—</span>}>
                                <span class="text-cyan-300">+{u.phoneNumber}</span>
                              </Show>
                            </td>
                            <td class="px-4 py-3">
                              <span class={`text-[10px] px-2 py-1 rounded-md border font-black ${RISK_COLOR(u.riskLevel)}`}>
                                {u.riskLevel || 'LOW'} · {u.riskScore ?? 0}
                              </span>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-1">
                                <For each={u.riskFlags || []}>
                                  {f => (
                                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-200 font-bold">
                                      {f.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </td>
                            <td class="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {formatDate(u.createdAt || '')}
                            </td>
                            <td class="px-4 py-3">
                              <Show when={u.isBanned} fallback={
                                <span class="text-[10px] font-black uppercase text-cyan-300">Active</span>
                              }>
                                <div class="flex items-center gap-2">
                                  <span class="text-[10px] font-black uppercase text-rose-300">Banned</span>
                                  <button
                                    onClick={() => unban(u)}
                                    class="text-[10px] px-2 py-1 rounded bg-cyan-400/10 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/20 transition font-bold"
                                  >
                                    Unban
                                  </button>
                                </div>
                              </Show>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Show>
          </Match>
        </Switch>

        {/* Pagination */}
        <Show when={totalPages() > 1}>
          <div class="flex items-center justify-between border-t border-cyan-400/10 px-4 py-3 bg-black/20">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest">
              Page {page()} of {totalPages()}
            </p>
            <div class="flex gap-2">
              <button
                disabled={page() <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                class="px-3 py-1.5 rounded-lg bg-white/5 border border-cyan-400/20 text-[10px] font-black uppercase text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Prev
              </button>
              <button
                disabled={page() >= totalPages()}
                onClick={() => setPage(p => Math.min(totalPages(), p + 1))}
                class="px-3 py-1.5 rounded-lg bg-white/5 border border-cyan-400/20 text-[10px] font-black uppercase text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}