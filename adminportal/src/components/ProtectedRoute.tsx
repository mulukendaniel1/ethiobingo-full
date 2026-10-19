// src/components/ProtectedRoute.tsx
import { Navigate } from '@solidjs/router';
import { useAuth } from '../context/auth';
import { Show } from 'solid-js';

export default function ProtectedRoute(props: { children: any }) {
  const { user, loading } = useAuth();

  return (
    <Show 
      when={!loading()} 
      fallback={
        <div class="flex flex-col items-center justify-center h-screen space-y-4">
          <div class="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <p class="text-xs uppercase tracking-widest text-gray-500 font-bold">Checking access…</p>
        </div>
      }
    >
      <Show when={user()} fallback={<Navigate href="/login" />}>
        {props.children}
      </Show>
    </Show>
  );
}