// src/components/Icon.tsx
import { Show } from 'solid-js';

interface IconProps {
  name: 'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'broadcast' | 'settings' | 'audit' | 'docs' | 'unclaimed' | 'winners' | 'ledger' | 'phone-abuse' | 'shamo' | 'cleanup';
  class?: string;
}

export default function Icon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      class={props.class || 'w-5 h-5'}
    >
      {/* Dashboard */}
      <Show when={props.name === 'dashboard'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
      </Show>

      {/* Users */}
      <Show when={props.name === 'users'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </Show>

      {/* Deposits */}
      <Show when={props.name === 'deposits'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </Show>
      
      <Show when={props.name === 'unclaimed'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </Show>

      {/* Withdrawals */}
      <Show when={props.name === 'withdrawals'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11.25l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </Show>

      <Show when={props.name === 'winners'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.5 7.5 0 10-10.014 0m9.768-2.25c.843-.523 1.492-1.226 1.492-2.25 0-1.024-.649-1.727-1.492-2.25m-9.768 4.5a7.5 7.5 0 01-1.492-2.25m9.768 0c-.843.523-1.492 1.226-1.492 2.25 0 1.024.649 1.727 1.492 2.25m-9.768 0c.843-.523 1.492-1.226 1.492-2.25 0-1.024-.649-1.727-1.492-2.25" />
      </Show>

      {/* Broadcast */}
      <Show when={props.name === 'broadcast'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </Show>

      {/* Settings */}
      <Show when={props.name === 'settings'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-7.5 0V3.375m0 17.25V21M8.25 8.25l-1.5-1.5M17.25 17.25l-1.5-1.5M17.25 8.25l-1.5 1.5M8.25 17.25l-1.5 1.5" />
      </Show>

      {/* Audit */}
      <Show when={props.name === 'audit'}>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </Show>
      {/* docs */}
      <Show when={props.name === 'docs'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </Show>

      <Show when={props.name === 'ledger'}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h16v16H4V4zm2 4h12M6 12h12M6 16h8" />
      </Show>
      {/* Phone abuse – phone with slash */}
<Show when={props.name === 'phone-abuse'}>
  <path stroke-linecap="round" stroke-linejoin="round"
    d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 7.5h3" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
</Show>
<Show when={props.name === 'shamo'}>
  <path stroke-linecap="round" stroke-linejoin="round"
    d="M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8m16 0H4m16 0l-1.5-4.5A1.5 1.5 0 0017 6H7a1.5 1.5 0 00-1.5 1.5L4 12m8-6v15m0-15c-2-3-4-3-4-1s2 2 4 1c2 1 4 1 4-1s-2-2-4 1z" />
</Show>
<Show when={props.name === 'cleanup'}>
  <path stroke-linecap="round" stroke-linejoin="round"
    d="M19 4l-6 6m0 0l-2.5 2.5M13 10l-2.5 2.5m0 0L6 17l-2 3 3-2 4.5-4.5m0 0L14 11" />
  <circle cx="19" cy="4" r="1.2" fill="currentColor" />
</Show>
    </svg>
  );
}