// src/pages/Documentation.tsx
import { createSignal, For } from 'solid-js';

export default function Documentation() {
  const [search, setSearch] = createSignal('');

  const sections = [
    { id: 'overview', title: '1. System Overview' },
    { id: 'architecture', title: '2. Architecture & Components' },
    { id: 'installation', title: '3. Installation & Deployment (VPS)' },
    { id: 'features', title: '4. Key Features & Workflows' },
    { id: 'financial', title: '5. Financial Flows & Balance Logic' },
    { id: 'security', title: '6. Security & Risk Mitigations' },
    { id: 'admin', title: '7. Administration Guide' },
    { id: 'user-guide', title: '8. User Guide (How to Play)' },
    { id: 'ghost-bots', title: '9. Ghost Bot System (Auto Players)' },
    { id: 'troubleshooting', title: '10. Troubleshooting & Maintenance' },
    { id: 'backup', title: '11. Backup & Disaster Recovery' },
    { id: 'appendix', title: '12. Appendix: Environment Variables & Settings' },
  ];

  const filteredSections = () => {
    if (!search()) return sections;
    const term = search().toLowerCase();
    return sections.filter(s => s.title.toLowerCase().includes(term));
  };

  return (
    <div class="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-500/10 pb-6">
        <div>
          <h1 class="text-3xl font-black text-white italic uppercase tracking-tighter">Documentation</h1>
          <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Complete System Reference</p>
        </div>
        <div class="relative">
          <input
            type="text"
            placeholder="Search sections..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class="w-full lg:w-80 px-4 py-2 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50 outline-none transition-all"
          />
          <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Table of contents (sticky) */}
        <aside class="lg:sticky lg:top-24 h-fit space-y-2 glass-dark rounded-2xl p-4 border border-cyan-500/10">
          <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Jump to Section</h3>
          <div class="max-h-[70vh] overflow-y-auto custom-scrollbar">
            <For each={filteredSections()}>
              {(section) => (
                <a
                  href={`#${section.id}`}
                  class="block px-3 py-2 text-xs text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-all"
                >
                  {section.title}
                </a>
              )}
            </For>
          </div>
        </aside>

        {/* Main content with custom scrollbar */}
        <div class="lg:col-span-3 space-y-12 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar pr-4">
          
          {/* 1. System Overview */}
          <div id="overview" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              1. System Overview
            </h2>
            <div class="prose prose-invert max-w-none text-gray-300 space-y-4">
              <p>The platform is a <strong>multi‑component Telegram‑based Bingo game</strong> with real‑time gameplay, ETB deposits/withdrawals, and an admin web panel. It is designed for Ethiopian users, supporting 5 languages (Amharic, English, Tigrinya, Oromo, Somali). <strong>ETHIO Bingo</strong> introduces a fully integrated in‑app wallet with deposit/withdraw flows directly in the game UI, alongside the Telegram bot.</p>
              <h3 class="text-white font-bold mt-6">Core Capabilities</h3>
              <ul class="list-disc pl-5 space-y-1">
                <li><strong>Provably fair Bingo game</strong> – 75 balls, 5×5 cards, multiple winning patterns. Players can now purchase <strong>up to two cards</strong> per round.</li>
                <li><strong>ETB (Ethiopian Birr) virtual currency</strong> – Deposit via Telebirr or CBE Birr, withdraw to phone number, play with ETB coins.</li>
                <li><strong>In‑app Wallet & Transactions</strong> – Users can deposit and withdraw directly from the game interface without leaving the game.</li>
                <li><strong>Admin dashboard</strong> – User management, balance adjustments, broadcast, settings, audit logs, backup.</li>
                <li><strong>Automated backup</strong> – Daily cron to Google Drive (with local fallback).</li>
                <li><strong>Referral & agent system</strong> – Commission on deposits, first‑deposit bonuses.</li>
                <li><strong>24/7 Telegram bot</strong> – Handles deposits, withdrawals, game links, notifications.</li>
              </ul>
            </div>
          </div>

          {/* 2. Architecture & Components */}
          <div id="architecture" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              2. Architecture & Components
            </h2>
            <div class="prose prose-invert max-w-none text-gray-300 space-y-4">
              <h3 class="text-white font-bold">2.1 Projects</h3>
              <table class="w-full text-sm border-collapse">
                <thead><tr class="border-b border-white/10"><th class="text-left py-2">Project</th><th class="text-left py-2">Tech Stack</th><th class="text-left py-2">Purpose</th></tr></thead>
                <tbody>
                  <tr class="border-b border-white/5"><td class="py-2">Bot Backend</td><td class="py-2">Node.js, Express, TypeScript, MongoDB, Redis, Grammy</td><td class="py-2">Telegram bot, wallet API, admin API, deposit/withdraw logic, notifications.</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Game Engine</td><td class="py-2">Bun, Elysia, TypeScript, MongoDB, Redis, WebSocket</td><td class="py-2">Game loop, round management, provably fair balls, WebSocket server.</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Admin Portal</td><td class="py-2">SolidJS, Vite, Tailwind, Chart.js</td><td class="py-2">Web dashboard for admins to manage users, deposits, withdrawals, broadcast, settings.</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Bingo Frontend</td><td class="py-2">SolidJS, Tailwind, Howler</td><td class="py-2">Actual game UI (cards, ball board, marking) – embedded as Web App in Telegram. <strong>Now includes full in‑app deposit/withdraw UI.</strong></td></tr>
                </tbody>
              </table>
              <h3 class="text-white font-bold mt-6">2.2 Shared Infrastructure</h3>
              <ul class="list-disc pl-5">
                <li>MongoDB Atlas – Primary database</li>
                <li>Redis – Session store, real‑time game state, WebSocket pub/sub, locks</li>
                <li>Google Drive – Backup storage (via Apps Script proxy)</li>
                <li>Telegram Bot API – Bot messaging, inline keyboards, Web App integration</li>
              </ul>
            </div>
          </div>

          {/* 3. Installation & Deployment (VPS) */}
          <div id="installation" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              3. Installation & Deployment (VPS)
            </h2>
            <div class="prose prose-invert max-w-none text-gray-300">
              <p>Refer to the full documentation for environment variables and commands. Key steps: clone repos, set .env, install dependencies, build, and run with PM2.</p>
              <pre class="bg-black/50 p-4 rounded-xl overflow-x-auto text-xs whitespace-pre-wrap"><code># Bot backend
cd botbackend
bun install
bun run build
pm2 start dist/index.js --name bot-backend

# Game engine
cd bingogame
bun install
pm2 start "bun run start" --name game-engine

# Admin portal & Bingo frontend – build and serve with Nginx
cd adminportal
bun install
bun run build
# serve dist/ folder via Nginx (example configuration below)

# Nginx configuration (optional)
server {'{'}
    listen 80;
    server_name admin.yourdomain.com;
    location / {'{'}
        root /path/to/adminportal/dist;
        try_files $uri $uri/ /index.html;
    {'}'}
{'}'}
</code></pre>
              <p class="mt-4">Ensure all environment variables are set (see Appendix). Use a reverse proxy (Nginx) with SSL for production.</p>
            </div>
          </div>

          {/* 4. Key Features & Workflows */}
          <div id="features" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              4. Key Features & Workflows
            </h2>
            <div class="space-y-6">
              <div><h3 class="text-white font-bold">4.1 User Onboarding</h3><p class="text-gray-300">/start → phone number → join channel → main menu</p></div>
              <div><h3 class="text-white font-bold">4.2 Playing the Game</h3><p class="text-gray-300">/play opens Web App → selection phase (choose <strong>up to 2 cards</strong>, 10 ETB each) → game phase (balls drawn, mark numbers) → Bingo! → prize distributed.</p></div>
              <div><h3 class="text-white font-bold">4.3 Deposit</h3><p class="text-gray-300">Can be done either through the <strong>in‑app Wallet popup</strong> (select Telebirr or CBE Birr, enter amount, paste SMS receipt) or via the Telegram bot. After admin confirmation, balance is credited.</p></div>
              <div><h3 class="text-white font-bold">4.4 Withdrawal</h3><p class="text-gray-300">Method → amount → destination → deducts instantly → admin processes → user receives money. Available in both the app and the bot.</p></div>
              <div><h3 class="text-white font-bold">4.5 Admin Controls</h3><p class="text-gray-300">Dashboard, Users, Deposits/Withdrawals, Broadcast, Settings, Audit Logs, Backup.</p></div>
              <div><h3 class="text-white font-bold">4.6 Game Pause / Resume</h3><p class="text-gray-300">Admin toggle → prevents actions → shows overlay → notifies users → resumes instantly.</p></div>
            </div>
          </div>

          {/* 5. Financial Flows & Balance Logic */}
          <div id="financial" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              5. Financial Flows & Balance Logic
            </h2>
            <div class="prose prose-invert max-w-none">
              <p><strong>Invariant:</strong> <code class="bg-black/50 px-1 rounded">ETBCoins = balanceMain + lockedBalance</code></p>
              <ul class="list-disc pl-5">
                <li>Deposit confirmed → ETBCoins↑, lockedBalance↑</li>
                <li>Card purchase → deduct lockedBalance first, then balanceMain; lockedETB↑</li>
                <li>Sell card → refund to lockedBalance; lockedETB↓</li>
                <li>Win → add to ETBCoins and balanceMain; lockedETB↓</li>
                <li>Admin adjust balance → affects both ETBCoins and balanceMain</li>
                <li>Convert locked balance → moves from lockedBalance to balanceMain</li>
                <li><strong>Ghost bots</strong> – House injects 10 ETB per bot card (no user deduction). Bot wins are ignored financially.</li>
              </ul>
            </div>
          </div>

          {/* 6. Security & Risk Mitigations */}
          <div id="security" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              6. Security & Risk Mitigations
            </h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="border-b border-white/10"><th class="text-left py-2">Risk</th><th class="text-left py-2">Mitigation</th></tr></thead>
                <tbody>
                  <tr class="border-b border-white/5"><td class="py-2">Double spend / race conditions</td><td class="py-2">Redis atomic operations, MongoDB $inc with $gte</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">False Bingo claim</td><td class="py-2">Pattern validation; ban for round</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Receipt replay attack</td><td class="py-2">Transaction ID uniqueness check</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Unauthorized admin access</td><td class="py-2">JWT + sessionId, settings password</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">NoSQL injection</td><td class="py-2">All inputs sanitized</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Man‑in‑middle on internal APIs</td><td class="py-2">HMAC signature verification</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Bot abuse / spam</td><td class="py-2">Bots are limited to one per round, never persist, and cannot affect real balances.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 7. Administration Guide */}
          <div id="admin" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              7. Administration Guide
            </h2>
            <div class="space-y-4">
              <p><strong>Access:</strong> <code class="bg-black/50 px-1 rounded">https://admin.yourdomain.com</code> – login with admin email/password. Sensitive actions require settings password.</p>
              <p><strong>Processing Deposits:</strong> Pending deposits → verify transaction ID and receipt → Confirm (adds funds) or Reject.</p>
              <p><strong>Processing Withdrawals:</strong> Pending withdrawals → verify destination → transfer manually → Process (mark done) or Reject (refunds).</p>
              <p><strong>Broadcast:</strong> Compose message (Markdown), select target (all/active/balance/recent), choose channels (bot/channel). Templates can be saved.</p>
              <p><strong>Settings:</strong> Toggle features (ETB coin, deposit, withdraw, game pause), configure referral/agent bonuses, bank details, backup.</p>
              <p><strong>Audit Logs:</strong> View all actions, filter by severity/source/date. Critical events send Telegram alerts.</p>
              <p><strong>Backup:</strong> Automatic daily at 2 AM UTC, manual trigger, stored in Google Drive + local fallback.</p>
              <p><strong>Bot Activity:</strong> Ghost bots are automatically managed. There is no admin interface for bots; they are fully transparent to real players.</p>
            </div>
          </div>

          {/* 8. User Guide (How to Play) */}
          <div id="user-guide" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              8. User Guide (How to Play)
            </h2>
            <div class="space-y-4">
              <p><strong>Getting Started:</strong> Send /start to the bot, share phone number, join channel if required.</p>
              <p><strong>Depositing:</strong> Use the Wallet icon in the game, choose Telebirr or CBE Birr, copy the displayed phone number, send money, then paste the SMS receipt. Alternatively, use the bot's Deposit menu. Min 50 ETB for Telebirr, 20 ETB for CBE Birr.</p>
              <p><strong>Playing:</strong> Play Games → selection phase: buy <strong>up to two cards</strong> (10 ETB each) → game phase: mark numbers → click BINGO! when you complete a pattern → win prize.</p>
              <p><strong>Withdrawing:</strong> Open Wallet → Withdraw → choose method → amount (min 50) → destination → amount deducted instantly → admin processes.</p>
              <p><strong>What NOT to do:</strong> Don't click BINGO without a valid pattern, don't reuse receipts, don't send money to other accounts, don't share your session token.</p>
              <p><strong>Ghost Players:</strong> You may see usernames like “Chala” or “Sara” in the game. These are house‑controlled bots that make the game more active. They play fairly and do not affect your winnings.</p>
            </div>
          </div>

          {/* 9. Ghost Bot System (Auto Players) */}
          <div id="ghost-bots" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              9. Ghost Bot System (Auto Players)
            </h2>
            <div class="prose prose-invert max-w-none text-gray-300 space-y-4">
              <p>The platform includes <strong>simulated ghost players</strong> that join every round, buy cards, mark numbers, and claim Bingo – all without touching the real user database or causing financial leakage.</p>

              <h3 class="text-white font-bold">9.1 How It Works</h3>
              <ul class="list-disc pl-5">
                <li>At the start of each round, the game engine randomly decides to spawn <strong>5–13 ghost bots</strong>.</li>
                <li>Each bot is given a unique ID (<code>bot_&lt;timestamp&gt;_&lt;index&gt;</code>) and a random Ethiopian name.</li>
                <li>Bots join the selection phase after a random delay, pick a random available card, and pay 10 ETB – but the money comes from the <strong>House</strong> (no real transaction).</li>
                <li>During the game, bots evaluate each drawn ball; if their card completes a Bingo pattern, they claim after a human‑like delay.</li>
                <li>If a bot wins, the prize pool is distributed, but <strong>no real money is transferred</strong> – the house simply retains the amount. Real winners receive their share normally.</li>
                <li>Bot names appear in the winner popup, making the game look lively and credible.</li>
              </ul>

              <h3 class="text-white font-bold">9.2 Financial Safety</h3>
              <ul class="list-disc pl-5">
                <li>Bots never call the wallet API – they bypass <code>walletClient.buyCard</code> and <code>walletClient.win</code>.</li>
                <li>The prize pool is inflated by the house (engine adds 10 ETB per bot card). When a bot wins, the money is not deducted from any real user's balance.</li>
                <li>No bot data is stored in MongoDB – they exist only in the engine's memory for the round.</li>
                <li>Audit logs are not polluted by bot actions.</li>
              </ul>

              <h3 class="text-white font-bold">9.3 Impact on Real Players</h3>
              <ul class="list-disc pl-5">
                <li><strong>Prize pool grows faster</strong> – more attractive payouts.</li>
                <li><strong>Cards sell out quicker</strong> – creates urgency and “fear of missing out”.</li>
                <li><strong>More frequent Bingo claims</strong> – keeps the game dynamic.</li>
                <li>Real players still win against bots – the house edge remains unchanged.</li>
              </ul>

              <h3 class="text-white font-bold">9.4 Configuration</h3>
              <p>No external configuration is required. The bot logic is hard‑coded in <code>apps/bingo-game-engine/src/engine/RoundManager.ts</code>. To disable bots temporarily, set the number of bots to <code>0</code> in the code (change <code>Math.floor(Math.random() * 9) + 5</code> to <code>0</code>).</p>
            </div>
          </div>

          {/* 10. Troubleshooting & Maintenance */}
          <div id="troubleshooting" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              10. Troubleshooting & Maintenance
            </h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="border-b border-white/10"><th class="text-left py-2">Symptom</th><th class="text-left py-2">Likely Cause</th><th class="text-left py-2">Resolution</th></tr></thead>
                <tbody>
                  <tr class="border-b border-white/5"><td class="py-2">Game does not load</td><td class="py-2">WebSocket connection failed</td><td class="py-2">Check game engine logs, ensure ENGINE_URL correct, restart engine</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Deposit receipt parsing fails</td><td class="py-2">SMS format changed</td><td class="py-2">Update regex in ETBDepositService.ts</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Bot not responding</td><td class="py-2">Bot paused or token expired</td><td class="py-2">Check bot status in admin panel, restart bot</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Backup fails to upload to Drive</td><td class="py-2">Service account key missing or folder ID wrong</td><td class="py-2">Re‑upload JSON key, verify folder ID, enable Drive API</td></tr>
                  <tr class="border-b border-white/5"><td class="py-2">Too many bots / game feels crowded</td><td class="py-2">Default 5–13 bots per round</td><td class="py-2">Adjust the range in RoundManager.ts (line ~300). Set to 0 to disable.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 11. Backup & Disaster Recovery */}
          <div id="backup" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              11. Backup & Disaster Recovery
            </h2>
            <div class="space-y-4">
              <p><strong>Backup Schedule:</strong> Daily at 2 AM UTC (configurable). Manual backup available.</p>
              <p><strong>Restore Procedure:</strong> Download backup → <code class="bg-black/50 px-1 rounded">mongorestore --archive=backup-xxx.gz --gzip</code> → restart services.</p>
              <p><strong>Recovery from complete server failure:</strong> VPS with persistent storage + MongoDB Atlas (cloud) + GitHub source code.</p>
            </div>
          </div>

          {/* 12. Appendix: Environment Variables & Settings */}
          <div id="appendix" class="scroll-mt-24">
            <h2 class="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-6 bg-cyan-500 rounded-full"></span>
              12. Appendix: Environment Variables & Settings
            </h2>
            <div class="space-y-6">
              <div><h3 class="text-white font-bold">Bot Backend .env</h3>
                <pre class="bg-black/50 p-4 rounded-xl overflow-x-auto text-xs whitespace-pre-wrap"><code># Core
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
REDIS_URL=redis://:password@localhost:6379

# Security
JWT_SECRET=your-secret
ENCRYPTION_KEY=32-byte-key
INTERNAL_API_SECRET=shared-secret

# Telegram
BOT_TOKEN=your-bot-token
BOT_USERNAME=YourBotUsername
SUPPORT_USERNAME=@SupportUsername
CHANNEL_USERNAME=@ChannelUsername
ADMIN_IDS=123456789,987654321

# URLs
FRONTEND_URL=https://game.yourdomain.com
ENGINE_URL=https://engine.yourdomain.com
ADMIN_URL=https://admin.yourdomain.com

# Operator
OPERATOR_ID=ethio_bingoobot
BROKER_BOT_INTERNAL_URL=http://localhost:3000
BROKER_INTERNAL_SECRET=shared-secret

# ETB
ETB_COIN_ENABLED=true
SETTINGS_ACCESS_PASSWORD=settings123
</code></pre>
              </div>
              <div><h3 class="text-white font-bold">Game Engine .env</h3>
                <pre class="bg-black/50 p-4 rounded-xl overflow-x-auto text-xs whitespace-pre-wrap"><code>PORT=4000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
REDIS_URL=redis://:password@localhost:6379
JWT_SECRET=your-secret
FRONTEND_URL=https://game.yourdomain.com
BROKER_BOT_INTERNAL_URL=http://backend:3000
OPERATOR_ID=ethio_bingoobot
BROKER_INTERNAL_SECRET=shared-secret
HOUSE_EDGE_PERCENT=10
BALL_DRAW_INTERVAL_MS=1000
</code></pre>
              </div>
              <div><h3 class="text-white font-bold">System Settings (database)</h3>
                <p>All settings are stored in <code>SystemSettings</code> collection and can be modified via admin panel. Key toggles: <code>etb_coin_enabled</code>, <code>deposit_enabled</code>, <code>withdraw_enabled</code>, <code>game_paused</code>, <code>backup_enabled</code>, etc.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}