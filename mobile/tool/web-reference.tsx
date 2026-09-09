// Uses the original React components. Only routing/auth/network are fixtures.
import React from 'react';
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
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ThinkingPanel } from '../../components/chat/ThinkingPanel';
import { MarkdownContent } from '../../components/chat/MarkdownContent';
import { WebSearchToolBlock } from '../../components/chat/message/WebSearchToolBlock';
import { GeneratedFileToolBlock } from '../../components/chat/message/GeneratedFileToolBlock';

const params = new URLSearchParams(location.search);
const user = fixture.user;
const catalog = fixture.tools;
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) throw new Error('QA network isolation: ' + url.pathname);
  const path = url.pathname;
  let result: unknown = {};
  if (path === '/api/profile') result = { user };
  else if (path === '/api/tools') result = { tools: catalog };
  else if (path === '/api/settings') result = { settings: { general: { themeMode: params.get('theme') || 'light', reduceMotion: true } } };
  else if (path === '/api/model-providers') result = {templates:MODEL_PROVIDER_TEMPLATES,providers:[],siteProviders:[],cloudPersistence:true};
  else if (path === '/api/models') result = { models: fixture.models };
  else if (path === '/api/sessions') result = { sessions: params.has('history') || location.pathname !== '/' ? fixture.sessions : [] };
  else if (path === '/api/sessions/qa-session') result = {session: fixture.sessions[0], messages: fixture.messages};
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
    : view === 'output' ? <div className="min-h-screen bg-white p-3 text-gray-900 dark:bg-[#111214] dark:text-gray-100">
      <WebSearchToolBlock webSearch={{status:'done',query:'Flutter 公式',results:[{title:'公式渲染参考',url:'https://example.invalid/math',content:'数学公式、工具调用与正文应该保持一致。'}]}} />
      <GeneratedFileToolBlock generatedFile={{callId:'qa-call',status:'error',toolId:'word-document',toolName:'word_document_finalize',error:'生成失败，请稍后重试'}} />
      <ThinkingPanel content="先检查条件，再推导公式。" duration={1200} />
      <MarkdownContent>{String.raw`行内公式 $E=mc^2$。

\[
\frac{-b\pm\sqrt{b^2-4ac}}{2a}
\]`}</MarkdownContent>
    </div>
    : <ChatApp />}
</ThemeProvider>);
