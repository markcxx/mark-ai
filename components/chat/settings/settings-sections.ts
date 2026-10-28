import {
  AudioLines,
  BarChart3,
  Bot,
  CircleUserRound,
  Coins,
  CreditCard,
  Database,
  FlaskConical,
  Gift,
  Info,
  Keyboard,
  KeyRound,
  Palette,
  Puzzle,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  AppWindow,
} from "lucide-react";

// Personal settings only. Excluded LobeHub categories are deliberately not registered.
export const SETTINGS_GROUPS = [
  {
    label: "账户",
    items: [
      {
        id: "profile",
        label: "个人资料",
        icon: CircleUserRound,
        description: "管理头像、昵称与账户资料",
        keywords: "账号 邮箱 年龄 avatar profile",
      },
      {
        id: "appearance",
        label: "外观",
        icon: Palette,
        description: "让工作空间呈现你习惯的样子",
        keywords: "主题 颜色 字号 代码 图表 动画 theme",
      },
      {
        id: "hotkey",
        label: "快捷键",
        icon: Keyboard,
        description: "用键盘更快地完成日常操作",
        keywords: "发送 命令中心 快捷键 keyboard",
      },
      {
        id: "security",
        label: "账户安全",
        icon: ShieldCheck,
        description: "管理账户密码",
        keywords: "密码 登录 password",
      },
    ],
  },
  {
    label: "通用",
    items: [
      {
        id: "statistics",
        label: "数据统计",
        icon: BarChart3,
        description: "了解你的对话活动与模型使用情况",
        keywords: "统计 趋势 token 消息",
      },
    ],
  },
  {
    label: "订阅与账单",
    items: [
      {
        id: "plans",
        label: "订阅套餐",
        icon: Sparkles,
        description: "查看当前服务状态与订阅开放情况",
        keywords: "会员 升级 付费 套餐 subscription",
      },
      {
        id: "usage",
        label: "用量明细",
        icon: BarChart3,
        description: "按模型查看已保存回复的 Token 用量",
        keywords: "消耗 tokens 模型 明细",
      },
      {
        id: "credits",
        label: "积分与余额",
        icon: Coins,
        description: "查看积分服务的开放状态",
        keywords: "充值 积分 余额 credits",
      },
      {
        id: "billing",
        label: "账单记录",
        icon: CreditCard,
        description: "订阅与付款记录",
        keywords: "发票 支付 账单 billing",
      },
      {
        id: "referral",
        label: "邀请奖励",
        icon: Gift,
        description: "邀请奖励计划",
        keywords: "邀请 推荐 奖励 referral",
      },
    ],
  },
  {
    label: "AI",
    items: [
      {
        id: "providers",
        label: "AI 服务商",
        icon: Bot,
        description: "管理模型服务商和个人模型配置",
        keywords: "提供商 API 模型 OpenAI Gemini Claude",
      },
      {
        id: "service-model",
        label: "服务模型",
        icon: Settings2,
        description: "配置翻译等辅助功能使用的模型",
        keywords: "翻译 系统 默认模型",
      },
      {
        id: "chat",
        label: "对话偏好",
        icon: SlidersHorizontal,
        description: "调整回复展示与默认对话行为",
        keywords: "联网 思考 滚动 宽屏 重新生成",
      },
      {
        id: "personalization",
        label: "个性化",
        icon: CircleUserRound,
        description: "让回复更符合你的习惯与工作方式",
        keywords: "自定义 指令 职业 兴趣 称呼 语言 语气",
      },
      {
        id: "speech",
        label: "语音",
        icon: AudioLines,
        description: "选择消息朗读的默认音色",
        keywords: "语音 声音 朗读 voice",
      },
      {
        id: "skills",
        label: "技能与工具",
        icon: Puzzle,
        description: "管理已安装的技能和工具",
        keywords: "插件 工具 Word Excel 图表",
      },
    ],
  },
  {
    label: "系统",
    items: [
      {
        id: "storage",
        label: "存储与数据",
        icon: Database,
        description: "查看文件占用，导入和导出个人设置",
        keywords: "文件 空间 导入 导出 备份 数据",
      },
      {
        id: "trash",
        label: "回收站",
        icon: Trash2,
        description: "查看数据恢复功能的支持情况",
        keywords: "删除 恢复 回收站",
      },
      {
        id: "about",
        label: "关于",
        icon: Info,
        description: "MarkAI 版本与应用信息",
        keywords: "版本 下载 关于",
      },
    ],
  },
  {
    label: "开发者",
    items: [
      {
        id: "advanced",
        label: "高级设置",
        icon: SlidersHorizontal,
        description: "工作区布局与偏好恢复",
        keywords: "侧栏 宽度 预览 重置 恢复默认",
      },
      {
        id: "apikey",
        label: "平台 API",
        icon: KeyRound,
        description: "MarkAI 对外 API 的开放情况",
        keywords: "开发者 API Key",
      },
      {
        id: "oauth-apps",
        label: "OAuth 应用",
        icon: AppWindow,
        description: "管理 MarkAI 应用授权",
        keywords: "OAuth 应用 授权 回调",
      },
      {
        id: "labs",
        label: "实验室",
        icon: FlaskConical,
        description: "查看可体验的实验功能",
        keywords: "实验 测试 labs",
      },
    ],
  },
] as const;

export type SettingsSection = (typeof SETTINGS_GROUPS)[number]["items"][number]["id"];
export const SETTINGS_SECTIONS = SETTINGS_GROUPS.flatMap((group) => [...group.items]);
export const SETTINGS_SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((item) => item.id));
export const SETTINGS_SEARCH = (query: string) => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return SETTINGS_SECTIONS.filter((item) =>
    words.every((word) =>
      `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(word),
    ),
  );
};
