'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Openai, Gemini, DeepSeek } from '@lobehub/icons';
import {
  Menu, Plus, History as HistoryIcon, Compass, FolderOpen, Puzzle,
  Settings, HelpCircle, MessageSquare, ChevronDown, Share2, MoreVertical,
  Paperclip, Mic, ArrowUp, Copy, ThumbsUp, ThumbsDown, User, Bot, Pencil,
  RotateCw, Trash2, MoreHorizontal
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Pre, PreSingleLine } from '@/components/CodeBlock';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  model?: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'model',
    content: '您好！我是 MarkAI 平台。作为一个拥有 Intelligent Clarity 特性的人工智能助手，我致力于为您提供高效、清晰和准确的信息与帮助。请问今天有什么我可以为您效劳的？\n\n> [!TIP]\n> 您可以在左上方切换不同的模型引擎，例如 gpt-5.5 或 deepseek-v4-pro。',
    model: 'gemini-3.5-flash'
  },
  {
    id: '2',
    role: 'user',
    content: '你好，请帮我把一段 Markdown 文本翻译成英文，并保持原有格式不变。\n\n## 示例功能\n\n- **代码高亮**：支持多种语言\n- ~~错误的内容~~应该被删除\n- 这是一个单行代码：`console.log("hello")`\n\n```python\ndef hello_world():\n    print("Hello, world!")\n```\n\n| 特性 | 支持 | 备注 |\n| --- | --- | --- |\n| 表格 | ✅ | GFM 特性 |\n| 待办列表 | ❌ | 暂未支持 |\n\n[了解更多](https://example.com)'
  },
  {
    id: '3',
    role: 'model',
    content: '没问题，以下是翻译后的结果：\n\n## Example Features\n\n- **Code Highlighting**: Supports multiple languages\n- ~~Incorrect content~~ should be deleted\n- This is inline code: `console.log("hello")`\n\n```python\ndef hello_world():\n    print("Hello, world!")\n```\n\n| Feature | Supported | Notes |\n| --- | --- | --- |\n| Tables | ✅ | GFM Feature |\n| Task Lists | ❌ | Not yet supported |\n\n[Learn more](https://example.com)',
    model: 'deepseek-v4-pro'
  }
];

export default function ChatApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [loadingText, setLoadingText] = useState('正在思考...');

  const models = ['gpt-5.5', 'gemini-3.5-flash', 'deepseek-v4-pro'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isLoading) {
      const texts = ['正在思考...', '正在连接模型...', '正在生成内容...', '正在组织语言...'];
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % texts.length;
        setLoadingText(texts[i]);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '', isStreaming: true, model: selectedModel }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let text = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          text += decoder.decode(value, { stream: !done });
          setMessages(prev => prev.map(m => 
            m.id === modelMessageId ? { ...m, content: text } : m
          ));
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === modelMessageId ? { ...m, content: 'Sorry, I encountered an error. Please try again.' } : m
      ));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(m => 
        m.id === modelMessageId ? { ...m, isStreaming: false } : m
      ));
    }
  };

  return (
    <div className="flex bg-[#f8f8f8] p-2 text-gray-900 antialiased h-screen w-screen overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col h-full bg-[#f8f8f8] transition-all duration-300 z-30 shrink-0",
        isSidebarOpen ? "w-[260px] mr-2" : "w-0 overflow-hidden mr-0"
      )}>
        <div className="w-[260px] flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-3 flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 ml-2 mt-1">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                <span className="text-lg font-bold">M</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">MarkAI</h1>
                <p className="text-xs text-gray-500 font-jakarta">Intelligent Clarity</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors text-gray-500"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-4 mb-6 mt-2">
            <button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-gray-200 hover:bg-white hover:shadow-sm transition-all text-gray-900 text-sm font-medium group bg-[#f3f4f5]">
              <Plus size={20} />
              <span>新建会话</span>
              <span className="ml-auto text-xs text-gray-400 group-hover:text-gray-500 transition-colors">⌘K</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-3 mb-4">
            <div className="text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider font-jakarta font-semibold">视图</div>
            <nav className="flex flex-col gap-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-200 text-gray-900 font-medium transition-colors">
                <Puzzle size={20} />
                <span className="text-sm">插件中心</span>
              </a>
            </nav>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider font-jakarta font-semibold mt-4">今天</div>
            <div className="flex flex-col gap-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-100 text-gray-900 text-sm truncate transition-colors">
                <span className="truncate">Markdown 翻译工具</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">PyQt5 按钮点击事件处理</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">设计系统 Token 梳理</span>
              </a>
            </div>

            <div className="text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider font-jakarta font-semibold mt-6">昨天</div>
            <div className="flex flex-col gap-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">TailwindCSS 网格布局求助</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">分析 Q3 财报数据</span>
              </a>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 mt-auto border-t border-gray-200/50">
            <nav className="flex flex-col gap-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                <Settings size={20} />
                <span className="text-sm">设置</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                <HelpCircle size={20} />
                <span className="text-sm">帮助</span>
              </a>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden">
        
        {/* Top Header */}
        <header className="flex justify-between items-center w-full px-6 h-16 sticky top-0 z-20 bg-white/80 backdrop-blur-md">
          <div className="flex items-center">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 mr-2 transition-colors"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="relative">
              <div 
                className="flex items-center gap-2 cursor-pointer group px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {selectedModel}
                  <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                </h2>
              </div>
              
              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  {models.map(model => (
                    <button
                      key={model}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        setSelectedModel(model);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
              <Share2 size={20} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-40 pt-6 flex flex-col items-center">
          <div className="w-full max-w-[840px] flex flex-col gap-8">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-4 w-full", message.role === 'user' ? "justify-end" : "justify-start")}>
                {message.role === 'model' && (
                  <div className="w-8 h-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-white mt-1 shadow-sm">
                    <Bot size={18} />
                  </div>
                )}
                
                <div className={cn("flex-1 min-w-0 flex flex-col", message.role === 'user' ? "items-end" : "")}>
                  {message.role !== 'user' && (
                    <div className="flex flex-col mb-1 ml-1">
                      <div className="text-xs text-gray-500 font-jakarta font-medium">
                        MarkAI
                      </div>
                      {message.isStreaming && (
                        <div className="text-gray-400 font-normal text-xs mt-1 flex items-center gap-1.5 animate-pulse">
                          正在生成...
                        </div>
                      )}
                    </div>
                  )}
                  
                  {message.role === 'user' ? (
                    <div className="group relative flex flex-col items-end w-full">
                      <div className="bg-[#f3f4f5] text-gray-900 px-5 py-3 rounded-2xl rounded-tr-sm text-[15px] break-words text-left shadow-sm whitespace-pre-wrap" style={{ maxWidth: '85%', width: 'fit-content' }}>
                        {message.content}
                      </div>
                      <div className="flex items-center gap-1 mt-2 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors" title="编辑">
                          <Pencil size={15} />
                        </button>
                        <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors" title="复制">
                          <Copy size={15} />
                        </button>
                        <div className="relative group/menu">
                          <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                            <MoreHorizontal size={15} />
                          </button>
                          <div className="absolute top-full right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 hidden group-hover/menu:block z-10">
                            <button className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                              <Share2 size={14} /> 分享
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                              <Trash2 size={14} /> 删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <div className="text-[15px] text-gray-900 leading-relaxed markdown-body">
                        {message.content ? (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              pre: ({children}) => <>{children}</>,
                              code({node, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match && !String(children).includes('\n');
                                if (isInline) {
                                  return <PreSingleLine>{children}</PreSingleLine>;
                                }
                                return (
                                  <Pre language={match?.[1] || 'text'}>
                                    {String(children)}
                                  </Pre>
                                );
                              },
                              h1: ({node, ...props}) => <h1 className="text-2xl font-semibold mt-6 mb-4 text-gray-900" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-4 text-gray-900" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-900" {...props} />,
                              a: ({node, ...props}) => <a className="text-primary hover:underline hover:text-blue-700 transition-colors" {...props} />,
                              table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 shadow-sm"><table className="w-full border-collapse" {...props} /></div>,
                              th: ({node, ...props}) => <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium text-left text-sm text-gray-700" {...props} />,
                              td: ({node, ...props}) => <td className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600" {...props} />,
                              p: ({node, ...props}) => <p className="mb-4 leading-relaxed last:mb-0" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 ml-2" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 ml-2" {...props} />,
                              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 bg-gray-50 pl-4 py-2 italic text-gray-600 my-4 rounded-r-lg" {...props} />,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          <div className="h-6 flex items-center">
                             {/* Loading dots or empty before stream starts */}
                          </div>
                        )}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-pulse rounded-full" />
                        )}
                      </div>
                      
                      {/* Action Row for AI Message */}
                      {!message.isStreaming && (
                        <div className="flex items-center gap-1 mt-2 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors" title="复制">
                            <Copy size={15} />
                          </button>
                          <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors" title="重新生成">
                            <RotateCw size={15} />
                          </button>
                          <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors" title="赞">
                            <ThumbsUp size={15} />
                          </button>
                          <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors" title="踩">
                            <ThumbsDown size={15} />
                          </button>
                          <div className="relative group/menu">
                            <button className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                              <MoreHorizontal size={15} />
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 hidden group-hover/menu:block z-10">
                              <button className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                                <Share2 size={14} /> 分享
                              </button>
                              <div className="h-px bg-gray-100 my-1"></div>
                              <button className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                <Trash2 size={14} /> 删除
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:px-8 pb-6 md:pb-8 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa] to-transparent pt-10 flex justify-center z-20 pointer-events-none">
          <div className="w-full max-w-[840px] pointer-events-auto">
            <div className="bg-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.06)] border border-gray-200 flex flex-col relative transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none px-4 py-4 min-h-[64px] max-h-[200px] text-[15px] text-gray-900 placeholder:text-gray-400" 
                placeholder="尽管问，带图也行..." 
                rows={1}
                disabled={isLoading}
              />
              
              {/* Input Toolbar */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-1">
                  <button className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="添加附件">
                    <Paperclip size={20} />
                  </button>
                  <button className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="语音输入">
                    <Mic size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white hover:opacity-80 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
                  >
                    <ArrowUp size={20} />
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-center mt-3 text-xs text-gray-400 font-jakarta">
              内容由 AI 生成，请注意甄别。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
