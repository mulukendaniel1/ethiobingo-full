// src/pages/AgentManagement.tsx
import { createSignal, Show, For, onMount } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';

interface SearchResult {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  isAdmin: boolean;
  isAgent: boolean;
  agentApprovedAt?: string | null;
  isBanned: boolean;
  referralCount: number;
  referralEarnings: number;
  totalCommissionPaid: number;
}

interface AgentInfo {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  agentApprovedAt?: string;
  referralCount: number;
  referralEarnings: number;
  totalCommissionPaid: number;
}

// ─── Icons ───
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const AgentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75M12 14a4 4 0 100-8 4 4 0 000 8z" />
  </svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>
);
const BanIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);
const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

export default function AgentManagement() {
  const [activeTab, setActiveTab] = createSignal<'upgrade' | 'manage'>('upgrade');

  // Upgrade tab
  const [query, setQuery] = createSignal('');
  const [searchResult, setSearchResult] = createSignal<SearchResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [confirmedUser, setConfirmedUser] = createSignal(false);
  const [agreeToConsequences, setAgreeToConsequences] = createSignal(false);
  const [upgrading, setUpgrading] = createSignal(false);
  const [upgraded, setUpgraded] = createSignal(false);

  // Manage tab
  const [agents, setAgents] = createSignal<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = createSignal(false);
  const [searchAgents, setSearchAgents] = createSignal('');
  const [sortBy, setSortBy] = createSignal('commission');
  const [showRevokeDialog, setShowRevokeDialog] = createSignal(false);
  const [revokeTarget, setRevokeTarget] = createSignal<AgentInfo | null>(null);

  // Details panel
  const [details, setDetails] = createSignal<any>(null);
  const [loadingDetails, setLoadingDetails] = createSignal(false);

  onMount(() => {
    fetchAgents();
  });

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const params = new URLSearchParams();
      if (searchAgents()) params.append('search', searchAgents());
      params.append('sortBy', sortBy());
      params.append('limit', '50');
      const data = await apiFetch<{ agents: AgentInfo[] }>(
        `/admin/agents/list?${params.toString()}`
      );
      setAgents(data.agents);
    } catch (err: any) {
      showToast(err.message || 'Failed to load agents', 'error');
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleSearch = async () => {
    const q = query().trim();
    if (!q) return showToast('Enter username, ID or phone', 'error');
    setLoading(true);
    try {
      const data = await apiFetch<{ user: SearchResult }>('/admin/agents/search', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });
      setSearchResult(data.user);
      setConfirmedUser(false);
      setUpgraded(false);
    } catch (err: any) {
      setSearchResult(null);
      showToast(err.message || 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!agreeToConsequences()) return showToast('Please acknowledge the notice', 'error');
    setUpgrading(true);
    try {
      const result = await apiFetch<{ success: boolean }>('/admin/agents/upgrade', {
        method: 'POST',
        body: JSON.stringify({ telegramId: searchResult()?.telegramId }),
      });
      if (result.success) {
        setUpgraded(true);
        showToast('User upgraded to agent successfully', 'success');
        fetchAgents();
      }
    } catch (err: any) {
      showToast(err.message || 'Upgrade failed', 'error');
    } finally {
      setUpgrading(false);
    }
  };

  const handleRevoke = async (password: string) => {
    if (!revokeTarget()) return;
    try {
      await apiFetch('/admin/agents/revoke', {
        method: 'POST',
        body: JSON.stringify({
          telegramId: revokeTarget()!.telegramId,
          settingsPassword: password,
        }),
      });
      showToast('Agent revoked successfully', 'success');
      setShowRevokeDialog(false);
      setRevokeTarget(null);
      fetchAgents();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke', 'error');
      throw err;
    }
  };

  const loadDetails = async (telegramId: number) => {
    setLoadingDetails(true);
    setDetails(null);
    try {
      const data = await apiFetch<any>(`/admin/agents/${telegramId}/details`);
      setDetails(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center gap-4 mb-8">
        <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <AgentIcon />
        </div>
        <div>
          <h1 class="text-2xl font-black text-white">Agent Management</h1>
          <p class="text-gray-400">Upgrade users to agents and monitor their performance.</p>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('upgrade')}
          class={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
            activeTab() === 'upgrade' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          Upgrade to Agent
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          class={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
            activeTab() === 'manage' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          Manage Agents
        </button>
      </div>

      {/* ─── Upgrade Tab ─── */}
      <Show when={activeTab() === 'upgrade'}>
        <div class="glass-dark p-6 rounded-2xl border border-white/10">
          <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Search</label>
          <div class="flex gap-2">
            <input
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Username, Telegram ID or phone (2519...)"
              class="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={loading()}
              class="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              <SearchIcon />
              {loading() ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <Show when={searchResult()}>
          {(u) => (
            <div class="mt-6 glass-dark p-6 rounded-2xl border border-white/10">
              <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                  <UserIcon />
                </div>
                <h2 class="text-lg font-bold text-white">User Found</h2>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span class="text-gray-500">Name:</span> <span class="text-white ml-2">{u().firstName} {u().lastName || ''}</span></div>
                <div><span class="text-gray-500">Telegram ID:</span> <span class="text-white ml-2">{u().telegramId}</span></div>
                <div><span class="text-gray-500">Username:</span> <span class="text-white ml-2">{u().username ? '@' + u().username : 'N/A'}</span></div>
                <div><span class="text-gray-500">Phone:</span> <span class="text-white ml-2">{u().phoneNumber || 'N/A'}</span></div>
                <div>
                  <span class="text-gray-500">Admin:</span>
                  <span class={`ml-2 font-bold flex items-center gap-1 ${u().isAdmin ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {u().isAdmin ? <CheckIcon /> : <BanIcon />} {u().isAdmin ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span class="text-gray-500">Agent:</span>
                  <span class={`ml-2 font-bold flex items-center gap-1 ${u().isAgent ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {u().isAgent ? <CheckIcon /> : <BanIcon />} {u().isAgent ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <Show when={u().isAgent}>
                <p class="mt-4 text-amber-400 font-bold">This user is already an agent.</p>
              </Show>

              <Show when={!u().isAgent && !confirmedUser() && !upgraded()}>
                <div class="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <p class="text-sm text-gray-400">Is this the correct user?</p>
                  <button
                    onClick={() => setConfirmedUser(true)}
                    class="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </Show>

              <Show when={confirmedUser() && !upgraded()}>
                <div class="mt-8 border-t border-white/10 pt-6">
                  <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                    <div class="flex items-start gap-3">
                      <WarningIcon />
                      <div>
                        <p class="font-bold text-amber-400 text-sm mb-2">Agent privileges</p>
                        <ul class="list-disc list-inside text-gray-400 text-xs space-y-1">
                          <li>Earns lifetime commission on every deposit made by their referrals</li>
                          <li>Receives a one-time first deposit bonus for each referral</li>
                          <li>Can be revoked later at any time</li>
                        </ul>
                      </div>
                    </div>
                    <label class="flex items-center gap-2 mt-4">
                      <input
                        type="checkbox"
                        checked={agreeToConsequences()}
                        onInput={(e) => setAgreeToConsequences(e.currentTarget.checked)}
                        class="h-4 w-4 text-cyan-500 rounded"
                      />
                      <span class="text-xs text-gray-300">I understand and want to proceed</span>
                    </label>
                  </div>

                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading() || !agreeToConsequences()}
                    class="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <AgentIcon />
                    {upgrading() ? 'Upgrading...' : 'Upgrade to Agent'}
                  </button>
                </div>
              </Show>

              <Show when={upgraded()}>
                <div class="mt-8 border-t border-white/10 pt-6">
                  <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckIcon />
                    <p class="text-emerald-400 font-bold">User upgraded to agent successfully!</p>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Show>

      {/* ─── Manage Tab ─── */}
      <Show when={activeTab() === 'manage'}>
        <div class="glass-dark p-6 rounded-2xl border border-white/10">
          <div class="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              value={searchAgents()}
              onInput={(e) => setSearchAgents(e.currentTarget.value)}
              placeholder="Search agents..."
              class="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-600 outline-none"
            />
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.currentTarget.value)}
              class="bg-black border border-white/10 rounded-xl px-4 py-2 text-white outline-none"
            >
              <option value="commission">Sort: Total Commission</option>
              <option value="referrals">Sort: Referrals</option>
              <option value="earnings">Sort: Earnings</option>
              <option value="newest">Sort: Newest</option>
            </select>
            <button
              onClick={fetchAgents}
              class="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-colors"
            >
              Apply
            </button>
          </div>

          <Show when={!loadingAgents()} fallback={
            <div class="flex justify-center py-8">
              <div class="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
            </div>
          }>
            <Show when={agents().length > 0} fallback={<p class="text-gray-400 text-sm">No agents found.</p>}>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-gray-500 border-b border-white/10">
                      <th class="pb-2 pr-4 font-bold">Telegram ID</th>
                      <th class="pb-2 pr-4 font-bold">Name</th>
                      <th class="pb-2 pr-4 font-bold">Username</th>
                      <th class="pb-2 pr-4 font-bold">Referrals</th>
                      <th class="pb-2 pr-4 font-bold">Commission</th>
                      <th class="pb-2 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={agents()}>
                      {(a) => (
                        <tr class="border-b border-white/5">
                          <td class="py-3 pr-4">{a.telegramId}</td>
                          <td class="py-3 pr-4">{a.firstName} {a.lastName || ''}</td>
                          <td class="py-3 pr-4">{a.username ? '@' + a.username : 'N/A'}</td>
                          <td class="py-3 pr-4">{a.referralCount}</td>
                          <td class="py-3 pr-4 text-emerald-400 font-bold">
                            {((a as any).effectiveCommission ?? a.totalCommissionPaid ?? 0).toFixed(2)} ETB
                          </td>
                          <td class="py-3 flex gap-3">
                            <button
                              onClick={() => loadDetails(a.telegramId)}
                              class="text-cyan-400 hover:text-cyan-300 font-bold text-xs"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => { setRevokeTarget(a); setShowRevokeDialog(true); }}
                              class="text-rose-400 hover:text-rose-300 font-bold text-xs"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </div>

        {/* Details Panel */}
        <Show when={loadingDetails()}>
          <div class="mt-6 flex justify-center py-8">
            <div class="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
          </div>
        </Show>

        <Show when={details() && !loadingDetails()}>
          <div class="mt-6 glass-dark p-6 rounded-2xl border border-white/10">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-white">
                Agent Details — {details().agent.firstName} {details().agent.lastName || ''}
              </h3>
              <button
                onClick={() => setDetails(null)}
                class="text-gray-400 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <div class="bg-black/30 rounded-xl p-3">
                <p class="text-[10px] text-gray-500 uppercase font-black">Total Referrals</p>
                <p class="text-lg text-white font-black">{details().stats.totalReferrals}</p>
              </div>
              <div class="bg-black/30 rounded-xl p-3">
                <p class="text-[10px] text-gray-500 uppercase font-black">Referred Deposits</p>
                <p class="text-lg text-emerald-400 font-black">{details().stats.totalReferredDeposits.toFixed(2)}</p>
              </div>
              <div class="bg-black/30 rounded-xl p-3">
                <p class="text-[10px] text-gray-500 uppercase font-black">Avg Deposit / Ref</p>
                <p class="text-lg text-cyan-400 font-black">{details().stats.averageDeposit.toFixed(2)}</p>
              </div>
              <div class="bg-black/30 rounded-xl p-3">
                <p class="text-[10px] text-gray-500 uppercase font-black">% Commission</p>
                <p class="text-lg text-emerald-400 font-black">
                  {(details().agent.commissionOnly || 0).toFixed(2)}
                </p>
              </div>
              <div class="bg-black/30 rounded-xl p-3">
                <p class="text-[10px] text-gray-500 uppercase font-black">First Deposit Bonus</p>
                <p class="text-lg text-amber-400 font-black">
                  {(details().agent.firstDepositOnly || 0).toFixed(2)}
                </p>
              </div>
              <div class="bg-black/30 rounded-xl p-3">
                <p class="text-[10px] text-gray-500 uppercase font-black">Signup Bonuses</p>
                <p class="text-lg text-cyan-400 font-black">
                  {(details().agent.signupBonuses || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <h4 class="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Referred Users</h4>
            <Show when={details().referredUsers.length > 0} fallback={<p class="text-gray-500 text-sm">No referrals yet.</p>}>
              <div class="overflow-x-auto mb-4">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-left text-gray-500 border-b border-white/10">
                      <th class="pb-2 pr-4">Telegram ID</th>
                      <th class="pb-2 pr-4">Name</th>
                      <th class="pb-2 pr-4">Username</th>
                      <th class="pb-2">Deposits</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={details().referredUsers}>
                      {(ru: any) => (
                        <tr class="border-b border-white/5">
                          <td class="py-2 pr-4">{ru.telegramId}</td>
                          <td class="py-2 pr-4">{ru.firstName} {ru.lastName || ''}</td>
                          <td class="py-2 pr-4">{ru.username ? '@' + ru.username : 'N/A'}</td>
                          <td class="py-2 text-emerald-400 font-bold">{(ru.totalConfirmedDepositsETB || 0).toFixed(2)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            <h4 class="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Recent Commissions</h4>
            <Show when={details().recentCommissions.length > 0} fallback={<p class="text-gray-500 text-sm">No commission history.</p>}>
              <div class="space-y-1 max-h-64 overflow-y-auto">
                <For each={details().recentCommissions}>
                  {(tx: any) => (
                    <div class="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2 text-xs">
                      <span class="text-gray-400">{new Date(tx.timestamp).toLocaleString()}</span>
                      <span class="text-white">{tx.notes || tx.reference}</span>
                      <span class="text-emerald-400 font-bold">+{tx.amount.toFixed(2)} ETB</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </Show>

      <PasswordConfirmDialog
        open={showRevokeDialog()}
        title="Revoke Agent Status"
        onConfirm={handleRevoke}
        onCancel={() => { setShowRevokeDialog(false); setRevokeTarget(null); }}
      />
    </div>
  );
}