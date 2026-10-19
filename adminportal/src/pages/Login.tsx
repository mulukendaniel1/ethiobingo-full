// src/pages/Login.tsx
import { createSignal, Show } from 'solid-js';
import { useAuth } from '../context/auth';
import { showToast } from '../components/Toast';

export default function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const { login } = useAuth();

  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    // Prevent double‑click / rapid re‑submission
    if (loading() || cooldownTimer) return;

    setLoading(true);
    try {
      await login(email(), password());
      window.location.replace('/');
    } catch (err: any) {
      showToast(err.message || 'Access Denied', 'error');
    } finally {
      setLoading(false);
      // Short cooldown before allowing another attempt
      cooldownTimer = setTimeout(() => {
        cooldownTimer = null;
      }, 1500);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-[#030303] relative overflow-hidden p-4">
      {/* Green ambient glow */}
      <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-green-400/5 rounded-full blur-[120px] pointer-events-none" />

      <div class="w-full max-w-md z-10 animate-bounce-in">
        {/* Logo / Branding */}
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-cyan-400 to-green-600 shadow-xl shadow-cyan-500/20 mb-6">
            <svg class="w-10 h-10 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 class="text-4xl font-black text-white tracking-tight uppercase">Admin<span class="text-cyan-400">Gateway</span></h1>
          <p class="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">Secure Access</p>
        </div>

        {/* Glass card */}
        <div class="glass-dark rounded-[2.5rem] p-10">
          <form onSubmit={handleSubmit} class="space-y-6">
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
              <input
                type="email"
                placeholder="admin@example.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                class="w-full"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                class="w-full"
              />
            </div>
            <button
              type="submit"
              disabled={loading() || !!cooldownTimer}
              class="w-full btn-green flex items-center justify-center gap-2"
            >
              {loading() ? (
                <>
                  <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div class="mt-8 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            <span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Secure Connection</span>
          </div>
          <span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">v3.0.0</span>
        </div>
      </div>
    </div>
  );
}