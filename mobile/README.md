# MarkAI Android

Flutter 原生客户端，复用现有 Next.js API。当前为开发版本，尚未完成与 Web 的全部交互一致性验收。

## 运行

### 根目录 pnpm 快捷命令

在仓库根目录运行：

| 命令                | 用途                                     |
| ------------------- | ---------------------------------------- |
| `pnpm android`      | 自动启动安卓模拟器并运行 App，默认连接本机 3000 端口后端 |
| `pnpm android:test` | 静态分析及单元、Widget 测试              |
| `pnpm android:apk`  | 打包正式签名的 Release APK，连接正式环境 |

直接执行 `pnpm android` 即可：先复用 3000 端口上已有的 MarkAI 后端，没有则自动启动并等待接口就绪；再复用或启动安卓模拟器（优先 Pixel_7_API_36），最后运行 App。退出命令时只停止本次自动启动的后端，不影响原先运行的服务。多设备时使用 `pnpm android -d <设备ID>`。真机或远程后端可通过环境变量 `MARKAI_API_URL` 指定服务地址，此时不会自动启动本地后端。Flutter 会自动获取依赖。

正式 APK 输出到 `mobile/build/app/outputs/flutter-apk/app-release.apk`，后端固定为 `https://chatai.markqq.com`。启动时显示品牌加载页，失败可重试，不显示服务地址配置表单，也不读取旧版本保存的开发地址。

发布签名由 `mobile/android/key.properties` 配置，密钥位于 `mobile/android/keystore/markai-release.jks`。这两个文件均已被 Git 忽略；必须一同安全备份，后续版本需要同一把密钥才能覆盖升级。缺少签名配置时，正式构建会明确失败，不会退回调试签名。

新机器恢复签名时，将备份放回上述位置。`key.properties` 使用 `storeFile=keystore/markai-release.jks`、`keyAlias=markai-release`，以及备份中的 `storePassword` 和 `keyPassword`。不要将真实密码写入文档或提交到仓库。

### Flutter 原生命令

在仓库根目录启动后端，然后运行：

```sh
cd mobile
flutter pub get
flutter run -d emulator-5554 --dart-define=MARKAI_API_URL=http://10.0.2.2:3000
```

模拟器用 `10.0.2.2` 访问 Mac；真机使用可访问的 HTTPS 域名。不传编译参数时，默认使用正式环境。后端需要 `/api/public/mobile-config`。仅 debug 允许 HTTP。

本地 debug 连接 `http://10.0.2.2:<端口>` 时，认证 Origin 使用对应的 `http://localhost:<端口>`，与本项目默认 APP_URL 一致；正式部署应连接与网页相同的 HTTPS 服务地址。

## 检查和构建

```sh
flutter analyze
flutter test
flutter test integration_test/chat_test.dart -d emulator-5554
flutter build apk --release -t lib/main.dart --dart-define=MARKAI_API_URL=https://chatai.markqq.com
```

APK 位于 `build/app/outputs/flutter-apk/app-release.apk`，包名为 `com.markai.markai_mobile`。不要分发 `tool/preview.dart` 或 integration_test 构建的测试包。正式签名和旧调试签名不同，正式包不能直接覆盖旧调试包；不要为测试覆盖安装而清除用户数据。

## 手动发布与应用内更新

GitHub Actions 的 **Android release (manual)** 仅手动触发；只填写版本号和更新说明，Android 内部版本代码自动生成。构建后上传 GitHub Releases 和对象存储，公开下载校验通过后才发布。GitHub 的 `android-release` 环境已配置签名与存储参数，详见 [发布配置说明](../docs/mobile/release-update-plan.md)。

正式 App 优先直接读取 GitHub Releases API；GitHub 网络故障时读取发布后同步到对象存储的清单。启动后台检查，也可通过“设置 → 应用更新”手动检查，下载前可选择“GitHub”或“加速下载”。大小、SHA-256 和签名校验后调起系统安装确认。调试包不走正式更新通道；旧版没有更新功能的 App 需先手动安装一次。

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

该入口仅使用合成测试数据。`qa/` 是按需生成、由 Git 忽略的本地截图目录，历史截图已清理；截图不代表已通过与 Web 的逐像素比较。启用截图导出时会自动创建目录，无需保留旧图片。

字体来自 Google Fonts OFL 源，许可证在 `assets/fonts`；Logo/模型 SVG 来自本仓库。ECharts/Mermaid 脚本来自仓库现有 npm 依赖，许可证在 `assets/web`。

## 本地测试与手机分享

可以构建与正式版本并存的“MarkAI 测试”（独立数据，需要单独登录），不修改正式版本号或发布：

```sh
ORG_GRADLE_PROJECT_markaiTestBuild=true flutter build apk --debug -t lib/main.dart --dart-define=MARKAI_API_URL=https://chatai.markqq.com
```

输出 `build/app/outputs/flutter-apk/app-debug.apk`。系统分享支持文字、链接和附件，确认后添加到当前草稿，不自动发送。附件确认后才上传；现有附件与分享附件合计最多 4 个。本地接收单文件最大 25MB、合计 50MB，实际上传仍受服务端限制；未处理的分享缓存在应用私有缓存中，下次读取时清理超过 24 小时的内容，也可能被系统提前回收。

侧栏支持跟手拖动、反向拖回和快速甩动，保留按钮与系统返回入口。`integration_test/incoming_shares_test.dart` 可配合文件内的 ADB 指令验证原生分享接收和本地文件清理。
