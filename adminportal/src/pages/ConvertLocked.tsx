// src/pages/ConvertLocked.tsx
import { createSignal, Show, createResource } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/auth';
import PasswordConfirmDialog from '../components/PasswordConfirmDialog';

export default function ConvertLocked() {
  const { user } = useAuth();
  const [telegramId, setTelegramId] = createSignal('');
  const [searchId, setSearchId] = createSignal('');
  const [amount, setAmount] = createSignal(0);
  const [converting, setConverting] = createSignal(false);
  const [convertPasswordConfirm, setConvertPasswordConfirm] = createSignal<{
    open: boolean;
    onConfirm: (password: string) => Promise<void>;
  }>({ open: false, onConfirm: async () => {} });

  const [userData, { refetch }] = createResource(
    () => (searchId() ? parseInt(searchId()) : null),
    async (id) => {
      const res = await apiFetch<any>(`/admin/users?search=${id}`);
      if (res.users && res.users.length > 0) return res.users[0];
      return null;
    }
  );

  const handleSearch = () => {
    if (!telegramId().trim()) {
      showToast('Please enter a Telegram ID', 'error');
      return;
    }
    setSearchId(telegramId());
  };

  const triggerConvert = () => {
    if (!userData() || !amount() || amount() <= 0) {
      showToast('Invalid amount', 'error');
      return;
    }
    if (amount() > userData().lockedBalance) {
      showToast(`Amount exceeds locked balance (${userData().lockedBalance} ETB)`, 'error');
      return;
    }
    setConvertPasswordConfirm({
      open: true,
      onConfirm: async (password: string) => {
        await performConvert(password);
      }
    });
  };

  const performConvert = async (settingsPassword: string) => {
    setConverting(true);
    try {
      await apiFetch('/admin/users/convert-locked', {
        method: 'POST',
        body: JSON.stringify({
          telegramId: userData().telegramId,
          amount: amount(),
          settingsPassword
        }),
      });
      showToast(`Successfully converted ${amount()} ETB to withdrawable balance`, 'success');
      refetch();
      setAmount(0);
    } catch (err: any) {
      showToast(err.message || 'Conversion failed', 'error');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div class="max-w-2xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 class="text-4xl font-black tracking-tight text-white">Convert Locked ETB</h1>
        <p class="text-gray-500 text-sm uppercase tracking-[0.2em] font-bold mt-1">
          Move funds from bonus (non-withdrawable) to withdrawable balance
        </p>
      </div>

      {/* Search User */}
      <div class="glass-dark rounded-2xl p-6 space-y-4">
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Telegram ID (e.g., 123456789)"
            value={telegramId()}
            onInput={(e) => setTelegramId(e.currentTarget.value)}
            class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-cyan-500/50 outline-none"
          />
          <button
            onClick={handleSearch}
            class="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all"
          >
            Search
          </button>
        </div>

        <Show when={userData.loading}>
          <div class="text-center py-8 text-gray-500">Loading user...</div>
        </Show>

        <Show when={userData() && !userData.loading}>
          {(user) => (
            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl">
                <div>
                  <p class="text-[10px] text-gray-500 uppercase">Username</p>
                  <p class="font-medium">@{user().username || 'N/A'}</p>
                </div>
                <div>
                  <p class="text-[10px] text-gray-500 uppercase">Telegram ID</p>
                  <p class="font-mono">{user().telegramId}</p>
                </div>
                <div>
                  <p class="text-[10px] text-gray-500 uppercase">Total Balance (ETBCoins)</p>
                  <p class="text-xl font-bold text-cyan-400">{user().ETBCoins} ETB</p>
                </div>
                <div>
                  <p class="text-[10px] text-gray-500 uppercase">Withdrawable (balanceMain)</p>
                  <p class="text-xl font-bold text-cyan-400">{user().balanceMain} ETB</p>
                </div>
                <div class="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                  <p class="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Locked (non-withdrawable)</p>
                  <p class="text-lg font-bold text-amber-400">{user().lockedBalance || 0} ETB</p>
                </div>
              </div>

              <div class="border-t border-cyan-500/10 pt-6">
                <label class="block text-xs font-bold text-gray-400 mb-2">Amount to Convert</label>
                <div class="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount()}
                    onInput={(e) => setAmount(parseFloat(e.currentTarget.value) || 0)}
                    class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-cyan-500/50 outline-none"
                  />
                  <button
                    onClick={triggerConvert}
                    disabled={converting() || amount() <= 0 || amount() > userData().lockedBalance}
                    class="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all disabled:opacity-50"
                  >
                    {converting() ? 'Processing...' : 'Convert'}
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">
                  Available to convert: {user().lockedBalance} ETB
                </p>
              </div>
            </div>
          )}
        </Show>

        <Show when={!userData() && !userData.loading && searchId()}>
          <div class="text-center py-8 text-rose-500">
            No user found with Telegram ID {searchId()}
          </div>
        </Show>
      </div>

      <PasswordConfirmDialog
        open={convertPasswordConfirm().open}
        title="Confirm Balance Conversion"
        onConfirm={convertPasswordConfirm().onConfirm}
        onCancel={() => setConvertPasswordConfirm({ open: false, onConfirm: async () => {} })}
      />
    </div>
  );
}