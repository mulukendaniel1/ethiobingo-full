// src/pages/AdminUpgrade.tsx
import { createSignal, Show, For, onMount } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/auth';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';

interface SearchResult {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string | null;
  isAdmin: boolean;
  isBanned: boolean;
}

interface AdminInfo {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  createdAt: string;
}

// Professional SVG icon components
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H10a2 2 0 01-2-2z" />
  </svg>
);

const BanIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>
);

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

export default function AdminUpgrade() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = createSignal<'upgrade' | 'manage'>('upgrade');

  // Upgrade state
  const [query, setQuery] = createSignal('');
  const [searchResult, setSearchResult] = createSignal<SearchResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [confirmedUser, setConfirmedUser] = createSignal(false);
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [settingsPassword, setSettingsPassword] = createSignal('');
  const [agreeToConsequences, setAgreeToConsequences] = createSignal(false);
  const [upgrading, setUpgrading] = createSignal(false);
  const [upgraded, setUpgraded] = createSignal(false);
  const [credentials, setCredentials] = createSignal<{ email: string; password: string } | null>(null);

  // Manage admins state
  const [admins, setAdmins] = createSignal<AdminInfo[]>([]);
  const [loadingAdmins, setLoadingAdmins] = createSignal(false);
  const [showRevokeDialog, setShowRevokeDialog] = createSignal(false);
  const [revokeTarget, setRevokeTarget] = createSignal<AdminInfo | null>(null);

  // Guard: only main admin can view this page
  if (!user()?.isMainAdmin) {
    return (
      <div class="p-6">
        <p class="text-rose-400 font-bold">Access denied. Only the main admin can use this page.</p>
      </div>
    );
  }

  // Fetch admins on mount
  onMount(() => {
    fetchAdmins();
  });

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const data = await apiFetch<{ admins: AdminInfo[] }>('/admin/main/admins');
      setAdmins(data.admins);
    } catch (err: any) {
      showToast(err.message || 'Failed to load admins', 'error');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleRevoke = async (password: string) => {
    if (!revokeTarget()) return;
    try {
      const result = await apiFetch<{ success: boolean }>('/admin/main/revoke', {
        method: 'POST',
        body: JSON.stringify({
          telegramId: revokeTarget()!.telegramId,
          settingsPassword: password,
        }),
      });
      if (result.success) {
        showToast('Admin revoked successfully', 'success');
        setShowRevokeDialog(false);
        setRevokeTarget(null);
        fetchAdmins(); // refresh list
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke', 'error');
      throw err; // keep dialog open
    }
  };

  // Search handlers
  const handleSearch = async () => {
    const q = query().trim();
    if (!q) {
      showToast('Enter a username or phone number', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ user: SearchResult }>('/admin/main/search', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });
      setSearchResult(data.user);
      setConfirmedUser(false);
      setUpgraded(false);
      setCredentials(null);
    } catch (err: any) {
      setSearchResult(null);
      showToast(err.message || 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    // Client-side checks
    if (!email() || !password() || !confirmPassword() || !settingsPassword()) {
      showToast('All fields are required', 'error');
      return;
    }
    if (!agreeToConsequences()) {
      showToast('You must acknowledge the consequences', 'error');
      return;
    }
    if (password() !== confirmPassword()) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setUpgrading(true);
    try {
      const result = await apiFetch<{ success: boolean }>('/admin/main/upgrade', {
        method: 'POST',
        body: JSON.stringify({
          telegramId: searchResult()?.telegramId,
          email: email(),
          password: password(),
          settingsPassword: settingsPassword(),
        }),
      });
      if (result.success) {
        setUpgraded(true);
        setCredentials({ email: email(), password: password() });
        showToast('User upgraded successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Upgrade failed', 'error');
    } finally {
      setUpgrading(false);
    }
  };

  const sendCredentialsNow = async () => {
    if (!credentials()) return;
    try {
      await apiFetch('/admin/main/send-credentials', {
        method: 'POST',
        body: JSON.stringify({
          telegramId: searchResult()?.telegramId,
          email: credentials()!.email,
          password: credentials()!.password,
        }),
      });
      showToast('Credentials sent to user via bot', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to send credentials', 'error');
    }
  };

  const copyCredentials = async () => {
    if (!credentials()) return;
    const text = `Email: ${credentials()!.email}\nPassword: ${credentials()!.password}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Credentials copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  // Password strength
  const passwordStrength = () => {
    const pw = password();
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) score++;
    return Math.min(score, 5);
  };

  const strengthLabel = () => {
    const s = passwordStrength();
    if (s === 0) return '—';
    if (s <= 2) return 'Weak';
    if (s === 3) return 'Fair';
    if (s === 4) return 'Good';
    return 'Strong';
  };

  const strengthColor = () => {
    const s = passwordStrength();
    if (s <= 2) return 'bg-red-500';
    if (s === 3) return 'bg-yellow-500';
    if (s === 4) return 'bg-lime-500';
    return 'bg-emerald-500';
  };

  return (
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-4 mb-8">
        <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <ShieldIcon />
        </div>
        <div>
          <h1 class="text-2xl font-black text-white">Admin Management</h1>
          <p class="text-gray-400">Upgrade users or manage existing admins.</p>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('upgrade')}
          class={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${activeTab() === 'upgrade' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Upgrade New Admin
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          class={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${activeTab() === 'manage' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Manage Admins
        </button>
      </div>

      {/* Upgrade Tab */}
      <Show when={activeTab() === 'upgrade'}>
        <div>
          {/* Search section */}
          <div class="glass-dark p-6 rounded-2xl border border-white/10">
            <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Search</label>
            <div class="flex gap-2">
              <input
                type="text"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                placeholder="Username (no @), phone (251...) or Telegram ID"
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

          {/* Result */}
          <Show when={searchResult()}>
            {(user) => (
              <div class="mt-6 glass-dark p-6 rounded-2xl border border-white/10">
                <div class="flex items-center gap-4 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                    <UserIcon />
                  </div>
                  <h2 class="text-lg font-bold text-white">User Found</h2>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500">Name:</span>
                    <span class="text-white ml-2">{user().firstName} {user().lastName || ''}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Telegram ID:</span>
                    <span class="text-white ml-2">{user().telegramId}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Username:</span>
                    <span class="text-white ml-2">{user().username ? '@' + user().username : 'N/A'}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Phone:</span>
                    <span class="text-white ml-2">{user().phoneNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Admin Status:</span>
                    <span class={`ml-2 font-bold flex items-center gap-1 ${user().isAdmin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {user().isAdmin ? <CheckIcon /> : <BanIcon />}
                      {user().isAdmin ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-500">Banned:</span>
                    <span class={`ml-2 font-bold flex items-center gap-1 ${user().isBanned ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {user().isBanned ? <BanIcon /> : <CheckIcon />}
                      {user().isBanned ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                {/* Confirmation step */}
                <Show when={!user().isAdmin && !confirmedUser() && !upgraded()}>
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

                {/* Already admin warning */}
                <Show when={user().isAdmin && !upgraded()}>
                  <p class="mt-4 text-amber-400 font-bold">This user is already an admin.</p>
                </Show>

                {/* Upgrade form (only after confirmation) */}
                <Show when={confirmedUser() && !upgraded()}>
                  <div class="mt-8 border-t border-white/10 pt-6">
                    <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Grant Admin Access</h3>

                    {/* Consequences warning */}
                    <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                      <div class="flex items-start gap-3">
                        <WarningIcon />
                        <div>
                          <p class="font-bold text-amber-400 text-sm mb-2">Important – Consequences of upgrading</p>
                          <p class="text-gray-300 text-sm leading-relaxed">
                            By upgrading this user to admin, they will gain full access to the admin panel and will be able to:
                          </p>
                          <ul class="list-disc list-inside text-gray-400 text-xs mt-2 space-y-1">
                            <li>Manage users (ban, unban, adjust balances)</li>
                            <li>Confirm or reject deposits and withdrawals</li>
                            <li>Change system settings</li>
                            <li>Send broadcasts to all users</li>
                            <li>View sensitive financial data</li>
                          </ul>
                        </div>
                      </div>
                      <label class="flex items-center gap-2 mt-4">
                        <input
                          type="checkbox"
                          checked={agreeToConsequences()}
                          onInput={(e) => setAgreeToConsequences(e.currentTarget.checked)}
                          class="h-4 w-4 text-cyan-500 rounded focus:ring-cyan-500"
                        />
                        <span class="text-xs text-gray-300">I understand the implications of granting admin access</span>
                      </label>
                    </div>

                    {/* Form fields */}
                    <div class="space-y-4">
                      <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                        <input
                          type="email"
                          value={email()}
                          onInput={(e) => setEmail(e.currentTarget.value)}
                          placeholder="admin@example.com"
                          class="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Password</label>
                        <input
                          type="password"
                          value={password()}
                          onInput={(e) => setPassword(e.currentTarget.value)}
                          placeholder="Min 8 chars, include uppercase, lowercase, number, special"
                          class="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none"
                        />
                        <div class="mt-2 flex items-center gap-2">
                          <div class="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div class={`h-full ${strengthColor()} transition-all`} style={{ width: `${(passwordStrength() / 5) * 100}%` }} />
                          </div>
                          <span class="text-xs text-gray-400 w-12 text-right">{strengthLabel()}</span>
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword()}
                          onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                          placeholder="Repeat password"
                          class="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Settings Password (for verification)</label>
                        <input
                          type="password"
                          value={settingsPassword()}
                          onInput={(e) => setSettingsPassword(e.currentTarget.value)}
                          placeholder="Enter settings access password"
                          class="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none"
                        />
                      </div>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgrading() || !agreeToConsequences()}
                        class="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <ShieldIcon />
                        {upgrading() ? 'Upgrading...' : 'Upgrade to Admin'}
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Success state */}
                <Show when={upgraded()}>
                  <div class="mt-8 border-t border-white/10 pt-6">
                    <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
                      <SuccessIcon />
                      <p class="text-emerald-400 font-bold">Upgrade successful!</p>
                    </div>
                    <div class="flex gap-3">
                      <button
                        onClick={sendCredentialsNow}
                        class="flex items-center justify-center gap-2 flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl transition-colors"
                      >
                        <SendIcon />
                        Send Credentials Now
                      </button>
                      <button
                        onClick={copyCredentials}
                        class="flex items-center justify-center gap-2 flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-colors"
                      >
                        <CopyIcon />
                        Copy Credentials
                      </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-3">If you choose "Copy Credentials", you can send them manually later.</p>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>

      {/* Manage Admins Tab */}
      <Show when={activeTab() === 'manage'}>
        <div class="glass-dark p-6 rounded-2xl border border-white/10">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">Existing Admins</h2>
            <button
              onClick={fetchAdmins}
              class="text-xs text-cyan-400 hover:text-cyan-300 font-bold"
            >
              Refresh
            </button>
          </div>

          <Show when={loadingAdmins()} fallback={
            <Show when={admins().length > 0} fallback={<p class="text-gray-400 text-sm">No admins found.</p>}>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-gray-500 border-b border-white/10">
                      <th class="pb-2 pr-4 font-bold">Telegram ID</th>
                      <th class="pb-2 pr-4 font-bold">Name</th>
                      <th class="pb-2 pr-4 font-bold">Username</th>
                      <th class="pb-2 pr-4 font-bold">Email</th>
                      <th class="pb-2 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={admins()}>
                      {(admin) => (
                        <tr class="border-b border-white/5">
                          <td class="py-3 pr-4">{admin.telegramId}</td>
                          <td class="py-3 pr-4">{admin.firstName} {admin.lastName || ''}</td>
                          <td class="py-3 pr-4">{admin.username ? '@' + admin.username : 'N/A'}</td>
                          <td class="py-3 pr-4">{admin.email || 'N/A'}</td>
                          <td class="py-3">
                            <Show when={user()?.telegramId && admin.telegramId !== user()?.telegramId}>
                              <button
                                onClick={() => {
                                  setRevokeTarget(admin);
                                  setShowRevokeDialog(true);
                                }}
                                class="text-rose-400 hover:text-rose-300 font-bold text-xs"
                              >
                                Revoke
                              </button>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          }>
            <div class="flex justify-center py-8">
              <div class="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Revoke Confirmation Dialog */}
      <PasswordConfirmDialog
        open={showRevokeDialog()}
        title="Revoke Admin Access"
        onConfirm={handleRevoke}
        onCancel={() => {
          setShowRevokeDialog(false);
          setRevokeTarget(null);
        }}
      />
    </div>
  );
}