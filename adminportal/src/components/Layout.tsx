// src/components/Layout.tsx
import { useAuth } from '../context/auth';
import { A, useLocation } from '@solidjs/router';
import { Show, createSignal, createResource, onMount } from 'solid-js';
import ChangePasswordModal from './ChangePasswordModal';
import Icon from './Icon';
import { apiFetch } from '../api/client';

interface NavLinkProps {
  href: string;
  active: boolean;
  icon: 'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'broadcast' | 'settings' | 'audit' | 'docs' | 'unclaimed' | 'winners' | 'ledger' | 'phone-abuse' | 'shamo' |'cleanup';
  label: string;
  badge?: number;
}

export default function Layout(props: { children: any }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showChangePassword, setShowChangePassword] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [profileOpen, setProfileOpen] = createSignal(false);

  // Pending counts (unchanged)
  const [pendingAgentCount, { refetch: refetchAgentCount }] = createResource(
    () => apiFetch<{ count: number }>('/admin/agent-requests/pending/count')
  );
  const [pendingDepositCount, { refetch: refetchDepositCount }] = createResource(
    () => apiFetch<{ count: number }>('/admin/deposits/pending/count')
  );
  const [pendingWithdrawalCount, { refetch: refetchWithdrawalCount }] = createResource(
    () => apiFetch<{ count: number }>('/admin/withdrawals/pending/count')
  );
  const [unclaimedCount, { refetch: refetchUnclaimedCount }] = createResource(
    () => apiFetch<{ total: number }>('/admin/unclaimed-receipts?matched=false&limit=1')
  );

  onMount(() => {
    const handleAgentUpdate = () => refetchAgentCount();
    const handleDepositUpdate = () => refetchDepositCount();
    const handleWithdrawalUpdate = () => refetchWithdrawalCount();
    const handleUnclaimedUpdate = () => refetchUnclaimedCount();

    window.addEventListener('agent-requests-updated', handleAgentUpdate);
    window.addEventListener('deposit-updated', handleDepositUpdate);
    window.addEventListener('withdrawal-updated', handleWithdrawalUpdate);
    window.addEventListener('unclaimed-updated', handleUnclaimedUpdate);

    return () => {
      window.removeEventListener('agent-requests-updated', handleAgentUpdate);
      window.removeEventListener('deposit-updated', handleDepositUpdate);
      window.removeEventListener('withdrawal-updated', handleWithdrawalUpdate);
      window.removeEventListener('unclaimed-updated', handleUnclaimedUpdate);
    };
  });

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    window.location.replace('/login');
  };

  const getBadge = (resource: any) => {
    if (resource.loading) return undefined;
    const data = resource();
    if (!data) return undefined;
    const value = data.count ?? data.total;
    return value > 0 ? value : undefined;
  };

  return (
    <div class="flex h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-gray-200 font-sans selection:bg-cyan-400/30 selection:text-cyan-100">

      {/* Mobile Backdrop */}
      <Show when={sidebarOpen()}>
        <div
          class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      </Show>

      {/* Sidebar */}
      <aside
        class={`fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-slate-900/90 to-indigo-950/90 border-r border-cyan-400/20 p-8 flex flex-col z-[70]
          transform transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
          lg:static lg:transform-none shadow-2xl
          ${sidebarOpen() ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo Section */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-black text-white italic tracking-tighter uppercase">
              Admin<span class="text-cyan-400">Panel</span>
            </h1>
            <p class="text-[9px] font-black text-cyan-400/70 uppercase tracking-[0.3em] mt-1">Management Console</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} class="lg:hidden text-gray-400 hover:text-white transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Navigation */}
        <div class="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-1">
          <NavLink href="/" active={isActive('/')} icon="dashboard" label="Dashboard" />
          <NavLink href="/users" active={isActive('/users')} icon="users" label="Users" />
          <NavLink href="/agents" active={isActive('/agents')} icon="users" label="Agents" />
          <NavLink
  href="/bonus-cleanup"
  active={isActive('/bonus-cleanup')}
  icon="cleanup"
  label="Bonus Cleanup"
/>
          <NavLink
            href="/deposits"
            active={isActive('/deposits')}
            icon="deposits"
            label="Deposits"
            badge={getBadge(pendingDepositCount)}
          />
          <NavLink
            href="/unclaimed"
            active={isActive('/unclaimed')}
            icon="unclaimed"
            label="Unclaimed SMS"
            badge={getBadge(unclaimedCount)}
          />
          <NavLink
            href="/withdrawals"
            active={isActive('/withdrawals')}
            icon="withdrawals"
            label="Withdrawals"
            badge={getBadge(pendingWithdrawalCount)}
          />
          <NavLink href="/shamo" active={isActive('/shamo')} icon="shamo" label="ሻሞ Giveaway" />
          <NavLink href="/round-winners" active={isActive('/round-winners')} icon="winners" label="Round Winners" />
          <NavLink href="/broadcast" active={isActive('/broadcast')} icon="broadcast" label="Broadcast" />
          <NavLink href="/admin-reports" active={isActive('/admin-reports')} icon="docs" label="Admin Reports" />
          <NavLink href="/ledger" active={isActive('/ledger')} icon="ledger" label="Ledger" />
  <NavLink
    href="/phone-abuse"
    active={isActive('/phone-abuse')}
    icon="phone-abuse"
    label="Phone Abuse"
  />
          <NavLink href="/audit-logs" active={isActive('/audit-logs')} icon="audit" label="Audit Logs" />
          <NavLink href="/docs" active={isActive('/docs')} icon="docs" label="Documentation" />
          <NavLink
            href="/settings"
            active={isActive('/settings')}
            icon="settings"
            label="Settings"
            badge={getBadge(pendingAgentCount)}
          />
        </div>
      </aside>

      {/* Main Container */}
      <div class="flex-1 flex flex-col overflow-hidden relative">

        {/* Top Header */}
        <header class="flex items-center justify-between px-4 lg:px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-cyan-400/10 sticky top-0 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            class="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </button>
          <div class="lg:hidden"></div>

          {/* Profile Dropdown */}
          <div class="relative ml-auto">
            <button
              onClick={() => setProfileOpen(!profileOpen())}
              class="flex items-center gap-3 px-2 py-1.5 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-cyan-400/30"
            >
              <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 to-violet-500 flex items-center justify-center text-black font-black text-xs shadow-lg shadow-cyan-400/20">
                {user()?.firstName?.charAt(0) || 'A'}
              </div>
              <span class="hidden sm:block text-xs font-bold text-gray-200">{user()?.firstName || 'Admin'}</span>
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <Show when={profileOpen()}>
              <div
                class="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900/95 border border-cyan-400/30 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-violet-500 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-cyan-400/20">
                    {user()?.firstName?.charAt(0) || 'A'}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-white truncate">{user()?.firstName}</p>
                    <p class="text-xs text-gray-400 truncate">{user()?.email}</p>
                  </div>
                </div>
                <div class="space-y-1">
                  <button
                    onClick={() => { setProfileOpen(false); setShowChangePassword(true); }}
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Change Password
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); handleLogout(); }}
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </Show>
            <Show when={profileOpen()}>
              <div class="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
            </Show>

            <Show when={user()?.isMainAdmin}>
              <NavLink href="/admin-upgrade" active={isActive('/admin-upgrade')} icon="settings" label="Admin Upgrade" />
            </Show>
          </div>
        </header>

        {/* Main Body */}
        <main class="flex-1 overflow-auto p-6 lg:p-10 bg-transparent custom-scrollbar">
          {props.children}
        </main>
      </div>

      <ChangePasswordModal open={showChangePassword()} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}

function NavLink(props: NavLinkProps) {
  return (
    <A
      href={props.href}
      class={`group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 border
        ${props.active
          ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
          : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`
      }
    >
      <div class={`${props.active ? 'text-cyan-300' : 'text-gray-500 group-hover:text-gray-300'}`}>
        <Icon name={props.icon} />
      </div>
      <span class="text-[11px] font-black uppercase tracking-wider flex-1">{props.label}</span>

      <Show when={props.badge}>
        <span class="flex items-center justify-center bg-fuchsia-500 text-white text-[9px] font-black rounded-lg h-5 min-w-[20px] px-1 shadow-lg shadow-fuchsia-500/40 animate-pulse">
          {props.badge}
        </span>
      </Show>
    </A>
  );
}