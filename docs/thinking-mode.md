# 思考模式开关（2026-10-29 核对）

网页输入框增加“深度思考”开关；安卓输入框增加思考按钮，两端均使用与消息思考区一致的原子图标。设置通过原有 settings API 保存和同步。此功能控制模型请求，和设置里的“思考面板”（仅控制展开/收起）独立。

首次使用跟随模型默认行为；用户点击后，以明确的开启/关闭值作用于后续对话和重新生成。生成期间不可切换。切到不可切换的模型会隐藏按钮，不向其发送不支持的参数。

## 已核对的协议

| 接入平台      | 已识别的可切换模型                                                                                                         | Chat Completions 参数                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| DeepSeek 官方 | V3.1/V3.2、V4/V4.1（包括日期版本），flash/pro 别名                                                                         | `thinking.type: enabled / disabled`                         |
| 智谱 / Z.ai   | GLM 4.5/4.6/4.7、5/5.1/5.2 系列                                                                                            | `thinking.type: enabled / disabled`                         |
| Moonshot      | Kimi K2.5、K2.6                                                                                                            | `thinking.type: enabled / disabled`                         |
| 百炼          | 已核对的 Qwen 混合思考版本、Qwen3-VL Plus/Flash，以及部署在百炼的 DeepSeek V4.1 等混合思考版本                             | `enable_thinking: true / false`                             |
| 硅基流动      | 已识别的 Qwen、DeepSeek、GLM、Kimi 混合思考版本                                                                            | `enable_thinking: true / false`                             |
| 火山方舟      | Doubao Seed 1.6、2.0、2.1 非固定思考版本、Seed Evolving、2.0 Code Preview 260215，DeepSeek V4/V4.1、GLM 5.2 已核对日期版本 | `thinking.type: enabled / disabled`                         |
| 小米官方      | MiMo V2.6 Flash/Pro/Pro Ultraspeed，以及 V2.5/Pro 兼容名称                                                                 | `thinking.type: enabled / disabled`                         |
| MiniMax 官方  | M3                                                                                                                         | `thinking.type: adaptive / disabled`                        |
| 无问芯穹      | 已核对的 Qwen 混合思考版本                                                                                                 | `enable_thinking: true / false`                             |
| 无问芯穹      | 已核对的 DeepSeek、GLM、Kimi、MiMo 混合思考版本；MiniMax M3                                                                | `thinking.type: enabled / disabled`；M3 开启值为 `adaptive` |

不能把模型的品牌直接当作开关能力：MiniMax M2.x/M3.1 Flash、GLM 5.3/5.3 Flash、Kimi K2 Thinking/K2.7 Code/K3/K3.1、Qwen 固定 Thinking/Instruct/Coder 版本及 Qwen3.8 2.4T、旧版普通模型不展示开关。GLM 等模型开启后可能自主判断简单问题是否需要思考。调整思考强度或隐藏思考文本，不等于关闭思考。

服务端先按真实 API 域名确定接入平台，再按模型 ID 判断能力和参数；仅未填写接口地址时，才回退到明确的提供商预设名称。环境变量名称、`mark` 前缀和显示名称不参与能力匹配。识别模型命名空间后仍使用接入平台的协议，不直接套用模型原厂协议。比如同一个 DeepSeek V4.1，百炼使用 `enable_thinking`，无问芯穹使用 `thinking.type`。

内置环境配置、任意命名的环境配置、用户保存的提供商预设及自定义地址，共用此策略。不向客户端公开密钥或接口地址。显式配置的未知地址不继承名称相同的预设能力，避免选了官方预设、改成代理地址后发错协议。

Command Code 的公开 Provider API 文档和模型列表未提供所查国产型号的明确关停参数；商汤 Token Plan 尚未取得所配 DeepSeek/GLM 的可核实协议；Hugging Face 等动态路由也未确认统一关停协议。上述线路暂不猜测参数。OpenRouter 有独立的 `reasoning` 协议和逐模型 `mandatory` 元数据，尚未接入此处的两种协议，不能直接复用原厂参数。用户自定义的隐藏模型别名也不能自动反推出能力。

MarkAI 聚合模型在至少一条线路支持切换时展示按钮；显式切换后的请求只会从兼容线路中选择，不会随机落到未经确认的线路。默认模式仍使用原来的路由。若线路配置已变更而页面未刷新，会提示刷新模型列表，不会静默忽略选择。

思考模式的工具续接会回传 `reasoning_content`；Kimi 和百炼 Qwen 思考请求使用 `tool_choice: auto`，避免强制工具选择与思考参数冲突。历史思考仅在需要的模型请求中回传，并计入服务端上下文裁剪预算。旧版客户端未发送开关参数时，保留上游默认值。该文档描述可切换模型的协议；固定思考模型的完整推理回传不等于有可关闭的开关。

## 官方依据

- [DeepSeek 思考与工具调用](https://api-docs.deepseek.com/guides/thinking_mode/)
- [智谱深度思考及 GLM 5.3 限制](https://docs.bigmodel.cn/cn/guide/capabilities/thinking)
- [Kimi K2.6 参数与工具限制](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart)
- [百炼混合思考、固定思考和各版本默认值](https://help.aliyun.com/zh/model-studio/deep-thinking)
- [百炼视觉模型思考开关与默认值](https://help.aliyun.com/zh/model-studio/vision/)、[思考模式工具选择限制](https://help.aliyun.com/zh/model-studio/qwen-function-calling)
- [硅基流动 Chat API](https://docs.siliconflow.cn/docs/api/chat-completions-post)
- [火山方舟思考示例](https://www.volcengine.com/docs/82379/1795150)、[官方 Chat SDK 的 Thinking 参数定义](https://github.com/volcengine/volcengine-python-sdk/blob/master/volcenginesdkarkruntime/types/chat/completion_create_params.py)
- [MiMo 深度思考及内容回传](https://platform.xiaomimimo.com/docs/en-US/usage-guide/passing-back-reasoning_content)
- [MiniMax OpenAI 兼容 API](https://platform.minimax.cn/docs/api-reference/text-openai-api)
- [MiniMax M3/M3.1 与 M2.x 的开关区别](https://platform.minimax.io/docs/api-reference/text-openai-api)
- [Kimi 各版本是否允许关闭](https://platform.kimi.ai/docs/guide/use-thinking-models)
- [MiMo V2.6 思考控制](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/text-generation/deep-thinking)
- [无问芯穹各模型系列的推理参数](https://docs.infini-ai.com/gen-studio/api/text-generation/tutorial-reasoning/)
- [火山方舟新版思考参数表](https://docs.volcengine.com/docs/ark/deep-thinking?lang=en)
- [Command Code Provider API](https://commandcode.ai/docs/provider)、[OpenRouter 独立推理协议](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)

## 验证与验收

自动检查覆盖参数差异、默认行为、不可切换模型、配置名称不变性、域名优先与仿冒域名、用户配置和环境配置的能力发布、聚合线路筛选、思考/联网搜索的多轮续接、历史思考预算。上游生成接口测试使用模拟响应，未消耗模型额度。真实提供商的可用性和代理是否透传参数仍需按实际账户验收。
