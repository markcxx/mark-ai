# 思考模式开关（2026-09-14）

网页输入框增加“深度思考”开关；安卓输入框增加思考按钮，两端均使用与消息思考区一致的原子图标。设置通过原有 settings API 保存和同步。此功能控制模型请求，和设置里的“思考面板”（仅控制展开/收起）独立。

首次使用跟随模型默认行为；用户点击后，以明确的开启/关闭值作用于后续对话和重新生成。生成期间不可切换。切到不可切换的模型会隐藏按钮，不向其发送不支持的参数。

## 已核对的协议

| 接入平台 | 已识别的可切换模型 | Chat Completions 参数 |
| --- | --- | --- |
| DeepSeek 官方 | V3.1/V3.2、V4，flash/pro 别名 | `thinking.type: enabled / disabled` |
| 智谱 / Z.ai | GLM 4.5/4.6/4.7、5/5.1/5.2 系列 | `thinking.type: enabled / disabled` |
| Moonshot | Kimi K2.5、K2.6 | `thinking.type: enabled / disabled` |
| 百炼 | 已核对的 Qwen 混合思考版本，以及部署在百炼的 DeepSeek、GLM、Kimi 混合思考版本 | `enable_thinking: true / false` |
| 硅基流动 | 已识别的 Qwen、DeepSeek、GLM、Kimi 混合思考版本 | `enable_thinking: true / false` |
| 火山方舟 | Doubao Seed 1.6、2.0、2.1 非固定思考版本，DeepSeek V4、GLM 5.2 日期版本 | `thinking.type: enabled / disabled` |
| 小米官方 | MiMo V2.5、V2.5 Pro | `thinking.type: enabled / disabled` |
| MiniMax 官方 | M3 | `thinking.type: adaptive / disabled` |

不能把模型的品牌直接当作开关能力：MiniMax M2.x、GLM 5.3、Kimi K2 Thinking/K2.7 Code/K3、Qwen 固定 Thinking/Instruct/Coder 版本、旧版普通模型不展示开关。GLM 等模型开启后可能自主判断简单问题是否需要思考。

服务端根据模型 ID、真实 API 域名和提供商识别参数；不向客户端公开密钥或接口地址。未知代理、Hugging Face 等动态路由未确认统一关停协议，暂不猜测参数。用户自定义的隐藏模型别名也不能自动反推出能力。

MarkAI 聚合模型在至少一条线路支持切换时展示按钮；显式切换后的请求只会从兼容线路中选择，不会随机落到未经确认的线路。默认模式仍使用原来的路由。若线路配置已变更而页面未刷新，会提示刷新模型列表，不会静默忽略选择。

思考模式的工具续接会回传 `reasoning_content`；Kimi 思考请求仅用 `tool_choice: auto`，兼容其接口限制。历史思考仅在需要的模型请求中回传，并计入服务端上下文裁剪预算。旧版客户端未发送开关参数时，保留上游默认值。

## 官方依据

- [DeepSeek 思考与工具调用](https://api-docs.deepseek.com/guides/thinking_mode/)
- [智谱深度思考及 GLM 5.3 限制](https://docs.bigmodel.cn/cn/guide/capabilities/thinking)
- [Kimi K2.6 参数与工具限制](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart)
- [百炼混合思考、固定思考和各版本默认值](https://help.aliyun.com/zh/model-studio/deep-thinking)
- [硅基流动 Chat API](https://docs.siliconflow.cn/docs/api/chat-completions-post)
- [火山方舟思考示例](https://www.volcengine.com/docs/82379/1795150)、[官方 Chat SDK 的 Thinking 参数定义](https://github.com/volcengine/volcengine-python-sdk/blob/master/volcenginesdkarkruntime/types/chat/completion_create_params.py)
- [MiMo 深度思考及内容回传](https://platform.xiaomimimo.com/docs/en-US/usage-guide/passing-back-reasoning_content)
- [MiniMax OpenAI 兼容 API](https://platform.minimax.cn/docs/api-reference/text-openai-api)

## 验证与验收

自动检查覆盖参数差异、默认行为、不可切换模型、聚合线路筛选、思考/联网搜索的多轮续接、历史思考预算，以及安卓按钮状态和发送内容。上游接口测试使用模拟响应，未消耗账户额度。真实提供商的可用性、代理是否透传参数，以及安卓真机相机/相册权限仍需按实际账户和设备验收。
