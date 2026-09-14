// Uses the original React components. Only routing/auth/network are fixtures.
import React from 'react';
import { UsageTrendChart } from '../../components/admin/UsageTrendChart';
import fixture from '../../contracts/mobile-ui-fixture.json';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import ChatApp from '../../components/chat/ChatApp';
import { ProfileDialog } from '../../components/chat/ProfileDialog';
import { PluginCenterDrawer } from '../../components/tools/PluginCenterDrawer';
import { ShareConversationDialog } from '../../components/chat/ShareConversationDialog';
import { FileManagerDrawer } from '../../components/chat/FileManagerDrawer';
import { SettingsDialog } from '../../components/chat/SettingsDialog';
import { MODEL_PROVIDER_TEMPLATES } from '../../lib/model-provider-registry';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ThinkingPanel } from '../../components/chat/ThinkingPanel';
import { MarkdownContent } from '../../components/chat/MarkdownContent';
import { WebSearchToolBlock } from '../../components/chat/message/WebSearchToolBlock';
import { GeneratedFileToolBlock } from '../../components/chat/message/GeneratedFileToolBlock';

const params = new URLSearchParams(location.search);
const user = fixture.user;
const catalog = fixture.tools;
const performanceMessages = Array.from({length: 100}, (_, index) => ({
  ...fixture.messages[index % 2], id: `perf-${index}`, segments: undefined,
  isStreaming: index === 99 && params.has('streaming'),
  content: index === 99 && params.has('html') ? '```html\n<!doctype html><html><head><title>网页预览</title></head><body><h1>你好，MarkAI</h1></body></html>\n```' : index === 99 ? '```typescript\nconst answer: number = 42;\n```' : fixture.messages[index % 2].content,
}));
function streamFixture() {
  let ticks = 0;
  const timer = setInterval(() => {
    ticks++;
    useChatStore.setState(state => ({messages: state.messages.map((message, index) => index === state.messages.length - 1 ? {
      ...message, content: '```typescript\nconst answer: number = 42;\n// ' + '片段 '.repeat(ticks) + '\n```', isStreaming: ticks < 20,
    } : message)}));
    if (ticks === 20) clearInterval(timer);
  }, 50);
}
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) throw new Error('QA network isolation: ' + url.pathname);
  const path = url.pathname;
  let result: unknown = {};
  if (path === '/api/profile') result = { user };
  else if (path === '/api/tools') result = { tools: catalog };
  else if (path === '/api/settings') result = { settings: { general: { themeMode: params.get('theme') || 'light', reduceMotion: true } } };
  else if (path === '/api/model-providers') result = {templates:MODEL_PROVIDER_TEMPLATES,providers:[],siteProviders:[],cloudPersistence:true};
  else if (path === '/api/models') result = { models: params.has('thinking') ? [{id:'kimi-k2.5',provider:'moonshot',thinking:{defaultEnabled:true}},...fixture.models] : fixture.models };
  else if (path === '/api/sessions') result = { sessions: params.has('history') || location.pathname !== '/' ? fixture.sessions : [] };
  else if (path === '/api/sessions/qa-session') result = {session: fixture.sessions[0], messages: params.has('performance') ? performanceMessages : fixture.messages};
  else if (path.endsWith('/tools')) result = {toolIds:[]};
  else if (path.endsWith('/share')) result = { share: null };
  else if (path === '/api/admin/me') result = { admin: false };
  else if (path === '/api/files') result = fixture.files;
  else throw new Error('Unimplemented fixture: ' + path + ' ' + options?.method);
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
useSettingsStore.setState((state) => ({ ...state, general: { ...state.general, reduceMotion: true }, isLoaded: true }));
const view = params.get('view');
createRoot(document.getElementById('root')!).render(<ThemeProvider attribute="class" forcedTheme={params.get('theme') || 'light'}>
  {view === 'profile' ? <ProfileDialog email={user.email} fallbackName={user.name} profile={user} onClose={() => {}} onProfileUpdated={() => {}} />
    : view === 'plugins' ? <PluginCenterDrawer open onClose={() => {}} />
    : view === 'files' ? <FileManagerDrawer open onClose={()=>{}} />
    : view === 'settings' ? <SettingsDialog onClose={()=>{}} />
    : view === 'share' ? <ShareConversationDialog sessionId="qa-session" onClose={() => {}} busy={false} />
    : view === 'trend' ? <div className="min-h-screen bg-gray-50 p-4 dark:bg-[#0e0f11]"><div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#191919]"><h2 className="mb-4 text-sm font-semibold dark:text-white">用户与使用趋势 · 最近30天</h2><UsageTrendChart data={Array.from({length:30},(_,i)=>({date:`2026-08-${String(i+1).padStart(2,'0')}`,users:Math.round(5+Math.sin(i)*4+i*.5),sessions:Math.round(15+Math.cos(i*.6)*10+i),messages:Math.round(100+Math.sin(i*.5)*50+i*8)}))}/></div></div>
    : view === 'output' ? <div className="min-h-screen bg-white p-3 text-gray-900 dark:bg-[#111214] dark:text-gray-100">
      <WebSearchToolBlock webSearch={{status:'done',query:'Flutter 公式',results:[{title:'公式渲染参考',url:'https://example.invalid/math',content:'数学公式、工具调用与正文应该保持一致。'}]}} />
      <GeneratedFileToolBlock generatedFile={{callId:'qa-call',status:'error',toolId:'word-document',toolName:'word_document_finalize',error:'生成失败，请稍后重试'}} />
      <ThinkingPanel content="先检查条件，再推导公式。" duration={1200} />
      <MarkdownContent>{String.raw`行内公式 $E=mc^2$。

\[
\frac{-b\pm\sqrt{b^2-4ac}}{2a}
\]`}</MarkdownContent>
    </div>
    : <><ChatApp initialSessionId={params.has('performance') ? 'qa-session' : undefined} />
      {params.has('performance') && <button style={{position:'fixed',top:8,right:8,zIndex:9999}} onClick={streamFixture}>测试流式更新</button>}
    </>}
</ThemeProvider>);
