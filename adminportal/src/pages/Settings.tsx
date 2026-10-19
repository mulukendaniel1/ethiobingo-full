// src/pages/Settings.tsx
import { createResource, Show, createSignal, For } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';
import WeeklyRewardHub from '../components/WeeklyRewardHub';

export default function Settings() {
  const [activeTab, setActiveTab] = createSignal<'referral' | 'agent' | 'bot' | 'deposit' | 'backup' | 'rewards'>('referral');
  const [settings, { refetch: refetchSettings }] = createResource(() => apiFetch<any>('/admin/settings'));
  const [pendingRequests, { refetch: refetchRequests }] = createResource(() => apiFetch<any[]>('/admin/agent-requests/pending'));
  const [approvingId, setApprovingId] = createSignal<string | null>(null);
  const [rejectingId, setRejectingId] = createSignal<string | null>(null);

  const [passwordConfirm, setPasswordConfirm] = createSignal<{
    open: boolean;
    title: string;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, title: '', onConfirm: async () => {} });

  const [revealDialog, setRevealDialog] = createSignal<{
    open: boolean;
    token: string;
  }>({ open: false, token: '' });

  const [changeTokenDialog, setChangeTokenDialog] = createSignal<{
    open: boolean;
    newToken: string;
  }>({ open: false, newToken: '' });

  const [pendingPassword, setPendingPassword] = createSignal('');

  const requestSettingUpdate = (key: string, value: any) => {
    const readableKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    setPasswordConfirm({
      open: true,
      title: `Update ${readableKey}?`,
      onConfirm: async (password: string) => {
        try {
          await apiFetch('/admin/settings', {
            method: 'POST',
            body: JSON.stringify({ key, value, settingsPassword: password }),
          });
          showToast('Setting updated successfully', 'success');
          refetchSettings();
        } catch (err: any) {
          showToast(err.message || 'Update failed', 'error');
        }
      }
    });
  };

    /**
   * Opens ONE password dialog and, on success, sends MULTIPLE settings
   * updates in a single flow. Resolves with `true` on success, `false`
   * if the user cancels — so the caller can decide whether to clear
   * its "dirty" state.
   */
  const requestBatchSettingUpdate = (
    updates: Array<{ key: string; value: any }>,
    title: string
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPasswordConfirm({
        open: true,
        title,
        onConfirm: async (password: string) => {
          try {
            // Verify the password ONCE up front
            await apiFetch('/admin/settings/verify-password', {
              method: 'POST',
              body: JSON.stringify({ password }),
            });
            // Then send each update with the same verified password
            for (const u of updates) {
              await apiFetch('/admin/settings', {
                method: 'POST',
                body: JSON.stringify({
                  key: u.key,
                  value: u.value,
                  settingsPassword: password,
                }),
              });
            }
            showToast('Settings updated successfully', 'success');
            refetchSettings();
            resolve(true);
          } catch (err: any) {
            showToast(err.message || 'Update failed', 'error');
            resolve(false);
            throw err; // keep dialog open so user can retry the password
          }
        },
      });
    });
  };

  const requestRevealToken = () => {
    setPasswordConfirm({
      open: true,
      title: 'Confirm Settings Access',
      onConfirm: async (password: string) => {
        try {
          await apiFetch('/admin/settings/verify-password', {
            method: 'POST',
            body: JSON.stringify({ password }),
          });
          setRevealDialog({ open: true, token: settings()?.bot_token || '' });
        } catch (err: any) {
          showToast(err.message || 'Invalid password', 'error');
        }
      }
    });
  };

  const requestChangeToken = () => {
    setPasswordConfirm({
      open: true,
      title: 'Confirm Settings Access',
      onConfirm: async (password: string) => {
        try {
          await apiFetch('/admin/settings/verify-password', {
            method: 'POST',
            body: JSON.stringify({ password }),
          });
          setPendingPassword(password);
          setChangeTokenDialog({ open: true, newToken: '' });
        } catch (err: any) {
          showToast(err.message || 'Invalid password', 'error');
        }
      }
    });
  };

  const handleSaveNewToken = async () => {
    const newToken = changeTokenDialog().newToken;
    if (!newToken.trim()) {
      showToast('Token cannot be empty', 'error');
      return;
    }
    try {
      await apiFetch('/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          key: 'bot_token',
          value: newToken,
          settingsPassword: pendingPassword(),
        }),
      });
      showToast('Bot token updated successfully', 'success');
      refetchSettings();
      setChangeTokenDialog({ open: false, newToken: '' });
      setPendingPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update token', 'error');
    }
  };

  const handleApprove = async (requestId: string) => {
    setApprovingId(requestId);
    try {
      await apiFetch(`/admin/agent-requests/${requestId}/approve`, { method: 'POST' });
      showToast('Agent approved', 'success');
      refetchRequests();
      window.dispatchEvent(new CustomEvent('agent-requests-updated'));
    } catch (err) {
      showToast('Failed to approve agent', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt('Rejection reason (optional)');
    setRejectingId(requestId);
    try {
      await apiFetch(`/admin/agent-requests/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      showToast('Request rejected', 'success');
      refetchRequests();
      window.dispatchEvent(new CustomEvent('agent-requests-updated'));
    } catch (err) {
      showToast('Failed to reject request', 'error');
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div class="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 class="text-4xl font-black tracking-tight text-white">Settings</h1>
        <p class="text-gray-500 text-sm mt-1 uppercase tracking-widest font-bold">Manage system preferences</p>
      </header>

      {/* Tab Bar */}
      <div class="flex p-1 bg-white/5 rounded-2xl border border-cyan-500/10 backdrop-blur-md sticky top-4 z-10 overflow-x-auto custom-scrollbar">
        <For each={['referral', 'agent', 'bot', 'deposit', 'rewards', 'backup'] as const}>
          {(tab) => (
            <button
              onClick={() => setActiveTab(tab)}
              class={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab() === tab 
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'referral' ? 'Referral'
                : tab === 'agent' ? 'Agent'
                : tab === 'bot' ? 'Bot'
                : tab === 'deposit' ? 'Deposit'
                : tab === 'rewards' ? 'Rewards'
                : 'Backup'}
              {tab === 'agent' && pendingRequests() && pendingRequests()!.length > 0 && (
                <span class="ml-2 bg-rose-500 text-white px-1.5 py-0.5 rounded-md text-[10px]">
                  {pendingRequests()!.length}
                </span>
              )}
            </button>
          )}
        </For>
      </div>

      <Show when={!settings.loading && settings()} fallback={<div class="py-20 text-center text-gray-500 font-mono animate-pulse">Loading settings...</div>}>
        {(s) => (
          <div class="grid grid-cols-1 gap-8">
            
            {/* Referral Tab */}
            <Show when={activeTab() === 'referral'}>
              <section class="max-w-2xl space-y-6">
                <div class="glass-dark rounded-2xl p-8 shadow-2xl">
                  <h2 class="text-xl font-black mb-6 flex items-center gap-2">
                    <span class="w-2 h-2 bg-cyan-500 rounded-full"></span>
                    Referral System
                  </h2>
                  <div class="space-y-4">
                    <ToggleSetting label="Enable Referral System" value={s().referral_enabled} onChange={(v) => requestSettingUpdate('referral_enabled', v)} />
                    <div class="h-px bg-white/5 my-4" />
                    <NumberSetting label="Referral Bonus (ETB)" value={s().referral_bonus_amount} onChange={(v) => requestSettingUpdate('referral_bonus_amount', v)} min={0} />
                  </div>

                  <div class="h-px bg-white/5 my-4" />
                    <ToggleSetting 
                      label="Phone Verification Bonus (Enable/Disable)" 
                      value={s().phone_bonus_enabled === true} 
                      onChange={(v) => requestSettingUpdate('phone_bonus_enabled', v)} 
                    />
                    <NumberSetting 
                      label="Phone Verification Bonus Amount (ETB)" 
                      value={s().phone_bonus_amount || 10} 
                      onChange={(v) => requestSettingUpdate('phone_bonus_amount', v)} 
                      min={0} 
                    />
                    <p class="text-xs text-gray-500 mt-1 italic">
                      When a user shares their phone number for the first time, they receive this non‑withdrawable bonus.
                    </p>
                </div>
              </section>
            </Show>

            {/* Agent Tab */}
            <Show when={activeTab() === 'agent'}>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="glass-dark rounded-2xl p-8 shadow-2xl">
                  <h2 class="text-xl font-black mb-6">Agent Settings</h2>
                  <div class="space-y-4">
                    <ToggleSetting label="Enable Agent System" value={s().agent_system_enabled} onChange={(v) => requestSettingUpdate('agent_system_enabled', v)} />
                    <NumberSetting label="Agent Commission Rate (%)" value={s().agent_commission_percent} onChange={(v) => requestSettingUpdate('agent_commission_percent', v)} min={0} max={100} />
                    <div class="h-px bg-white/5 my-4" />
                    <ToggleSetting label="Enable First Deposit Bonus" value={s().agent_first_deposit_bonus_enabled} onChange={(v) => requestSettingUpdate('agent_first_deposit_bonus_enabled', v)} />
                    <NumberSetting label="Bonus for deposits ≥50 ETB" value={s().agent_first_deposit_bonus_high} onChange={(v) => requestSettingUpdate('agent_first_deposit_bonus_high', v)} min={0} />
                    <NumberSetting label="Bonus for deposits 20-49 ETB" value={s().agent_first_deposit_bonus_low} onChange={(v) => requestSettingUpdate('agent_first_deposit_bonus_low', v)} min={0} />
                    <NumberSetting 
                      label="Minimum deposit for HIGH bonus (≥ this amount)" 
                      value={s().agent_min_deposit_for_bonus_high || 50} 
                      onChange={(v) => requestSettingUpdate('agent_min_deposit_for_bonus_high', v)} 
                      min={0} 
                    />
                    <NumberSetting 
                      label="Minimum deposit for LOW bonus (20 to this amount-1)" 
                      value={s().agent_min_deposit_for_bonus_low || 20} 
                      onChange={(v) => requestSettingUpdate('agent_min_deposit_for_bonus_low', v)} 
                      min={0} 
                    />
                  </div>
                </div>

                <div class="glass-dark rounded-2xl p-8">
                  <h2 class="text-xl font-black mb-6">Pending Agent Requests</h2>
                  <Show when={!pendingRequests.loading} fallback={<p class="text-gray-500">Loading requests...</p>}>
                    <div class="space-y-3">
                      {pendingRequests() && pendingRequests()!.length === 0 ? (
                        <p class="text-gray-600 text-sm italic">No pending requests.</p>
                      ) : (
                        <For each={pendingRequests()}>
                          {(req) => (
                            <div class="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-cyan-500/30 transition-all">
                              <div>
                                <p class="font-bold text-white text-sm">@{req.userId?.username || 'Unknown user'}</p>
                                <p class="text-[10px] text-gray-500 font-mono italic">{new Date(req.requestedAt).toLocaleDateString()}</p>
                              </div>
                              <div class="flex gap-2">
                                <button
                                  onClick={() => handleApprove(req._id)}
                                  disabled={approvingId() === req._id || rejectingId() === req._id}
                                  class="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {approvingId() === req._id ? 'Approving...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleReject(req._id)}
                                  disabled={approvingId() === req._id || rejectingId() === req._id}
                                  class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {rejectingId() === req._id ? 'Rejecting...' : 'Reject'}
                                </button>
                              </div>
                            </div>
                          )}
                        </For>
                      )}
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Bot Settings */}
            <Show when={activeTab() === 'bot'}>
              <section class="max-w-2xl glass-dark rounded-2xl p-8 shadow-2xl">
                <h2 class="text-xl font-black mb-6">Bot Settings</h2>
                <div class="space-y-4">
                  <div class="space-y-2">
                    <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Bot Token</label>
                    <div class="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value="••••••••••••••••••••••••••••••••"
                        disabled
                        class="flex-1 px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono text-sm cursor-not-allowed opacity-75"
                      />
                      <div class="flex gap-2">
                        <button
                          onClick={requestRevealToken}
                          class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest transition-all"
                        >
                          Show
                        </button>
                        <button
                          onClick={requestChangeToken}
                          class="px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-widest transition-all"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextSetting label="Bot Username" value={s().bot_username} onChange={(v) => requestSettingUpdate('bot_username', v)} />
                    <TextSetting label="Support Username" value={s().support_username} onChange={(v) => requestSettingUpdate('support_username', v)} />
                  </div>
                  <TextAreaSetting label="Admin IDs (comma separated)" value={s().admin_ids} onChange={(v) => requestSettingUpdate('admin_ids', v)} />
                  <div class="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl flex items-start gap-3">
                    <span class="text-lg">⚠️</span>
                    <p class="text-[10px] text-cyan-500/80 font-bold uppercase leading-tight">
                      Changing the bot token will disconnect the bot. You must restart the bot after changing this setting.
                    </p>
                  </div>

                  <ToggleSetting
                    label="Bot Mode (100% bot‑win guarantee)"
                    value={s().bot_mode_enabled === true}
                    onChange={(v) => requestSettingUpdate('bot_mode_enabled', v)}
                  />
                  <TextSetting
                    label="Bot Mode Rig Seed (any string)"
                    value={s().bot_mode_rig_seed || 'default_seed'}
                    onChange={(v) => requestSettingUpdate('bot_mode_rig_seed', v)}
                    placeholder="default_seed"
                  />

                  <ToggleSetting
                    label="Enable Bots"
                    value={s().bots_enabled === true}
                    onChange={(v) => requestSettingUpdate('bots_enabled', v)}
                  />
                  <div class="space-y-2">
                  <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Bot Names (one per line)</label>
                  <textarea
                    rows={10}
                    value={s().bot_names || ''}
                    onBlur={(e) => requestSettingUpdate('bot_names', e.currentTarget.value)}
                    class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono text-sm focus:border-cyan-500/50 outline-none transition-all custom-scrollbar"
                    placeholder="Abebe&#10;Chala&#10;..."
                  />
                  <p class="text-[9px] text-gray-500 ml-1">Each name will be used as a bot player. Up to 400 names recommended.</p>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                  <NumberSetting label="Min Bots per Round" value={s().bot_count_min || 14} onChange={(v) => requestSettingUpdate('bot_count_min', v)} min={1} max={30} />
                  <NumberSetting label="Max Bots per Round" value={s().bot_count_max || 20} onChange={(v) => requestSettingUpdate('bot_count_max', v)} min={1} max={30} />
                </div>
              </div>
            </section>
          </Show>

            {/* Deposit Details */}
            <Show when={activeTab() === 'deposit'}>
              <div class="space-y-6">
                <div class="glass-dark rounded-2xl p-6">
                  <ToggleSetting
                    label="Deposit & Withdraw Feature System"
                    value={s().etb_coin_enabled === true}
                    onChange={(v) => requestSettingUpdate('etb_coin_enabled', v)}
                  />
                  <p class="text-xs text-gray-500 mt-2 italic">
                    Disabling this will prevent users from Deposit & Withdraw ETB in the game.
                    Existing balances will be preserved but cannot be used until re-enabled.
                  </p>
                </div>
                <div class="glass-dark rounded-2xl p-6">
                  <ToggleSetting
                    label="Deposit System (Enable/Disable)"
                    value={s().deposit_enabled === true}
                    onChange={(v) => requestSettingUpdate('deposit_enabled', v)}
                  />
                  <p class="text-xs text-gray-500 mt-2 italic">
                    Disabling this will prevent users from creating new deposit requests. Existing pending requests can still be processed.
                  </p>
                </div>
                <div class="glass-dark rounded-2xl p-6">
                  <ToggleSetting
                    label="Withdrawal System (Enable/Disable)"
                    value={s().withdraw_enabled === true}
                    onChange={(v) => requestSettingUpdate('withdraw_enabled', v)}
                  />
                  <p class="text-xs text-gray-500 mt-2 italic">
                    Disabling this will prevent users from creating new withdrawal requests. Existing pending requests can still be processed.
                  </p>
                </div>


                                {/* Global Deposit Bonus */}
                <div class="glass-dark rounded-2xl p-6">
                  <ToggleSetting
                    label="Enable Global Deposit Bonus"
                    value={s().deposit_bonus_enabled === true}
                    onChange={(v) => requestSettingUpdate('deposit_bonus_enabled', v)}
                  />
                  <NumberSetting
                    label="Bonus Percentage (%)"
                    value={s().deposit_bonus_percent || 0}
                    onChange={(v) => requestSettingUpdate('deposit_bonus_percent', v)}
                    min={0}
                    max={100}
                  />
                  <p class="text-xs text-gray-500 mt-2 italic">
                    If enabled, every successful deposit will credit the depositor an extra percentage of the deposited amount as a non‑withdrawable bonus.
                    Default is 0% (no bonus).
                  </p>
                </div>
                

                {/* Bank Details Cards */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <For each={[
                    { title: 'CBE Bank', prefix: 'cbe' },
                    { title: 'Abyssinia Bank', prefix: 'abyssinia' },
                    { title: 'CBE Birr', prefix: 'cbe_birr', phone: true },
                    { title: 'Telebirr', prefix: 'telebirr', phone: true }
                  ]}>
                    {(bank) => (
                      <div class="glass-dark rounded-2xl p-6">
                        <h3 class="font-black text-gray-400 uppercase tracking-widest text-xs mb-4 border-b border-cyan-500/10 pb-2">{bank.title}</h3>
                        <TextSetting label="Account Name" value={s()[`${bank.prefix}_account_name`]} onChange={(v) => requestSettingUpdate(`${bank.prefix}_account_name`, v)} />
                        <TextSetting label={bank.phone ? "Phone Number" : "Account Number"} value={s()[`${bank.prefix}_${bank.phone ? 'phone' : 'account_number'}`]} onChange={(v) => requestSettingUpdate(`${bank.prefix}_${bank.phone ? 'phone' : 'account_number'}`, v)} />
                        <TextAreaSetting label="Instructions (Amharic)" value={s()[`${bank.prefix}_instructions_amh`]} onChange={(v) => requestSettingUpdate(`${bank.prefix}_instructions_amh`, v)} rows={2} />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Rewards Tab */}
            <Show when={activeTab() === 'rewards'}>
              <div class="space-y-8">
                <div class="glass-dark rounded-2xl p-5">
                  <h3 class="text-sm font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.5 7.5 0 10-10.014 0m9.768-2.25c.843-.523 1.492-1.226 1.492-2.25 0-1.024-.649-1.727-1.492-2.25m-9.768 4.5a7.5 7.5 0 01-1.492-2.25m9.768 0c-.843.523-1.492 1.226-1.492 2.25 0 1.024.649 1.727 1.492 2.25m-9.768 0c.843-.523 1.492-1.226 1.492-2.25 0-1.024-.649-1.727-1.492-2.25" />
                    </svg>
                    Weekly Rewards Hub
                  </h3>
                  <p class="text-xs text-gray-400 leading-relaxed">
                    Reward your best depositors and referrers every week. Rewards are added to the
                    user's <b class="text-white">non‑withdrawable</b> balance (locked) and can be converted
                    to withdrawable balance by playing — exactly like a deposit.
                    <br />
                    <span class="text-amber-400">
                      Week runs Sunday 00:00 → Saturday 23:59 (Ethiopian). Auto-payout fires every
                      Sunday at 12:05 AM Ethiopian time (ለሊት 6:05) — 5 minutes after the week ends.
                    </span>
                  </p>
                </div>

                <WeeklyRewardHub
                  type="depositor"
                  settings={s()}
                  onUpdate={requestSettingUpdate}
                  onBatchUpdate={requestBatchSettingUpdate}
                />
                <WeeklyRewardHub
                  type="referrer"
                  settings={s()}
                  onUpdate={requestSettingUpdate}
                  onBatchUpdate={requestBatchSettingUpdate}
                />
              </div>
            </Show>

            {/* Backup Tab */}
            <Show when={activeTab() === 'backup'}>
              <div class="overflow-x-auto w-full">
                <BackupSettings />
              </div>
            </Show>

          </div>
        )}
      </Show>

      {/* Unified Password Confirmation Dialog */}
      <PasswordConfirmDialog
        open={passwordConfirm().open}
        title={passwordConfirm().title}
        onConfirm={passwordConfirm().onConfirm}
        onCancel={() => setPasswordConfirm({ open: false, title: '', onConfirm: async () => {} })}
      />

      {/* Dialog to show revealed token */}
      <Show when={revealDialog().open}>
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div class="glass-dark rounded-2xl max-w-md w-full p-6 border border-cyan-500/10 shadow-2xl">
            <h3 class="text-xl font-black mb-4">Bot Token</h3>
            <p class="text-sm text-gray-400 mb-4">The following token is used to authenticate the bot with Telegram.</p>
            <div class="bg-black/50 p-4 rounded-xl border border-cyan-500/10 mb-6 break-all font-mono text-sm text-cyan-400">
              {revealDialog().token}
            </div>
            <div class="flex justify-end gap-3">
              <button
                onClick={() => setRevealDialog({ open: false, token: '' })}
                class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(revealDialog().token);
                  showToast('Token copied to clipboard', 'success');
                }}
                class="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs tracking-widest"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Dialog to change token */}
      <Show when={changeTokenDialog().open}>
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div class="glass-dark rounded-2xl max-w-md w-full p-6 border border-cyan-500/10 shadow-2xl">
            <h3 class="text-xl font-black mb-4">Change Bot Token</h3>
            <p class="text-sm text-gray-400 mb-4">Enter the new Telegram Bot Token. <br/>⚠️ After changing, you must restart the bot.</p>
            <input
              type="text"
              placeholder="New bot token"
              value={changeTokenDialog().newToken}
              onInput={(e) => setChangeTokenDialog({ open: true, newToken: e.currentTarget.value })}
              class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono text-sm focus:border-cyan-500/50 outline-none transition-all mb-6"
            />
            <div class="flex justify-end gap-3">
              <button
                onClick={() => setChangeTokenDialog({ open: false, newToken: '' })}
                class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewToken}
                class="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs tracking-widest"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// Helper components with green styling
function ToggleSetting(props: { label: string; value: boolean; onChange: (val: boolean) => void }) {
  return (
    <div class="flex justify-between items-center py-3 px-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-colors">
      <span class="text-sm font-bold text-gray-200">{props.label}</span>
      <button
        onClick={() => props.onChange(!props.value)}
        class={`relative inline-flex h-6 w-12 items-center rounded-full transition-all ${props.value ? 'bg-cyan-500' : 'bg-gray-700'}`}
      >
        <span class={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${props.value ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NumberSetting(props: { label: string; value: number; onChange: (val: number) => void; min?: number; max?: number }) {
  const [val, setVal] = createSignal(props.value);
  return (
    <div class="space-y-2">
      <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">{props.label}</label>
      <input
        type="number"
        value={val()}
        onBlur={(e) => props.onChange(parseFloat(e.currentTarget.value))}
        class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono focus:border-cyan-500/50 outline-none transition-all"
      />
    </div>
  );
}

function TextSetting(props: { label: string; value: string; onChange: (val: string) => void; placeholder?: string }) {
  return (
    <div class="space-y-2 py-2">
      <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">{props.label}</label>
      <input 
        type="text" 
        value={props.value || ''} 
        placeholder={props.placeholder || ''}
        onBlur={(e) => props.onChange(e.currentTarget.value)}
        class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm focus:border-cyan-500/50 outline-none transition-all" 
      />
    </div>
  );
}

function TextAreaSetting(props: { label: string; value: string; onChange: (val: string) => void; rows?: number }) {
  return (
    <div class="space-y-2">
      <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">{props.label}</label>
      <textarea 
        rows={props.rows || 2} 
        value={props.value || ''} 
        onBlur={(e) => props.onChange(e.currentTarget.value)}
        class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm focus:border-cyan-500/50 outline-none transition-all resize-none" 
      />
    </div>
  );
}

// ==================== Backup Settings Component ====================
function BackupSettings() {
  const [backupData, { refetch }] = createResource(() => apiFetch<any>('/admin/backup/settings'));
  const [passwordConfirm, setPasswordConfirm] = createSignal<{
    open: boolean;
    title: string;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, title: '', onConfirm: async () => {} });

  const [downloadPasswordConfirm, setDownloadPasswordConfirm] = createSignal<{
    open: boolean;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, onConfirm: async () => {} });

  const [showFolderId, setShowFolderId] = createSignal(false);
  const [showGuide, setShowGuide] = createSignal(false);

  const lastBackup = () => backupData()?.history?.[0];
  const isDriveApiError = () => {
    const error = lastBackup()?.error;
    return error && error.includes('Google Drive API has not been used');
  };

  const updateSetting = async (key: string, value: any) => {
    setPasswordConfirm({
      open: true,
      title: `Update ${key.replace(/_/g, ' ')}`,
      onConfirm: async (password: string) => {
        try {
          await apiFetch('/admin/backup/settings', {
            method: 'POST',
            body: JSON.stringify({ [key]: value, settingsPassword: password }),
          });
          showToast('Setting updated', 'success');
          setTimeout(() => refetch(), 500);
        } catch (err: any) {
          showToast(err.message || 'Update failed', 'error');
        }
      }
    });
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    updateSetting('serviceAccountKeyJson', text);
  };

  const handleManualBackup = async () => {
    setPasswordConfirm({
      open: true,
      title: 'Confirm Manual Backup',
      onConfirm: async (password: string) => {
        try {
          const res = await apiFetch<any>('/admin/backup/manual', { 
            method: 'POST', 
            body: JSON.stringify({ settingsPassword: password }) 
          });
          if (res?.success) {
            showToast('Backup started', 'success');
            setTimeout(() => refetch(), 5000);
          } else {
            showToast(res?.error || 'Backup failed', 'error');
          }
        } catch (err: any) {
          showToast(err.message || 'Failed', 'error');
        }
      }
    });
  };

  const handleShowFolderId = () => {
    setPasswordConfirm({
      open: true,
      title: 'Confirm to Reveal Folder ID',
      onConfirm: async (password: string) => {
        try {
          await apiFetch('/admin/settings/verify-password', {
            method: 'POST',
            body: JSON.stringify({ password }),
          });
          setShowFolderId(true);
          setTimeout(() => setShowFolderId(false), 30000);
        } catch (err: any) {
          showToast(err.message || 'Invalid password', 'error');
        }
      }
    });
  };

  const handleChangeFolderId = () => {
    const newId = prompt('Enter new Google Drive Folder ID:', backupData()?.googleDriveBackupFolderId || '');
    if (newId && newId.trim()) updateSetting('googleDriveBackupFolderId', newId.trim());
  };

  const handleDownload = (filename: string) => {
    setDownloadPasswordConfirm({
      open: true,
      onConfirm: async (password: string) => {
        const token = localStorage.getItem('admin_token');
        const apiBase = import.meta.env.VITE_API_URL || '';
        const url = `${apiBase}/admin/backup/download/${encodeURIComponent(filename)}?token=${token}&settingsPassword=${encodeURIComponent(password)}`;
        window.open(url, '_blank');
      }
    });
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('Delete this backup permanently?')) return;
    setPasswordConfirm({
      open: true,
      title: 'Confirm Delete',
      onConfirm: async (password: string) => {
        try {
          await apiFetch(`/admin/backup/${encodeURIComponent(filename)}`, { 
            method: 'DELETE', 
            body: JSON.stringify({ settingsPassword: password }) 
          });
          showToast('Backup deleted', 'success');
          refetch();
        } catch (err: any) {
          showToast(err.message || 'Delete failed', 'error');
        }
      }
    });
  };

  return (
    <div class="flex flex-col lg:flex-row gap-8 w-full min-w-0">
      {/* Left column: Settings & History */}
      <div class="flex-1 space-y-6">
        <Show when={isDriveApiError()}>
          <div class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-bold text-amber-400">Google Drive API Not Enabled</p>
              <p class="text-xs text-amber-300/80 mt-1">
                Your last backup failed because the Drive API is disabled in your Google Cloud project.
                Click the button below to enable it (takes 1-2 minutes).
              </p>
              <a
                href="https://console.cloud.google.com/apis/library/drive.googleapis.com?project=bingo-492111"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase tracking-wider transition"
              >
                Enable Drive API →
              </a>
            </div>
          </div>
        </Show>

        {/* Main backup settings card */}
        <div class="glass-dark rounded-2xl p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-black flex items-center gap-2">
              <svg class="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Google Drive Backup
            </h2>
            <button
              onClick={() => setShowGuide(true)}
              class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider text-cyan-400 transition"
            >
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Full Guide
            </button>
          </div>
          <div class="space-y-5">
            <ToggleSetting label="Enable Automatic Backup" value={backupData()?.backupEnabled} onChange={(v) => updateSetting('backupEnabled', v)} />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Retention Days</label>
                <input
                  type="number"
                  value={backupData()?.backupRetentionDays || 30}
                  onBlur={(e) => updateSetting('backupRetentionDays', parseInt(e.currentTarget.value) || 30)}
                  min={1}
                  max={90}
                  class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono text-sm focus:border-cyan-500/50 outline-none transition-all"
                  placeholder="30"
                />
                <p class="text-[9px] text-gray-500 ml-1">How many days to keep backups</p>
              </div>
              <div class="space-y-2">
                <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Cron Schedule (UTC)</label>
                <input
                  type="text"
                  value={backupData()?.backupCronTime || '0 2 * * *'}
                  onBlur={(e) => updateSetting('backupCronTime', e.currentTarget.value)}
                  class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono text-sm focus:border-cyan-500/50 outline-none transition-all"
                  placeholder="0 2 * * *"
                />
                <p class="text-[9px] text-gray-500 ml-1">Format: minute hour day month day-of-week (e.g., <code class="text-cyan-500">0 2 * * *</code> = daily at 2 AM UTC)</p>
              </div>
            </div>
            
            {/* Folder ID */}
            <div class="space-y-2">
              <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Google Drive Folder ID</label>
              <div class="flex flex-wrap gap-2">
                <div class="flex-1 min-w-[150px]">
                  <input
                    type={showFolderId() ? "text" : "password"}
                    value={backupData()?.googleDriveBackupFolderId || ''}
                    readOnly
                    class="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white font-mono text-sm cursor-not-allowed opacity-75"
                  />
                </div>
                <button onClick={handleShowFolderId} class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest transition whitespace-nowrap">
                  <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {showFolderId() ? 'Hide' : 'Show'}
                </button>
                <button onClick={handleChangeFolderId} class="px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-widest transition whitespace-nowrap">
                  <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Change
                </button>
              </div>
              <p class="text-[9px] text-gray-500 ml-1">The folder ID from your Google Drive shared folder URL</p>
            </div>

            {/* Service Account Key */}
            <div class="space-y-2">
              <label class="block text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Service Account Key (JSON)</label>
              <div class="flex flex-wrap items-center gap-3">
                <label class="cursor-pointer px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-xs font-black uppercase tracking-wider">
                  <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Choose File
                  <input type="file" accept=".json" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} class="hidden" />
                </label>
                <span class="text-xs text-gray-400">
                  {backupData()?.hasServiceAccountKey ? (
                    <span class="flex items-center gap-1 text-cyan-400">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Key uploaded
                    </span>
                  ) : (
                    <span class="flex items-center gap-1 text-rose-400">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      No key uploaded
                    </span>
                  )}
                </span>
              </div>
            </div>

            <button onClick={handleManualBackup} class="w-full sm:w-auto px-6 py-3 bg-cyan-500 text-black rounded-xl font-black text-xs uppercase tracking-wider hover:bg-cyan-400 transition flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Backup Now
            </button>
          </div>
        </div>

        {/* Backup History */}
        <div class="glass-dark rounded-2xl p-6">
          <h2 class="text-xl font-black mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Backup History
          </h2>
          <Show when={!backupData.loading} fallback={<div class="animate-pulse h-20 bg-white/5 rounded-xl"></div>}>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="text-gray-500 border-b border-cyan-500/10">
                  <tr><th class="pb-2">Filename</th><th class="pb-2">Size</th><th class="pb-2">Date</th><th class="pb-2">Status</th><th class="pb-2">Actions</th></tr>
                </thead>
                <tbody>
                  <For each={backupData()?.history || []}>
                    {(backup) => (
                      <tr class="border-b border-white/5">
                        <td class="py-3 font-mono break-all max-w-[200px] truncate" title={backup.filename}>{backup.filename}</td>
                        <td class="py-3">{(backup.sizeBytes / 1024 / 1024).toFixed(2)} MB</td>
                        <td class="py-3 whitespace-nowrap">{new Date(backup.createdAt).toLocaleString()}</td>
                        <td class="py-3">
                          {backup.status === 'success' ? (
                            <span class="flex items-center gap-1 text-cyan-400">
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                              </svg>
                              Success
                            </span>
                          ) : (
                            <span class="flex items-center gap-1 text-rose-400">
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Failed
                            </span>
                          )}
                        </td>
                        <td class="py-3 space-x-3">
                          {(backup.status === 'success' || backup.localPath) && (
                            <button onClick={() => handleDownload(backup.filename)} class="text-blue-400 hover:underline">
                              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </button>
                          )}
                          <button onClick={() => handleDelete(backup.filename)} class="text-red-400 hover:underline">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                  <Show when={!backupData()?.history?.length}>
                    <tr><td colspan="5" class="py-8 text-center text-gray-500">No backups yet. Click "Backup Now" to create one.</td></tr>
                  </Show>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </div>

      {/* Right Help Sidebar */}
      <div class="w-full lg:w-80 glass-dark rounded-2xl p-6 h-fit lg:sticky lg:top-24">
        <h3 class="text-sm font-black uppercase tracking-wider text-cyan-400 mb-4 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Quick Reference
        </h3>
        <div class="space-y-3 text-xs text-gray-300">
          <div><span class="text-cyan-400">1.</span> Enable Drive API in Google Cloud Console</div>
          <div><span class="text-cyan-400">2.</span> Create Service Account → Download JSON key</div>
          <div><span class="text-cyan-400">3.</span> Share Drive folder with service account email</div>
          <div><span class="text-cyan-400">4.</span> Copy Folder ID from URL</div>
          <div><span class="text-cyan-400">5.</span> Paste Folder ID & upload JSON key here</div>
          <div class="pt-2 border-t border-cyan-500/10"><span class="text-cyan-400">📘</span> Click "Full Guide" for detailed instructions</div>
        </div>
      </div>

      <PasswordConfirmDialog open={passwordConfirm().open} title={passwordConfirm().title} onConfirm={passwordConfirm().onConfirm} onCancel={() => setPasswordConfirm({ open: false, title: '', onConfirm: async () => {} })} />
      <Show when={showGuide()}>
        <GuideModal open={showGuide()} onClose={() => setShowGuide(false)} />
      </Show>
      <PasswordConfirmDialog
        open={downloadPasswordConfirm().open}
        title="Confirm Backup Download"
        onConfirm={downloadPasswordConfirm().onConfirm}
        onCancel={() => setDownloadPasswordConfirm({ open: false, onConfirm: async () => {} })}
      />
    </div>
  );
}

// Guide modal with green styling
function GuideModal(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null;
  return (
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={props.onClose}>
      <div class="glass-dark rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto border border-cyan-500/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div class="sticky top-0 bg-[#0a0a0a] border-b border-cyan-500/10 px-6 py-4 flex justify-between items-center">
          <h3 class="text-xl font-black flex items-center gap-2">
            <svg class="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Complete Backup Setup Guide
          </h3>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-6 space-y-6 text-sm text-gray-300">
          {/* ... content unchanged, just change text-cyan and yellow to cyan */}
          <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p class="font-bold text-amber-400 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What does this backup do?
            </p>
            <p class="mt-1">Every night at the scheduled time, the system creates a full compressed backup of your entire database (users, balances, transactions, game history, settings). The backup is saved both <strong>locally on the server</strong> and <strong>uploaded to your Google Drive</strong> (if configured). You can always download the latest backup from this page.</p>
          </div>

          <div>
            <p class="font-bold text-white text-base mb-2 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Step-by-Step Setup
            </p>
            <ol class="list-decimal list-inside space-y-3 ml-2">
              <li><strong>Enable Google Drive API</strong> – Go to <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com?project=bingo-492111" target="_blank" class="text-blue-400 hover:underline">Google Cloud Console → Drive API</a> and click <span class="text-cyan-400">ENABLE</span>. (Use your project: <code class="bg-black/50 px-1 rounded">bingo-492111</code>)</li>
              <li><strong>Create a Service Account</strong> – In <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" class="text-blue-400">IAM & Admin → Service Accounts</a>, click <span class="text-cyan-400">+ Create Service Account</span>. Name it (e.g., <code>bingo-backup</code>), assign role <span class="text-cyan-400">Editor</span>, then click <strong>Done</strong>. After creation, click on the account → <strong>Keys</strong> → <strong>Add Key</strong> → <strong>Create New Key</strong> → <strong>JSON</strong>. Download the key file.</li>
              <li><strong>Share a Google Drive Folder</strong> – Create a new folder in your Google Drive (e.g., <code>BingoBackups</code>). Right‑click → <strong>Share</strong> → add the service account email (found inside the JSON under <code>client_email</code>) as <span class="text-cyan-400">Editor</span>. Click Send.</li>
              <li><strong>Copy the Folder ID</strong> – Open the shared folder in your browser. The URL will look like: <code>https://drive.google.com/drive/folders/XXXXXXXXXX</code>. Copy the long ID after <code>folders/</code>.</li>
              <li><strong>Deploy the Apps Script Proxy (One‑time)</strong> – <a href="https://script.google.com" target="_blank" class="text-blue-400">Open Google Apps Script</a>, create a new project, paste the code from the next section, deploy as web app (Execute as Me, Anyone access). Copy the deployment URL.</li>
              <li><strong>Configure in Admin Panel</strong> – Go to <strong>Settings → Backup</strong>. Paste the Folder ID, upload the JSON key, set retention days (e.g., 30), and click <span class="text-cyan-400">Backup Now</span> to test.</li>
            </ol>
          </div>

          <div>
            <p class="font-bold text-white text-base mb-2 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Apps Script Code (Copy & Paste)
            </p>
            <div class="bg-black/50 p-3 rounded-xl font-mono text-xs overflow-x-auto">
              <pre class="whitespace-pre-wrap">{`function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const folder = DriveApp.getFolderById(data.folderId);
  const fileBlob = Utilities.newBlob(Utilities.base64Decode(data.base64), "application/gzip", data.filename);
  const file = folder.createFile(fileBlob);
  return ContentService.createTextOutput(JSON.stringify({ id: file.getId() }))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
            </div>
            <p class="text-xs text-gray-400 mt-1">After pasting, click <strong>Deploy → New Deployment</strong> (type: Web App, execute as: Me, who has access: Anyone). Copy the URL and set it in the backend (hardcoded in <code>BackupService.ts</code>).</p>
          </div>

          <div>
            <p class="font-bold text-white text-base mb-2 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Troubleshooting
            </p>
            <ul class="list-disc list-inside space-y-2">
              <li><strong>Backup fails with "File not found"</strong> – Verify the folder ID is correct and the service account has Editor permission on that folder. Wait a few minutes for permissions to propagate.</li>
              <li><strong>Drive API not enabled</strong> – Click the warning banner or enable it manually in Google Cloud Console.</li>
              <li><strong>Backup works but no Drive upload</strong> – Check the Apps Script deployment URL. Ensure the script is deployed as a Web App with access set to "Anyone".</li>
              <li><strong>Download button not working</strong> – The backup is saved locally on the server. If the server restarts, local files may be lost. Always keep Drive upload active.</li>
              <li><strong>Local backups are stored in <code>/app/backups</code></strong> – They are not accessible from outside the server. Use the Download button in the UI.</li>
            </ul>
          </div>

          <div>
            <p class="font-bold text-white text-base mb-2 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Important Notes
            </p>
            <ul class="list-disc list-inside space-y-1 text-xs text-gray-400">
              <li>Automatic backups run daily at the cron time (default 02:00 UTC).</li>
              <li>Retention days: older backups are automatically deleted from the history list (Drive files remain unless manually deleted).</li>
              <li>Manual backups are always saved locally; Drive upload is attempted but not required.</li>
              <li>Changing the bot token does not affect backups.</li>
              <li>For security, all sensitive actions (show folder ID, change settings, delete backup) require the settings password.</li>
            </ul>
          </div>

          <div class="pt-2 text-center text-gray-500 text-xs">
            Need more help? Contact your system administrator.
          </div>
        </div>
        <div class="sticky bottom-0 bg-[#0a0a0a] border-t border-cyan-500/10 px-6 py-4 flex justify-end">
          <button onClick={props.onClose} class="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-widest">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}