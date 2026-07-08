'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ModelIcon } from '@lobehub/icons';
import toast, { Toaster } from 'react-hot-toast';
import {
  Menu, Plus, Puzzle,
  Settings, HelpCircle, ChevronDown, Share2, MoreVertical,
  Paperclip, Mic, ArrowUp, Copy, Pencil,
  RotateCw, Trash2, MoreHorizontal, Search, Loader2, Atom,
  MessageSquarePlus, Minimize2, Volume2, Languages, CheckSquare,
  X, Check
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
  reasoning?: string;
  reasoningDuration?: number;
  isReasoning?: boolean;
  isStreaming?: boolean;
  model?: string;
  provider?: string;
};

type ChatStreamEvent = {
  text?: string;
  type?: 'content' | 'reasoning';
};

type ConfiguredModel = {
  id: string;
  provider: string;
};

const THINKING_TEXTS = [
  '正在思考...',
  '正在发送消息...',
  '正在连接模型...',
  '正在读取上下文...',
  '正在组织语言...',
  '正在生成回复...'
];

const NOT_IMPLEMENTED_TOAST = '该功能暂未接入';

let messageIdCounter = 0;

const createMessageId = () => {
  messageIdCounter += 1;
  return `message-${messageIdCounter}`;
};

const getModelKey = (model: ConfiguredModel) => `${model.provider}:${model.id}`;

const THINKING_TAGS = [
  { close: '</think>', open: '<think>' },
  { close: '</lobeThinking>', open: '<lobeThinking>' },
];

const extractThinkingFromText = (text: string) => {
  let content = '';
  let reasoning = '';
  let cursor = 0;
  let hasOpenThinking = false;

  while (cursor < text.length) {
    const nextTag = THINKING_TAGS
      .map(tag => ({ ...tag, index: text.indexOf(tag.open, cursor) }))
      .filter(tag => tag.index >= 0)
      .sort((a, b) => a.index - b.index)[0];

    if (!nextTag) {
      content += text.slice(cursor);
      break;
    }

    content += text.slice(cursor, nextTag.index);
    const reasoningStart = nextTag.index + nextTag.open.length;
    const reasoningEnd = text.indexOf(nextTag.close, reasoningStart);

    if (reasoningEnd < 0) {
      reasoning += text.slice(reasoningStart);
      hasOpenThinking = true;
      break;
    }

    reasoning += text.slice(reasoningStart, reasoningEnd);
    cursor = reasoningEnd + nextTag.close.length;
  }

  return {
    content: content.replace(/\n{3,}/g, '\n\n').trimStart(),
    hasOpenThinking,
    reasoning: reasoning.replace(/\n{3,}/g, '\n\n').trimStart(),
  };
};

const getTextFromNode = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextFromNode).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return getTextFromNode(node.props.children);
  return '';
};

const renderAdmonitionParagraph = (children: React.ReactNode) => {
  const text = getTextFromNode(children);
  const match = text.match(/^\[!(TIP|NOTE|WARNING|IMPORTANT|CAUTION)\]\s*([\s\S]*)/);

  if (!match) {
    return <p className="mb-4 leading-relaxed last:mb-0">{children}</p>;
  }

  const [, type, body] = match;
  return (
    <p className="mb-0 leading-relaxed">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">
        {type}
      </span>
      {body.trim()}
    </p>
  );
};

const ModelAvatar = ({ model, className, size = 32 }: { model?: string; provider?: string; className?: string; size?: number }) => {
  return (
    <div
      className={cn("shrink-0 overflow-hidden rounded-full shadow-sm ring-1 ring-gray-200 bg-white", className)}
      style={{ width: size, height: size }}
    >
      <ModelIcon model={model} size={size} type="avatar" />
    </div>
  );
};

const markdownComponents = {
  pre: ({children}: any) => <>{children}</>,
  code({className, children}: any) {
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
  h1: (props: any) => <h1 className="text-2xl font-semibold mt-6 mb-4 text-gray-900" {...props} />,
  h2: (props: any) => <h2 className="text-xl font-semibold mt-6 mb-4 text-gray-900" {...props} />,
  h3: (props: any) => <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-900" {...props} />,
  a: (props: any) => <a className="text-primary hover:underline hover:text-blue-700 transition-colors" {...props} />,
  table: (props: any) => <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 shadow-sm"><table className="w-full border-collapse" {...props} /></div>,
  th: (props: any) => <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium text-left text-sm text-gray-700" {...props} />,
  td: (props: any) => <td className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600" {...props} />,
  p: ({children}: any) => renderAdmonitionParagraph(children),
  ul: (props: any) => <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 ml-2" {...props} />,
  ol: (props: any) => <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 ml-2" {...props} />,
  blockquote: (props: any) => <blockquote className="rounded-lg border border-blue-100 border-l-4 border-l-primary/70 bg-blue-50/70 px-4 py-3 text-gray-700 my-4 shadow-sm" {...props} />,
};

const MarkdownContent = ({ children }: { children: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
    {children}
  </ReactMarkdown>
);

const ThinkingPanel = ({
  content,
  duration,
  thinking,
}: {
  content?: string;
  duration?: number;
  thinking?: boolean;
}) => {
  const [showDetail, setShowDetail] = useState(() => Boolean(thinking));
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasContent = Boolean(content?.trim());
  const expanded = Boolean(thinking || showDetail);

  useEffect(() => {
    if (thinking && expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, expanded, thinking]);

  if (!thinking && !hasContent) return null;

  const title = thinking
    ? '正在深度思考...'
    : duration
      ? `已深度思考 (${(duration / 1000).toFixed(1)} 秒)`
      : '已深度思考';

  return (
    <div className="mb-4 text-sm">
      <button
        className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-left text-gray-500 transition-colors hover:bg-gray-100"
        onClick={() => setShowDetail(value => !value)}
        type="button"
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400",
            expanded && !thinking && "border-purple-200 bg-purple-50 text-purple-500"
          )}
        >
          {thinking ? <Loader2 size={14} className="animate-spin" /> : <Atom size={14} />}
        </span>
        <span
          className={cn(
            "text-sm",
            thinking
              ? "animate-pulse bg-gradient-to-r from-gray-400 via-gray-600 to-gray-400 bg-[length:200%_100%] bg-clip-text text-transparent"
              : "text-gray-500"
          )}
        >
          {title}
        </span>
        <ChevronDown
          size={14}
          className={cn("text-gray-400 transition-transform", expanded && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="mt-1 max-h-[min(40vh,320px)] overflow-y-auto px-2 pb-2 text-[13px] leading-relaxed text-gray-500"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 18px), transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 18px), transparent)',
            }}
          >
            <div className="markdown-body [&_*]:!text-gray-500">
              {hasContent ? <MarkdownContent>{content || ''}</MarkdownContent> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'model',
    content: '下面是 MarkAI 对话里 Markdown 提示框组件的默认渲染效果：\n\n> [!TIP]\n> 模型列表会从环境变量读取，例如 `GEMINI_MODELS=gemini-2.5-flash,gemini-2.5-pro`。\n\n> [!NOTE]\n> AI 回复会保留标题、列表、表格、代码块和链接等 Markdown 结构。\n\n> [!WARNING]\n> 没有配置到环境变量里的模型不会出现在输入框右侧的模型选择器中。\n\n```ts\nconst model = "gemini-2.5-flash";\nconsole.log(`Using ${model}`);\n```\n\n| 能力 | 状态 |\n| --- | --- |\n| GFM 表格 | 已支持 |\n| 代码高亮 | 已支持 |\n| 提示框样式 | 已优化 |',
    model: 'gemini-3.5-flash',
    provider: 'gemini'
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
    model: 'deepseek-v4-pro',
    provider: 'deepseek'
  }
];

export default function ChatApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<ConfiguredModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchKeyword, setModelSearchKeyword] = useState('');
  const [loadingText, setLoadingText] = useState(THINKING_TEXTS[0]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [collapsedMessageIds, setCollapsedMessageIds] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const selectedModel = availableModels.find(model => getModelKey(model) === selectedModelKey);
  const filteredModels = availableModels.filter(model =>
    model.id.toLowerCase().includes(modelSearchKeyword.trim().toLowerCase())
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      try {
        const response = await fetch('/api/models', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load models');
        const data = await response.json();
        const models = Array.isArray(data.models) ? data.models : [];

        if (isMounted) {
          setAvailableModels(models);
          setSelectedModelKey(models[0] ? getModelKey(models[0]) : '');
        }
      } catch (error) {
        console.error('Model config error:', error);
        if (isMounted) {
          setAvailableModels([]);
          setSelectedModelKey('');
        }
      } finally {
        if (isMounted) setIsLoadingModels(false);
      }
    };

    loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % THINKING_TEXTS.length;
        setLoadingText(THINKING_TEXTS[i]);
      }, 4200);
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

  const streamAssistantMessage = async (
    historyMessages: Message[],
    modelMessageId: string,
    modelConfig: ConfiguredModel,
  ) => {
    try {
      setLoadingText(current => {
        const index = THINKING_TEXTS.indexOf(current);
        return THINKING_TEXTS[(index + 1) % THINKING_TEXTS.length];
      });
      setIsLoading(true);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyMessages.map(m => ({ role: m.role, content: m.content })),
          model: modelConfig.id,
          provider: modelConfig.provider
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const isStructuredStream = response.headers
        .get('content-type')
        ?.includes('application/x-ndjson');
      let done = false;
      let buffer = '';
      let plainContent = '';
      let eventReasoning = '';
      let reasoningStartedAt: number | undefined;
      let reasoningDuration: number | undefined;

      const beginReasoning = () => {
        reasoningStartedAt = reasoningStartedAt || Date.now();
      };

      const endReasoning = () => {
        if (reasoningStartedAt && !reasoningDuration) {
          reasoningDuration = Date.now() - reasoningStartedAt;
        }
      };

      const updateStreamingMessage = (isReasoning?: boolean) => {
        const extracted = extractThinkingFromText(plainContent);
        const reasoning = `${eventReasoning}${extracted.reasoning}`;

        setMessages(prev => prev.map(m =>
          m.id === modelMessageId
            ? {
                ...m,
                content: extracted.content,
                isReasoning: Boolean(isReasoning || extracted.hasOpenThinking),
                reasoning,
                reasoningDuration,
              }
            : m
        ));
      };

      const appendContent = (chunk: string) => {
        plainContent += chunk;
        const extracted = extractThinkingFromText(plainContent);

        if (extracted.reasoning) beginReasoning();
        if (eventReasoning && reasoningStartedAt && !reasoningDuration) endReasoning();
        if (extracted.reasoning && !extracted.hasOpenThinking) endReasoning();

        updateStreamingMessage(extracted.hasOpenThinking);
      };

      const appendReasoning = (chunk: string) => {
        beginReasoning();
        eventReasoning += chunk;
        updateStreamingMessage(true);
      };

      const handleStreamLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const event = JSON.parse(trimmed) as ChatStreamEvent;
          if (event.type === 'reasoning' && event.text) {
            appendReasoning(event.text);
            return;
          }

          if (event.type === 'content' && event.text) {
            appendContent(event.text);
            return;
          }
        } catch {
          // Fall back to rendering non-JSON chunks as normal content.
        }

        appendContent(line);
      };

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });

          if (!isStructuredStream) {
            appendContent(chunk);
            continue;
          }

          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            handleStreamLine(line);
          }
        }
      }

      if (isStructuredStream && buffer) {
        handleStreamLine(buffer);
      }

      if (reasoningStartedAt && !reasoningDuration) {
        endReasoning();
        updateStreamingMessage(false);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('生成失败，请稍后重试');
      setMessages(prev => prev.map(m => 
        m.id === modelMessageId
          ? {
              ...m,
              content: 'Sorry, I encountered an error. Please try again.',
              isReasoning: false,
            }
          : m
      ));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(m => 
        m.id === modelMessageId ? { ...m, isReasoning: false, isStreaming: false } : m
      ));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedModel) return;

    const userMessage: Message = { id: createMessageId(), role: 'user', content: input.trim() };
    const modelMessageId = createMessageId();
    const modelMessage: Message = {
      id: modelMessageId,
      role: 'model',
      content: '',
      isStreaming: true,
      model: selectedModel.id,
      provider: selectedModel.provider,
    };
    const nextMessages = [...messages, userMessage, modelMessage];

    setMessages(nextMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await streamAssistantMessage([...messages, userMessage], modelMessageId, selectedModel);
  };

  const getMessageModel = (message: Message) => {
    if (message.role !== 'model') return selectedModel;

    return (
      availableModels.find(model => model.id === message.model && model.provider === message.provider) ||
      selectedModel
    );
  };

  const copyText = async (text: string, successMessage = '已复制') => {
    if (!text.trim()) {
      toast.error('没有可复制的内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('复制失败');
    }
  };

  const copyMessage = (message: Message) => {
    copyText(message.content, '消息已复制');
  };

  const copyConversation = () => {
    const text = messages
      .filter(message => message.content.trim())
      .map(message => `${message.role === 'user' ? '用户' : message.model || 'AI'}：\n${message.content}`)
      .join('\n\n');

    copyText(text, '对话已复制');
  };

  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(message => message.id !== id));
    setSelectedMessageIds(prev => prev.filter(messageId => messageId !== id));
    setCollapsedMessageIds(prev => prev.filter(messageId => messageId !== id));
    if (editingMessageId === id) {
      setEditingMessageId(null);
      setEditingContent('');
    }
    toast.success('消息已删除');
  };

  const startEditingMessage = (message: Message) => {
    if (message.isStreaming) {
      toast.error('生成中不能编辑');
      return;
    }

    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setOpenMenuMessageId(null);
  };

  const saveEditingMessage = () => {
    if (!editingMessageId) return;
    if (!editingContent.trim()) {
      toast.error('消息内容不能为空');
      return;
    }

    setMessages(prev => prev.map(message =>
      message.id === editingMessageId ? { ...message, content: editingContent.trim() } : message
    ));
    setEditingMessageId(null);
    setEditingContent('');
    toast.success('消息已更新');
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const toggleCollapseMessage = (id: string) => {
    setCollapsedMessageIds(prev =>
      prev.includes(id) ? prev.filter(messageId => messageId !== id) : [...prev, id]
    );
    setOpenMenuMessageId(null);
  };

  const enableMultiSelect = (id: string) => {
    setMultiSelectMode(true);
    setSelectedMessageIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setOpenMenuMessageId(null);
    toast.success('已进入多选模式');
  };

  const toggleSelectedMessage = (id: string) => {
    setSelectedMessageIds(prev =>
      prev.includes(id) ? prev.filter(messageId => messageId !== id) : [...prev, id]
    );
  };

  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedMessageIds([]);
  };

  const copySelectedMessages = () => {
    const text = messages
      .filter(message => selectedMessageIds.includes(message.id))
      .map(message => `${message.role === 'user' ? '用户' : message.model || 'AI'}：\n${message.content}`)
      .join('\n\n');

    copyText(text, '已复制选中消息');
  };

  const deleteSelectedMessages = () => {
    if (selectedMessageIds.length === 0) {
      toast.error('请先选择消息');
      return;
    }

    setMessages(prev => prev.filter(message => !selectedMessageIds.includes(message.id)));
    setCollapsedMessageIds(prev => prev.filter(id => !selectedMessageIds.includes(id)));
    exitMultiSelect();
    toast.success('已删除选中消息');
  };

  const regenerateMessage = async (message: Message, deleteCurrent = false) => {
    if (isLoading) {
      toast.error('请等待当前回复完成');
      return;
    }

    const index = messages.findIndex(item => item.id === message.id);
    if (index < 0) return;

    const modelConfig = getMessageModel(message);
    if (!modelConfig) {
      toast.error('请先配置可用模型');
      return;
    }

    const targetId = createMessageId();

    if (message.role === 'user') {
      const historyMessages = messages.slice(0, index + 1);
      const modelMessage: Message = {
        id: targetId,
        role: 'model',
        content: '',
        isStreaming: true,
        model: modelConfig.id,
        provider: modelConfig.provider,
      };

      setMessages([...historyMessages, modelMessage]);
      setOpenMenuMessageId(null);
      await streamAssistantMessage(historyMessages, targetId, modelConfig);
      return;
    }

    const historyMessages = messages.slice(0, index);
    const nextModelMessage: Message = {
      ...message,
      id: deleteCurrent ? targetId : message.id,
      content: '',
      reasoning: undefined,
      reasoningDuration: undefined,
      isReasoning: false,
      isStreaming: true,
      model: modelConfig.id,
      provider: modelConfig.provider,
    };

    if (deleteCurrent) {
      setMessages([...historyMessages, nextModelMessage]);
    } else {
      setMessages(prev => [
        ...prev.slice(0, index),
        nextModelMessage,
      ]);
    }

    setOpenMenuMessageId(null);
    await streamAssistantMessage(historyMessages, nextModelMessage.id, modelConfig);
  };

  const menuUnavailable = () => {
    setOpenMenuMessageId(null);
    toast(NOT_IMPLEMENTED_TOAST);
  };

  const renderMoreMenu = (message: Message, align: 'left' | 'right') => {
    const isCollapsed = collapsedMessageIds.includes(message.id);
    const menuItems = [
      { icon: Pencil, label: '编辑', onClick: () => startEditingMessage(message) },
      { icon: Copy, label: '复制', onClick: () => {
        copyMessage(message);
        setOpenMenuMessageId(null);
      } },
      { icon: MessageSquarePlus, label: '创建子话题', onClick: menuUnavailable },
      { icon: Minimize2, label: isCollapsed ? '展开消息' : '收起消息', onClick: () => toggleCollapseMessage(message.id) },
      { icon: Volume2, label: '语音朗读', onClick: menuUnavailable },
      { icon: Languages, label: '翻译', onClick: menuUnavailable },
      { icon: Share2, label: '分享', onClick: menuUnavailable },
      { icon: CheckSquare, label: '多选', onClick: () => enableMultiSelect(message.id) },
      { icon: RotateCw, label: '重新生成', onClick: () => regenerateMessage(message) },
      { icon: RotateCw, label: '删除并重新生成', onClick: () => regenerateMessage(message, true), danger: true },
      { icon: Trash2, label: '删除', onClick: () => deleteMessage(message.id), danger: true },
    ];

    return (
      <div
        className={cn(
          "absolute top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-[0_12px_36px_rgba(0,0,0,0.14)]",
          align === 'right' ? "right-0" : "left-0"
        )}
      >
        {menuItems.map(({ icon: Icon, label, onClick, danger }) => (
          <button
            key={label}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100",
              danger ? "text-red-600 hover:bg-red-50" : "text-gray-700"
            )}
            onClick={onClick}
            type="button"
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex bg-[#f8f8f8] p-2 text-gray-900 antialiased h-screen w-screen overflow-hidden font-sans">
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'text-sm',
          duration: 2200,
          style: {
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
          },
        }}
      />
      
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
            <button
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-gray-200 hover:bg-white hover:shadow-sm transition-all text-gray-900 text-sm font-medium group bg-[#f3f4f5]"
              onClick={() => {
                setMessages([]);
                exitMultiSelect();
                setEditingMessageId(null);
                setEditingContent('');
                toast.success('已新建会话');
              }}
              type="button"
            >
              <Plus size={20} />
              <span>新建会话</span>
              <span className="ml-auto text-xs text-gray-400 group-hover:text-gray-500 transition-colors">⌘K</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-3 mb-4">
            <div className="text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider font-jakarta font-semibold">视图</div>
            <nav className="flex flex-col gap-1">
              <button
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-200 text-gray-900 font-medium transition-colors"
                onClick={() => toast(NOT_IMPLEMENTED_TOAST)}
                type="button"
              >
                <Puzzle size={20} />
                <span className="text-sm">插件中心</span>
              </button>
            </nav>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider font-jakarta font-semibold mt-4">今天</div>
            <div className="flex flex-col gap-1">
              <button onClick={() => toast(NOT_IMPLEMENTED_TOAST)} type="button" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-100 text-gray-900 text-sm truncate transition-colors">
                <span className="truncate">Markdown 翻译工具</span>
              </button>
              <button onClick={() => toast(NOT_IMPLEMENTED_TOAST)} type="button" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">PyQt5 按钮点击事件处理</span>
              </button>
              <button onClick={() => toast(NOT_IMPLEMENTED_TOAST)} type="button" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">设计系统 Token 梳理</span>
              </button>
            </div>

            <div className="text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider font-jakarta font-semibold mt-6">昨天</div>
            <div className="flex flex-col gap-1">
              <button onClick={() => toast(NOT_IMPLEMENTED_TOAST)} type="button" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">TailwindCSS 网格布局求助</span>
              </button>
              <button onClick={() => toast(NOT_IMPLEMENTED_TOAST)} type="button" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm truncate">
                <span className="truncate">分析 Q3 财报数据</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 mt-auto border-t border-gray-200/50">
            <nav className="flex flex-col gap-1">
              <button
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                onClick={() => toast(NOT_IMPLEMENTED_TOAST)}
                type="button"
              >
                <Settings size={20} />
                <span className="text-sm">设置</span>
              </button>
              <button
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                onClick={() => toast(NOT_IMPLEMENTED_TOAST)}
                type="button"
              >
                <HelpCircle size={20} />
                <span className="text-sm">帮助</span>
              </button>
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
            <h2 className="px-3 text-base font-semibold text-gray-900">对话</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              onClick={copyConversation}
              title="复制对话"
              type="button"
            >
              <Share2 size={20} />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              onClick={() => toast(NOT_IMPLEMENTED_TOAST)}
              title="更多"
              type="button"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-40 pt-6 flex flex-col items-center">
          <div className="w-full max-w-[840px] flex flex-col gap-8">
            {multiSelectMode && (
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
                <span className="text-gray-500">已选择 {selectedMessageIds.length} 条消息</span>
                <div className="flex items-center gap-1">
                  <button
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                    onClick={copySelectedMessages}
                    type="button"
                  >
                    <Copy size={15} />
                    复制
                  </button>
                  <button
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-red-600 transition-colors hover:bg-red-50"
                    onClick={deleteSelectedMessages}
                    type="button"
                  >
                    <Trash2 size={15} />
                    删除
                  </button>
                  <button
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                    onClick={exitMultiSelect}
                    type="button"
                  >
                    <X size={15} />
                    退出
                  </button>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={cn("relative w-full", message.role === 'user' ? "flex justify-end" : "")}>
                {multiSelectMode && (
                  <button
                    className={cn(
                      "absolute left-[-34px] top-2 flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                      selectedMessageIds.includes(message.id)
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-transparent hover:border-gray-500"
                    )}
                    onClick={() => toggleSelectedMessage(message.id)}
                    type="button"
                  >
                    <Check size={14} />
                  </button>
                )}
                {message.role === 'user' ? (
                  <div className="group relative flex w-full flex-col items-end">
                    {editingMessageId === message.id ? (
                      <div className="w-full max-w-[85%] rounded-2xl rounded-tr-sm bg-[#f3f4f5] p-3 shadow-sm">
                        <textarea
                          value={editingContent}
                          onChange={(event) => setEditingContent(event.target.value)}
                          className="min-h-[96px] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-[15px] text-gray-900 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                          autoFocus
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                            onClick={cancelEditingMessage}
                            type="button"
                          >
                            取消
                          </button>
                          <button
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-85"
                            onClick={saveEditingMessage}
                            type="button"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#f3f4f5] text-gray-900 px-5 py-3 rounded-2xl rounded-tr-sm text-[15px] break-words text-left shadow-sm whitespace-pre-wrap" style={{ maxWidth: '85%', width: 'fit-content' }}>
                        {collapsedMessageIds.includes(message.id) ? '消息已收起' : message.content}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        title="编辑"
                        onClick={() => startEditingMessage(message)}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        title="复制"
                        onClick={() => copyMessage(message)}
                        type="button"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="删除"
                        onClick={() => deleteMessage(message.id)}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="relative">
                        <button
                          className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="更多"
                          onClick={() => setOpenMenuMessageId(openMenuMessageId === message.id ? null : message.id)}
                          type="button"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {openMenuMessageId === message.id && renderMoreMenu(message, 'right')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="group relative w-full">
                    <div className="mb-3 flex items-center gap-2.5">
                      <ModelAvatar model={message.model} provider={message.provider} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-jakarta text-[15px] font-bold text-gray-900">
                          {message.model || selectedModel?.id}
                        </span>
                        {message.isStreaming && (
                          <span className="mt-0.5 text-xs font-medium text-gray-400 animate-pulse">
                            {loadingText}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-10 text-[15px] text-gray-900 leading-relaxed markdown-body">
                      {editingMessageId === message.id ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <textarea
                            value={editingContent}
                            onChange={(event) => setEditingContent(event.target.value)}
                            className="min-h-[180px] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-[15px] text-gray-900 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                            autoFocus
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                              onClick={cancelEditingMessage}
                              type="button"
                            >
                              取消
                            </button>
                            <button
                              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-85"
                              onClick={saveEditingMessage}
                              type="button"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : collapsedMessageIds.includes(message.id) ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                          消息已收起
                        </div>
                      ) : (
                        <>
                          <ThinkingPanel
                            content={message.reasoning}
                            duration={message.reasoningDuration}
                            thinking={message.isReasoning}
                          />
                          {message.content ? (
                            <MarkdownContent>{message.content}</MarkdownContent>
                          ) : null}
                          {message.isStreaming && message.content && (
                            <span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-pulse rounded-full" />
                          )}
                        </>
                      )}
                    </div>

                    {!message.isStreaming && (
                      <div className="ml-10 flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="复制"
                          onClick={() => copyMessage(message)}
                          type="button"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="重新生成"
                          onClick={() => regenerateMessage(message)}
                          type="button"
                        >
                          <RotateCw size={15} />
                        </button>
                        <button
                          className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="编辑"
                          onClick={() => startEditingMessage(message)}
                          type="button"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="删除"
                          onClick={() => deleteMessage(message.id)}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                        <div className="relative">
                          <button
                            className="p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                            title="更多"
                            onClick={() => setOpenMenuMessageId(openMenuMessageId === message.id ? null : message.id)}
                            type="button"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {openMenuMessageId === message.id && renderMoreMenu(message, 'left')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                placeholder={selectedModel ? "尽管问，带图也行..." : "请先在环境变量中配置可用模型"} 
                rows={1}
                disabled={isLoading || !selectedModel}
              />
              
              {/* Input Toolbar */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-1">
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="添加附件"
                    onClick={() => toast(NOT_IMPLEMENTED_TOAST)}
                    type="button"
                  >
                    <Paperclip size={20} />
                  </button>
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="语音输入"
                    onClick={() => toast(NOT_IMPLEMENTED_TOAST)}
                    type="button"
                  >
                    <Mic size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (availableModels.length > 0) setIsModelDropdownOpen(!isModelDropdownOpen);
                      }}
                      disabled={isLoadingModels || availableModels.length === 0}
                      className="flex h-9 max-w-[220px] items-center gap-2 rounded-lg px-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      title="选择模型"
                    >
                      {selectedModel ? (
                        <>
                          <ModelIcon model={selectedModel.id} size={20} type="avatar" />
                          <span className="hidden max-w-[138px] truncate sm:inline">{selectedModel.id}</span>
                        </>
                      ) : (
                        <span className="max-w-[120px] truncate">
                          {isLoadingModels ? '加载中' : '未配置模型'}
                        </span>
                      )}
                      <ChevronDown
                        size={16}
                        className={cn(
                          "shrink-0 text-gray-400 transition-transform",
                          isModelDropdownOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {isModelDropdownOpen && availableModels.length > 0 && (
                      <div className="absolute bottom-full right-0 z-50 mb-2 flex max-h-[460px] w-[min(320px,calc(100vw-32px))] select-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-0 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
                        <div className="flex h-10 items-center border-b border-gray-100 px-2">
                          <div className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-gray-400 focus-within:bg-gray-50">
                            <Search size={16} />
                            <input
                              value={modelSearchKeyword}
                              onChange={(event) => setModelSearchKeyword(event.target.value)}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                              placeholder="搜索模型"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto py-1">
                          {filteredModels.length > 0 ? (
                            filteredModels.map(model => {
                              const key = getModelKey(model);
                              const isSelected = key === selectedModelKey;

                              return (
                                <button
                                  key={key}
                                  className={cn(
                                    "mx-1 my-px flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                                    isSelected ? "bg-gray-100 text-gray-950" : "text-gray-700 hover:bg-gray-100"
                                  )}
                                  onClick={() => {
                                    setSelectedModelKey(key);
                                    setIsModelDropdownOpen(false);
                                    setModelSearchKeyword('');
                                  }}
                                  type="button"
                                >
                                  <ModelIcon model={model.id} size={20} type="avatar" />
                                  <span className="min-w-0 flex-1 truncate">{model.id}</span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-400">没有匹配的模型</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading || !selectedModel}
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
