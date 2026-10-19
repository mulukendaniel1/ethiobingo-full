// src/pages/Broadcast.tsx
import { createSignal, Show, onMount, For } from 'solid-js';
import { apiFetch } from '../api/client';
import { showToast } from '../components/Toast';

interface BroadcastStats {
  totalUsers: number;
  sentCount: number;
  failedCount: number;
  successRate: number;
  deliveryTime: number;
}

export default function Broadcast() {
  const [activeTab, setActiveTab] = createSignal<'send' | 'templates'>('send');
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [type, setType] = createSignal<'announcement' | 'promotion' | 'update' | 'alert' | 'educational'>('announcement');
  const [target, setTarget] = createSignal<'all' | 'active' | 'balance' | 'recent'>('all');
  const [channels, setChannels] = createSignal<('bot' | 'channel')[]>(['bot']);
  const [loading, setLoading] = createSignal(false);
  const [sendResult, setSendResult] = createSignal<BroadcastStats | null>(null);
  const [templates, setTemplates] = createSignal<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = createSignal(false);
  const [imageFile, setImageFile] = createSignal<File | null>(null);
  const [imagePreview, setImagePreview] = createSignal<string>('');

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await apiFetch<any[]>('/admin/broadcast/templates');
      setTemplates(data);
    } catch (err) {
      showToast('Failed to load templates', 'error');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSend = async () => {
    if (!title() || !content()) {
      showToast('Title and content required', 'error');
      return;
    }
    setLoading(true);
    try {
      let imageBase64 = '';
      if (imageFile()) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile()!);
        });
      }

      const payload: any = {
        title: title(),
        content: content(),
        type: type(),
        target: target(),
        channels: channels(),
      };
      if (imageBase64) payload.imageBase64 = imageBase64;

      const result = await apiFetch<BroadcastStats>('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSendResult(result);
      showToast('Broadcast sent successfully', 'success');
      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreview('');
    } catch (err) {
      showToast('Failed to send broadcast', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!title() || !content()) {
      showToast('Title and content required', 'error');
      return;
    }
    const name = prompt('Template name (e.g., "Weekly Update")');
    if (!name) return;
    try {
      await apiFetch('/admin/broadcast/templates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          title: title(),
          content: content(),
          type: type(),
          target: target(),
          channels: channels(),
        }),
      });
      showToast('Template saved', 'success');
      loadTemplates();
    } catch (err) {
      showToast('Failed to save template', 'error');
    }
  };

  const handleUseTemplate = (tpl: any) => {
    setTitle(tpl.title);
    setContent(tpl.content);
    setType(tpl.type);
    setTarget(tpl.target);
    setChannels(tpl.channels);
    setActiveTab('send');
    setImageFile(null);
    setImagePreview('');
    showToast(`Template "${tpl.name}" loaded`, 'info');
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await apiFetch(`/admin/broadcast/templates/${id}`, { method: 'DELETE' });
      showToast('Template deleted', 'success');
      loadTemplates();
    } catch (err) {
      showToast('Failed to delete template', 'error');
    }
  };

  onMount(loadTemplates);

  return (
    <div class="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header class="flex justify-between items-center border-b border-cyan-500/10 pb-6">
        <div>
          <h1 class="text-3xl font-black text-white italic uppercase tracking-tighter">Broadcast</h1>
          <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Send messages to users</p>
        </div>

        <div class="flex bg-[#0a0a0a] p-1 rounded-2xl border border-cyan-500/10">
          <button
            onClick={() => setActiveTab('send')}
            class={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab() === 'send' ? 'bg-cyan-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
          >
            Send
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            class={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab() === 'templates' ? 'bg-cyan-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
          >
            Templates
          </button>
        </div>
      </header>

      <Show when={activeTab() === 'send'}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2 space-y-6">
            <div class="glass-dark rounded-2xl p-8 space-y-6 shadow-2xl">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Title</label>
                <input
                  type="text"
                  placeholder="Enter broadcast title..."
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  class="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 text-white placeholder:text-gray-800 focus:border-cyan-500/50 outline-none transition-all"
                />
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Message (Markdown supported)</label>
                <textarea
                  rows={10}
                  placeholder="Write your message here..."
                  value={content()}
                  onInput={(e) => setContent(e.currentTarget.value)}
                  class="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 text-white placeholder:text-gray-800 focus:border-cyan-500/50 outline-none transition-all resize-none font-mono text-sm"
                />
              </div>

              {/* Photo Attachment */}
              <div class="space-y-2">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Attach Image (optional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) {
                      setImageFile(file);
                      const url = URL.createObjectURL(file);
                      setImagePreview(url);
                    }
                  }}
                  class="w-full px-4 py-3 rounded-2xl bg-black border border-white/5 text-white text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-cyan-500 file:text-black hover:file:bg-cyan-400"
                />
                <Show when={imagePreview()}>
                  <div class="relative inline-block mt-2">
                    <img src={imagePreview()} alt="Preview" class="max-h-32 rounded-xl border border-white/10" />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(''); }}
                      class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center hover:bg-rose-600"
                    >✕</button>
                  </div>
                </Show>
                <p class="text-[9px] text-gray-500 ml-1">Image will be sent as a photo (with caption) to users and channel.</p>
              </div>

              <div class="flex gap-4 pt-4">
                <button
                  onClick={handleSend}
                  disabled={loading()}
                  class="flex-1 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading() ? 'Sending...' : 'Send Broadcast'}
                </button>
                <button
                  onClick={handleSaveTemplate}
                  class="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Save as Template
                </button>
              </div>
            </div>

            <Show when={sendResult()}>
              <div class="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
                <div class="text-center">
                  <p class="text-[10px] text-cyan-500/60 font-black uppercase">Sent</p>
                  <p class="text-2xl font-black text-cyan-400">{sendResult()!.sentCount}</p>
                </div>
                <div class="text-center border-x border-cyan-500/10">
                  <p class="text-[10px] text-cyan-500/60 font-black uppercase">Failed</p>
                  <p class="text-2xl font-black text-rose-500">{sendResult()!.failedCount}</p>
                </div>
                <div class="text-center border-r border-cyan-500/10">
                  <p class="text-[10px] text-cyan-500/60 font-black uppercase">Target</p>
                  <p class="text-2xl font-black text-white">{sendResult()!.totalUsers}</p>
                </div>
                <div class="text-center">
                  <p class="text-[10px] text-cyan-500/60 font-black uppercase">Time</p>
                  <p class="text-2xl font-black text-white">{sendResult()!.deliveryTime}s</p>
                </div>
              </div>
            </Show>
          </div>

          {/* Sidebar – unchanged except colors */}
          <aside class="space-y-6">
            <div class="glass-dark rounded-2xl p-6 space-y-8">
              <h3 class="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-4">Settings</h3>
              
              <div class="space-y-4">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Message Type</label>
                <div class="grid grid-cols-1 gap-2">
                  <For each={['announcement', 'promotion', 'update', 'alert', 'educational']}>
                    {(t) => (
                      <button 
                        onClick={() => setType(t as any)}
                        class={`px-4 py-3 rounded-xl text-[10px] font-black uppercase text-left transition-all border ${type() === t ? 'bg-cyan-500 border-cyan-500 text-black' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}
                      >
                        {t === 'announcement' ? 'Announcement' : 
                         t === 'promotion' ? 'Promotion' : 
                         t === 'update' ? 'Update' : 
                         t === 'alert' ? 'Alert' : 'Educational'}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="space-y-4">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Audience</label>
                <select 
                  value={target()}
                  onInput={(e) => setTarget(e.currentTarget.value as any)}
                  class="w-full px-4 py-3 rounded-xl bg-black border border-white/5 text-white text-[10px] font-black uppercase outline-none"
                >
                  <option value="all">All Users</option>
                  <option value="active">Active Users (last 7 days)</option>
                  <option value="balance">Users with Balance</option>
                  <option value="recent">Recent Users (last 30 days)</option>
                </select>
              </div>

              <div class="space-y-4">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Channels</label>
                <div class="space-y-2">
                  <ChannelToggle 
                    label="Bot Messages" 
                    active={channels().includes('bot')} 
                    onToggle={() => setChannels(prev => prev.includes('bot') ? prev.filter(c => c !== 'bot') : [...prev, 'bot'])} 
                  />
                  <ChannelToggle 
                    label="Channel Post" 
                    active={channels().includes('channel')} 
                    onToggle={() => setChannels(prev => prev.includes('channel') ? prev.filter(c => c !== 'channel') : [...prev, 'channel'])} 
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Show>

      <Show when={activeTab() === 'templates'}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={templates()}>
            {(tpl) => (
              <div class="glass-dark rounded-2xl p-6 hover:border-cyan-500/30 transition-all group">
                <div class="flex justify-between items-start mb-4">
                  <span class="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase rounded-full border border-cyan-500/20">
                    {tpl.type === 'announcement' ? 'Announcement' : 
                     tpl.type === 'promotion' ? 'Promotion' : 
                     tpl.type === 'update' ? 'Update' : 
                     tpl.type === 'alert' ? 'Alert' : 'Educational'}
                  </span>
                  <button onClick={() => handleDeleteTemplate(tpl._id, tpl.name)} class="text-gray-600 hover:text-rose-500 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <h3 class="text-white font-black uppercase tracking-tight mb-1">{tpl.name}</h3>
                <p class="text-gray-500 text-xs line-clamp-2 mb-6">{tpl.content}</p>
                <button 
                  onClick={() => handleUseTemplate(tpl)}
                  class="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-white font-black text-[10px] uppercase hover:bg-cyan-500 hover:text-black transition-all"
                >
                  Load Template
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function ChannelToggle(props: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button 
      onClick={props.onToggle}
      class={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${props.active ? 'bg-white/5 border-cyan-500/50' : 'bg-black border-white/5 opacity-50'}`}
    >
      <span class={`text-[10px] font-black uppercase ${props.active ? 'text-white' : 'text-gray-600'}`}>{props.label}</span>
      <div class={`w-4 h-4 rounded-full border-2 ${props.active ? 'bg-cyan-500 border-cyan-500' : 'border-white/10'}`} />
    </button>
  );
}