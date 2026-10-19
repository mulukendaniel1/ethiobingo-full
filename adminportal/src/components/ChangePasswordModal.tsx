// src/components/ChangePasswordModal.tsx
import { createSignal, Show } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal(props: Props) {
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (newPassword() !== confirmPassword()) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword().length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: oldPassword(),
          newPassword: newPassword(),
        }),
      });
      showToast('Password changed successfully', 'success');
      props.onClose();
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
        <div class="glass-dark rounded-2xl w-full max-w-md border border-cyan-500/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div class="p-6 border-b border-cyan-500/10">
            <h2 class="text-2xl font-black tracking-tight text-white">Change Password</h2>
            <p class="text-xs text-gray-500 mt-1 uppercase tracking-widest">Update your security</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} class="p-6 space-y-5">
            <div>
              <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                value={oldPassword()}
                onInput={(e) => setOldPassword(e.currentTarget.value)}
                class="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-700 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">New Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={newPassword()}
                onInput={(e) => setNewPassword(e.currentTarget.value)}
                class="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-700 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                required
                minlength="6"
              />
            </div>
            <div>
              <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                class="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-700 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                required
              />
            </div>

            {/* Buttons */}
            <div class="flex gap-3 pt-4">
              <button
                type="button"
                onClick={props.onClose}
                class="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading()}
                class="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
              >
                {loading() ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}