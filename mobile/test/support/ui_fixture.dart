// Generated from contracts/mobile-ui-fixture.json; test data only.
const uiFixture = {
  "user": {
    "id": "qa-user",
    "name": "测试用户",
    "fullName": "测试用户",
    "email": "qa@example.invalid",
    "age": 28,
    "role": "user"
  },
  "models": [
    {
      "id": "gpt-4o",
      "provider": "openai"
    },
    {
      "id": "gpt-image-2",
      "provider": "openai"
    }
  ],
  "sessions": [
    {
      "id": "qa-session",
      "title": "介绍 MarkAI",
      "revision": 0,
      "createdAt": 1788912000000,
      "updatedAt": 1788912000000,
      "model": "gpt-4o",
      "provider": "openai",
      "favorite": false
    }
  ],
  "messages": [
    {
      "id": "qa-user-message",
      "role": "user",
      "content": "介绍一下 MarkAI",
      "createdAt": 1788912000000
    },
    {
      "id": "qa-assistant-message",
      "role": "model",
      "model": "gpt-4o",
      "provider": "openai",
      "content": "你好！这是 **MarkAI** 的回复。\n\n- 支持流式输出\n- 保留会话历史",
      "reasoning": "我会先检查当前条件。",
      "createdAt": 1788912001000,
      "segments": [
        {
          "type": "thinking",
          "content": "我会先检查当前条件。"
        },
        {
          "type": "content",
          "content": "你好！这是 **MarkAI** 的回复。\n\n- 支持流式输出\n- 保留会话历史"
        }
      ],
      "usage": {
        "totalTokens": 42
      },
      "tokenUsageSource": "provider"
    }
  ],
  "tools": [],
  "files": {
    "files": [],
    "usage": {
      "count": 0,
      "size": 0
    },
    "limits": {
      "maxFileBytes": 10485760,
      "maxStorageBytes": 104857600,
      "maxFileCount": 100
    }
  }
};
