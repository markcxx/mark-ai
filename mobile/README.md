# MarkAI Android

Flutter 原生客户端，复用现有 Next.js API。当前为开发版本，尚未完成与 Web 的全部交互一致性验收。

## 运行

### 根目录 pnpm 快捷命令

在仓库根目录运行：

| 命令                | 用途                                     |
| ------------------- | ---------------------------------------- |
| `pnpm android`      | 启动安卓 App，默认连接本机 3000 端口后端 |
| `pnpm android:test` | 静态分析及单元、Widget 测试              |
| `pnpm android:apk`  | 打包可直接安装的调试 APK                 |

先启动模拟器或连接安卓设备；多设备时使用 `pnpm android -d <设备ID>`。后端单独运行 `pnpm dev`，已有后端运行时无需重复启动。Flutter 会自动获取依赖。

APK 输出到 `mobile/build/app/outputs/flutter-apk/app-debug.apk`。打包不内置本地后端地址，安装后在连接页面设置服务地址。当前为调试包，正式发布前需配置发布签名。

### Flutter 原生命令

在仓库根目录启动后端，然后运行：

```sh
cd mobile
flutter pub get
flutter run -d emulator-5554 --dart-define=MARKAI_API_URL=http://10.0.2.2:3000
```

模拟器用 `10.0.2.2` 访问 Mac；真机使用可访问的 HTTPS 域名。不传编译参数时，可在连接页面输入服务地址。后端需要本分支新增的 `/api/public/mobile-config`。仅 debug 允许 HTTP。

本地 debug 连接 `http://10.0.2.2:<端口>` 时，认证 Origin 使用对应的 `http://localhost:<端口>`，与本项目默认 APP_URL 一致；正式部署应连接与网页相同的 HTTPS 服务地址。

## 检查和构建

```sh
flutter analyze
flutter test
flutter test integration_test/chat_test.dart -d emulator-5554
flutter build apk --debug -t lib/main.dart
```

APK 位于 `build/app/outputs/flutter-apk/app-debug.apk`。不要分发 `tool/preview.dart` 或 integration_test 构建的测试包。发行前需要确定正式包名和签名；当前为开发包 `com.markai.markai_mobile`。

## 结构

- `core/network`：同源 Cookie API、错误处理和 NDJSON。
- `core/storage`：按服务/账号隔离的凭据、草稿与恢复数据。
- `shared`：无损消息模型和基础 UI；`core/theme` 保存主题。
- `features/chat/application`：导航、生成、取消、版本化保存和消息操作。
- `features/chat/presentation`：聊天、输入框、抽屉、消息、代码和朗读。
- `features/auth`、`features/settings`、`features/previews`：认证、设置和文件预览。

游客页与登录页使用独立 Flutter 原生组件，按 Web 源码移植。第三方登录回调、邀请和注册后的资料引导尚未接通，完整差异以实现状态文档为准。

完整实现状态及剩余差异见 `../docs/mobile/implementation-status.md`。

## 可重复的视觉检查

```sh
flutter run -d emulator-5554 -t tool/preview.dart
flutter run -d emulator-5554 -t tool/preview.dart --dart-define=PREVIEW_THEME=dark
```

该入口仅使用合成测试数据。`qa/` 为模拟器截图，不代表已通过与 Web 的逐像素比较。

字体来自 Google Fonts OFL 源，许可证在 `assets/fonts`；Logo/模型 SVG 来自本仓库。ECharts/Mermaid 脚本来自仓库现有 npm 依赖，许可证在 `assets/web`。
