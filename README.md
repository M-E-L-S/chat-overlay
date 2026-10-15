# LAPLACE Chat Overlay · 本地加固版

基于 [laplace-live/chat-overlay](https://github.com/laplace-live/chat-overlay) 的 Windows x64 个人 fork，保留原有透明悬浮窗、置顶、鼠标穿透、弹幕与礼物样式。

本版本关闭自动更新，增加窗口、IPC、网络和事件输入防护，并统一管理官方 Event Bridge：打开悬浮窗会启动桥接器，正常关闭时一并停止。

## 使用

双击 `out/LAPLACE Chat Overlay-win32-x64/chat-overlay.exe`，保留整个目录。

首次在 **Settings → Server Settings** 复制连接令牌；在 [LAPLACE Chat](https://chat.laplace.live) 的桥接设置中填写 `ws://127.0.0.1:9696` 和令牌，然后保持网页运行。生产者网页来源仅允许 `https://chat.laplace.live`。

详细说明见 [本地运行](docs/local-run.md)。程序与上游产品名称相同，本 fork 的 overlay 未使用作者签名；内附桥接器为固定版本的官方已签名程序。

## 从源码构建

需要已有 Node.js 24 和仓库指定的 pnpm。无需 Go、Bun、Docker 或额外原生编译工具链。

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm bridge:prepare
# Electron 单独准备，保持包内校验值；缓存位置可自行指定。
$env:electron_config_cache = Join-Path (Split-Path $PWD -Parent) '.cache/electron'
node node_modules/electron/install.js
pnpm typecheck
pnpm lint
pnpm test:security
$env:NODE_ENV = 'production'
pnpm package
```

`bridge:prepare` 仅在文件缺失时下载官方 0.3.21 到 `resources/bridge/leb-server-windows-x64.exe`，下载后检查固定 SHA-256；已有文件只校验、不替换。下载位置会打印到终端。打包前请先执行此命令。

GitHub Actions 仅检查 Windows 目录构建与安全测试，不自动签名、发布或更新程序。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `src/` | 窗口、界面、加固逻辑和开发预览数据 |
| `resources/bridge/` | 官方桥接器来源、许可证；exe 不提交 Git |
| `scripts/prepare-bridge.mjs` | 固定版本桥接器准备与校验 |
| `tests/` | 安全回归和桌面检查 |
| `docs/` | 使用说明、验证记录和清理范围 |
| `.changeset/` | 用户可见变更记录 |

`node_modules/`、`out/`、`.cache/`、`runtime/` 和程序二进制不提交。已验证版本记录见 [验证说明](docs/validation.md)。保留的 `CHANGELOG.md` 为上游历史，后续行为修改使用 Changesets 记录。

## 来源与许可

原作者及版权信息保留。overlay 与官方桥接器均遵循 AGPL-3.0，详见 [LICENSE](LICENSE)、[桥接器许可证](resources/bridge/LICENSE) 和 [桥接器来源](resources/bridge/ORIGIN.md)。
