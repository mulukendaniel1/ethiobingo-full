// apps/bingo-frontend/src/components/SettingsView.tsx
import { createSignal, Show, For } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { showToast } from './Toast';

interface SettingsViewProps {
  currentLang: string;
  token: string;
  muted: boolean;
  onToggleSound: () => void;
  onLanguageChange: (lang: string) => void;
  t: (key: string) => string;
}

const languages = [
  { code: 'en', label: 'English',      flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ',         flag: '🇪🇹' },
  { code: 'ti', label: 'ትግርኛ',         flag: '🇪🇹' },
  { code: 'om', label: 'Afaan Oromoo', flag: '🇪🇹' },
  { code: 'so', label: 'Soomaali',     flag: '🇪🇹' },
];

export default function SettingsView(props: SettingsViewProps) {
  const [isDark, setIsDark] = createSignal(
    document.documentElement.classList.contains('dark')
  );
  const [updatingLang, setUpdatingLang] = createSignal(false);
  const [expandedRule, setExpandedRule] = createSignal<string | null>(null);

  const toggleDarkMode = () => {
    const root = document.documentElement;
    const nextDark = !isDark();
    root.classList.toggle('dark', nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    setIsDark(nextDark);
  };

  const updateLanguage = async (lang: string) => {
    if (props.currentLang === lang) return;
    setUpdatingLang(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/user/language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: props.token, language: lang }),
      });
      if (res.ok) {
        props.onLanguageChange(lang);
        showToast(props.t('settings.updated'), 'success');
      } else {
        showToast('Failed to update language', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setUpdatingLang(false);
    }
  };

  // ── Shared section label ─────────────────────────────────────────────────
  const SectionLabel = (p: { children: any }) => (
    <div class="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-1">
      {p.children}
    </div>
  );

  // ── Shared toggle switch ─────────────────────────────────────────────────
const Toggle = (p: { on: boolean; onClick: () => void }) => (
  <button
    onClick={p.onClick}
    class={twMerge(
      "relative h-7 w-12 rounded-full transition-all duration-300 flex-shrink-0",
      p.on
        ? "bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
        : "bg-white/10 shadow-inner"
    )}
  >
    <span
      class={twMerge(
        "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300",
        p.on ? "left-[calc(100%-1.5rem)]" : "left-1"
      )}
    />
  </button>
);

  return (
    <div class="h-full overflow-y-auto custom-scrollbar px-4 pt-5 pb-24 max-w-sm mx-auto">

      {/* ── Page title ── */}
      <div class="mb-6">
        <h1 class="text-xl font-black text-white uppercase tracking-wider">{props.t('settings.title')}</h1>
        <p class="text-[11px] text-gray-500 mt-0.5">Customise your experience</p>
      </div>

      {/* ── PREFERENCES section ── */}
      <SectionLabel>Preferences</SectionLabel>
      <div class="rounded-2xl overflow-hidden mb-5"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Sound row */}
        <div class="flex items-center justify-between px-4 py-3.5"
          style={{ 'border-bottom': '1px solid rgba(255,255,255,0.05)' }}>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: props.muted ? 'rgba(244,63,94,0.1)' : 'rgba(34,211,238,0.1)',
                border: props.muted ? '1px solid rgba(244,63,94,0.2)' : '1px solid rgba(34,211,238,0.2)',
              }}>
              <Show when={!props.muted} fallback={
                <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              }>
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </Show>
            </div>
            <div>
              <div class="text-sm font-bold text-white">{props.t('settings.sound')}</div>
              <div class="text-[10px] text-gray-600">
                {props.muted ? props.t('settings.muted') : props.t('settings.enabled')}
              </div>
            </div>
          </div>
          <Toggle on={!props.muted} onClick={props.onToggleSound} />
        </div>

        {/* Dark mode row */}
        <div class="flex items-center justify-between px-4 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: isDark() ? 'rgba(34,211,238,0.1)' : 'rgba(251,146,60,0.1)',
                border: isDark() ? '1px solid rgba(34,211,238,0.2)' : '1px solid rgba(251,146,60,0.2)',
              }}>
              <Show when={isDark()} fallback={
                <svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <circle cx="12" cy="12" r="5" />
                  <path stroke-linecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              }>
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              </Show>
            </div>
            <div>
              <div class="text-sm font-bold text-white">{props.t('settings.night_mode')}</div>
              <div class="text-[10px] text-gray-600">{isDark() ? 'Dark' : 'Light'}</div>
            </div>
          </div>
          <Toggle on={isDark()} onClick={toggleDarkMode} />
        </div>
      </div>

      {/* ── LANGUAGE section ── */}
      <SectionLabel>{props.t('settings.language')}</SectionLabel>
      <div class="rounded-2xl overflow-hidden mb-5"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <For each={languages}>
          {(lang, i) => (
            <button
              onClick={() => updateLanguage(lang.code)}
              disabled={updatingLang()}
              class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.99] disabled:opacity-50"
              style={{
                'border-bottom': i() < languages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: props.currentLang === lang.code ? 'rgba(34,211,238,0.08)' : 'transparent',
              }}
            >
              <span class="text-xl w-7 text-center flex-shrink-0">{lang.flag}</span>
              <span class={twMerge(
                'flex-1 text-sm font-bold transition-colors',
                props.currentLang === lang.code ? 'text-indigo-300' : 'text-gray-400'
              )}>
                {lang.label}
              </span>
              {/* Active check */}
              <Show when={props.currentLang === lang.code}>
                <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(34,211,238,0.2)', border: '1px solid rgba(34,211,238,0.4)' }}>
                  <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </Show>
              {/* Spinner while updating */}
              <Show when={updatingLang() && props.currentLang !== lang.code}>
                <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* ── GAME RULES section ── */}
      <SectionLabel>Information</SectionLabel>
      <div class="rounded-2xl overflow-hidden mb-6"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Section header row */}
        <div class="flex items-center gap-3 px-4 py-3.5"
          style={{ 'border-bottom': '1px solid rgba(255,255,255,0.05)' }}>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
            <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <span class="text-sm font-black text-white">{props.t('settings.rules_title')}</span>
        </div>

        <RuleAccordion id="selection" title={props.t('rules.card_selection')}    desc={props.t('rules.card_selection_desc')} active={expandedRule()} onToggle={setExpandedRule} last={false} />
        <RuleAccordion id="gameplay"  title={props.t('rules.gameplay')}           desc={props.t('rules.gameplay_desc')}        active={expandedRule()} onToggle={setExpandedRule} last={false} />
        <RuleAccordion id="winning"   title={props.t('rules.win_conditions')}     desc={props.t('rules.win_conditions_desc')}  active={expandedRule()} onToggle={setExpandedRule} last={false} />
        <RuleAccordion id="claiming"  title={props.t('rules.claiming')}           desc={props.t('rules.claiming_desc')}        active={expandedRule()} onToggle={setExpandedRule} last={false} />
        <RuleAccordion id="penalty"   title={props.t('rules.penalty')}            desc={props.t('rules.penalty_desc')}         active={expandedRule()} onToggle={setExpandedRule} last={true}  />
      </div>

      {/* ── Footer ── */}
      <div class="text-center pb-4">
        <p class="text-[9px] font-bold text-gray-700 uppercase tracking-widest">Ethio Bingo · v1.0.1</p>
      </div>
    </div>
  );
}

// ── Rule accordion row ────────────────────────────────────────────────────────
function RuleAccordion(props: {
  id: string;
  title: string;
  desc: string;
  active: string | null;
  onToggle: (id: string | null) => void;
  last: boolean;
}) {
  const isOpen = () => props.active === props.id;

  return (
    <div
      style={{
        'border-bottom': props.last ? 'none' : '1px solid rgba(255,255,255,0.05)',
        background: isOpen() ? 'rgba(34,211,238,0.05)' : 'transparent',
        transition: 'background 0.2s ease',
      }}
    >
      <button
        onClick={() => props.onToggle(isOpen() ? null : props.id)}
        class="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span class={twMerge(
          'text-[11px] font-bold transition-colors',
          isOpen() ? 'text-indigo-300' : 'text-gray-500'
        )}>
          {props.title}
        </span>
        <svg
          class="w-3.5 h-3.5 text-gray-600 flex-shrink-0 transition-transform duration-250"
          style={{ transform: isOpen() ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div style={{
        'max-height': isOpen() ? '200px' : '0px',
        opacity: isOpen() ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s ease, opacity 0.25s ease',
      }}>
        <p class="px-4 pb-4 text-[11px] leading-relaxed text-gray-500">{props.desc}</p>
      </div>
    </div>
  );
}