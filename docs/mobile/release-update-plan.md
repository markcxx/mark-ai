# Android 发布与更新

## 当前状态

已实现只填写版本号的手动构建、GitHub Releases 发布、对象存储自动上传、GitHub API 直接检测、双下载渠道、文件校验和系统安装入口。已配置远端 `android-release` 环境的 6 个 Secrets、4 个 Variables，并限制默认分支发布。代码已提交并推送，正式发布结果以 GitHub Actions 和 Releases 为准。

现有公开仓库为 `markcxx/mark-ai`，公共存储桶为 `markai-public`，下载域名为 `https://markai-s3.mark79.cn`。使用独立的 `android/` 前缀，不改变用户附件的存储方式，也未实现多账号空间。

## 如何发布

1. 提交并推送当前代码到仓库默认分支。手动工作流必须先进入默认分支才能出现在 Actions。
2. 打开 GitHub Actions → **Android release (manual)** → **Run workflow**，选择默认分支。
3. 填写版本号和更新说明，例如第一次 `1.0.2`，下一次 `1.0.3`。不用填写版本代码。
4. 等待构建发布和版本快照同步两个任务都成功。
5. 第一次从 Release 下载正式 APK 并安装。后续正式包可以在 App 内更新。

安卓工作流只有 `workflow_dispatch`，推送提交、推送 tag 不会触发安卓构建。已有 Web 部署工作流不变。当前仅发布通用 APK。

## 只维护版本号

用户界面和更新判断使用 `X.Y.Z`，按三段整数比较，因此 `1.0.10` 高于 `1.0.9`。

Android 系统仍需要内部整数 versionCode 来防止降级。Gradle 和发布脚本自动按 `主版本 × 1000000 + 次版本 × 1000 + 修订号` 生成，例如 `1.0.3 → 1000003`。不在设置界面显示，也不需要手动维护。次版本、修订号范围为 0–999，内部总值不能超过 Android 支持上限。

`mobile/pubspec.yaml` 只写 `version: 1.0.3`，本地 `pnpm android:apk` 自动生成对应整数；CI 的版本号输入通过 `--build-name` 写入 APK。CI 不自动提交版本变更，后续本地打包前应把 pubspec 更新为准备发布的版本。

发布版本必须高于所有 GitHub Android 正式版本，不得低于 pubspec。已有 Release（含草稿）或同名 tag 不允许覆盖。安装前同时检查版本代码递增，兼容以前已经分发的低版本代码 APK。

## GitHub 环境配置

这些项目已在 `markcxx/mark-ai` 的 **android-release** 环境中配置，无需用户重新手动填写。

| 类型     | 名称                                | 来源/用途                     |
| -------- | ----------------------------------- | ----------------------------- |
| Secret   | `ANDROID_KEYSTORE_BASE64`           | 现有正式签名 JKS 的 Base64    |
| Secret   | `ANDROID_STORE_PASSWORD`            | 现有 storePassword            |
| Secret   | `ANDROID_KEY_PASSWORD`              | 现有 keyPassword              |
| Secret   | `ANDROID_KEY_ALIAS`                 | 现有 keyAlias                 |
| Secret   | `ANDROID_STORAGE_ACCESS_KEY_ID`     | 现有 R2 访问密钥 ID           |
| Secret   | `ANDROID_STORAGE_SECRET_ACCESS_KEY` | 现有 R2 私钥                  |
| Variable | `ANDROID_STORAGE_ENDPOINT`          | 现有 R2 S3 HTTPS endpoint     |
| Variable | `ANDROID_STORAGE_BUCKET`            | `markai-public`               |
| Variable | `ANDROID_STORAGE_REGION`            | `auto`                        |
| Variable | `ANDROID_DOWNLOAD_BASE_URL`         | `https://markai-s3.mark79.cn` |

正式签名必须保持原密钥。证书 SHA-256 固定校验 `41aa77778a62ded4149d02fc51890e88b35bd31b0e80c41aade32465b90c32a6`。Secrets 只在 CI 使用，绝不编译进 App。新客户端不需要服务器 GitHub token，不依赖部署新后端接口；旧版兼容更新接口仍保留。

## 构建和发布顺序

1. 验证版本、tag 和配置，生成内部版本代码。
2. 固定 Flutter 3.47.2 / JDK 21，安装锁定依赖，运行 analyze 和完整 Flutter tests。
3. 恢复现有签名密钥，构建连接 `https://chatai.markqq.com` 的正式 APK。
4. 验证包名、版本、minSdk 24 和正式签名，生成清单与 SHA-256。
5. 上传 APK、清单和校验文件到对象存储，并从公共域名完整下载校验大小和 SHA-256。
6. 上传同一批文件到 GitHub draft Release，全部完成后发布正式 Release。
7. 独立任务重新读取 GitHub 已发布记录，生成对象存储的 `android/latest.json` 网络备用清单。

发布说明保留用户填写的内容，并附带隐藏 JSON 注释。App 一次 GitHub Releases API 请求即可取得更新说明、双渠道地址、版本和摘要，不需要再从 GitHub 下载清单才能弹窗。不要手工删除发布说明中的隐藏 `markai-android-update` 注释。

对象存储的版本文件不可覆盖；失败重试只有大小和摘要一致的文件可以复用。若构建失败后重打 APK 字节变化，应使用新版本，避免同一版本对应不同文件。快照同步失败时，使用 Actions 的 **Re-run failed jobs** 只重试同步任务，不重建已发布的 APK；旧任务重试不会覆盖更高版本的快照。

## 安装包在哪里

GitHub Release `android-v1.0.3` 包含 `MarkAI-1.0.3.apk`、`android-update.json`、`SHA256SUMS`。

对象存储对应：

```text
android/1.0.3/MarkAI-1.0.3.apk
android/1.0.3/android-update.json
android/1.0.3/SHA256SUMS
android/latest.json
```

用户选择 GitHub 时直接从 GitHub 下载；选择“加速下载”时直接从 `markai-s3.mark79.cn` 下载，不经过业务后端转发。R2 自定义域名不等于中国大陆 CDN 节点，实际国内速度需实测，当前不承诺国内高速。

## 检测、下载和安装行为

- 首选公开 GitHub Releases API，仅检查 `android-vX.Y.Z`，排除草稿与预发布。
- GitHub 请求失败或限流时读取对象存储的发布快照；快照只在 GitHub 正式发布后生成，GitHub 仍是版本来源。快照缓存 60 秒。
- 每次冷启动后台检查；应用从后台返回前台时再次检查；GitHub 查询超过 8 秒转到备用清单，自动检查失败后按 4、8、16 秒有限重试。取消原有跨启动的 12 小时跳过规则。
- 发现新版本后等待启动完成、其他页面或弹窗关闭，再显示更新提示；可下载或选择“稍后再说”。同一次前台使用中，同一版本仅自动提醒一次，重新打开 App 可再次提醒；手动检查不受此限制。没有后台定时唤醒或实时推送。
- 自动检查失败静默，手动检查失败提供中文提示。调试版跳过正式更新。
- 展示版本、说明、文件大小和下载渠道，默认选“加速下载”；下载前、下载失败后可以切换渠道再重试。
- 显示进度，可取消。取消/失败清理临时文件，支持重新下载，暂不支持断点续传。
- 大小和 SHA-256 校验通过后，原生端再验证包名、版本递增和相同签名。
- 首次引导开启安装来源权限，返回后继续打开系统安装器，用户必须确认安装；不是静默安装。
- 下一次启动清理旧 APK 缓存。正常同签名覆盖升级保留应用数据，仍需两次真实版本安装验收登录保持。

## 本地预览

退出正在运行的 Flutter，再执行 `pnpm android --dart-define=MARKAI_PREVIEW_UPDATE=true`。弹出模拟 1.0.3，支持选择渠道和约 3 秒模拟进度，不下载/安装真实 APK，也不修改真实检查时间。正式 release 包不能启用此模式。退出后普通 `pnpm android` 恢复。

## 两次正式版本验收

第一次手动发布并安装 `1.0.2`，登录并保留一段会话。随后做小修改并发布 `1.0.3`：

1. 在旧 App 设置中检查更新，确认看到 1.0.3 和对应说明。
2. 选择 GitHub 验证下载/取消，再选择加速下载验证完整下载和安装。
3. 在系统确认覆盖安装，启动后确认设置版本 1.0.3、登录和历史会话保持。
4. 再检查更新，不应重复提示；断网检查应显示可重试提示。

对象存储、多渠道代码和配置验证不等于已完成上述两次真实版本的覆盖升级验收；该流程仍需在用户设备上验证。

参考：[Android 版本字段](https://developer.android.com/studio/publish/versioning)、[GitHub Releases API](https://docs.github.com/en/rest/releases/releases)、[R2 公共域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)。
