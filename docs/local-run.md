# 本地加固整合版

双击 `out/LAPLACE Chat Overlay-win32-x64/chat-overlay.exe` 即可。
请保留整个目录，不能只移动 exe；官方桥接器在 `resources/bridge` 中。

## 首次连接网页

1. 打开悬浮窗右上角设置菜单，进入 Settings，向下滚动到 Server Settings。
2. 点击“复制网页连接令牌”，再点击“打开官方网页”。
3. 在 LAPLACE Chat 网页启用 Event Bridge，地址填写 `ws://127.0.0.1:9696`，认证填写刚复制的令牌；在网页选择实际直播间。
4. 保持网页运行。overlay 会自动连接同一桥接器，不需要再手动启动桥接程序。

网页侧必须从 `https://chat.laplace.live` 发起桥接连接。其他网页、HTTP 官网地址、仿冒子域名均会被入口拒绝。浏览器若询问访问本地网络，请仅对该官方网站按需授权，无需关闭整个浏览器的安全设置。

Allowed Rooms 仍是原有的直播间 ID 过滤，可留空；它与网页 Origin 检查是两件事。

## 一次启动的具体含义

一个入口自动启动 overlay 与后台官方桥接器，正常关闭 overlay 会一并停止自己的桥接器；不会终止其他程序。整合包仍包含两个进程，不需要用户分别操作。

公开入口只绑定 `127.0.0.1:9696`，检查 Host、随机独立令牌、网页 Origin 和生产者角色。真实官方桥接器由 overlay 启动在另一个随机回环端口，使用每次新生成的另一枚私有令牌；因此不能拿网页令牌直接绕过入口访问后端。

端口被占用时会明确报错，不会接管或终止已有服务。桥接器意外退出时会提示并关闭 overlay，重新打开即可。如果整个 overlay 进程被强制结束或系统崩溃，常规退出清理无法保证执行；可在任务管理器结束遗留的 `leb-server-windows-x64.exe`。

## 本地安全修改

- 移除自动更新及安装器启动钩子；不从作者后续版本自动替换本地构建。
- 后台桥接器固定官方 `0.3.21`，每次启动核对 SHA-256；没有下载器或更新器。
- 随机令牌在 Windows 上用 Electron safeStorage/DPAPI 加密保存，不写 localStorage；不打印令牌或完整弹幕日志。
- Electron 沙箱、上下文隔离、IPC 发送者与参数检查；拒绝新窗口、导航、webview、权限请求和下载。
- CSP 禁止外部脚本、对象、嵌入页面和 worker。桥接连接固定回环入口；图片/字体允许 B 站及 LAPLACE 的 HTTPS CDN（hdslb.com、biliimg.com、bilibili.com、laplace.live 及其子域名），以及本地 data/blob 图片。自定义 CSS 的普通样式保持可用，从其他域名加载外部资源会被阻止。
- 对畸形、过深或异常巨大的事件做运行时校验；单条渲染异常不会拖垮整个列表。合法消息不截断、不改文案或配色。

透明背景、置顶、鼠标穿透、字号、礼物/表情与既有布局未作重设计。服务设置的本机地址与令牌由程序管理，因此在整合模式下只读；网页令牌可用按钮复制。

Origin 只限制浏览器来源，本机程序仍可以伪造 Origin。入口保留连接数与握手超时限制，但不会改写官方桥接器的 WebSocket 协议；它不是抵御已获授权恶意官方网页的隔离环境。

## 存储位置

- 新工具/官方桥接器：本项目 `resources/bridge/leb-server-windows-x64.exe`。
- Electron 下载缓存：`D:\codes\Web\LaplaceChat\.cache\electron`；开发运行时解压在本项目 `node_modules/electron/dist`。
- 成品目录：本项目 `out/LAPLACE Chat Overlay-win32-x64`。
- 实际使用的数据、加密令牌及日志：成品 exe 同目录下的 `runtime`。
- 开发检查的 profile：`D:\codes\Web\LaplaceChat\runtime`；检查截图和报告：本项目 `.cache/qa`。
- 既有 pnpm 沿用默认全局缓存，不新装 Go、Bun、Docker 或 Visual Studio。

官方桥接器 SHA-256：`f312bc92ff9988a6753a2d53745baea8af9dce9c17f4f94b105892ab98594ab1`。
下载时验证 Windows Authenticode 状态为 Valid，签名者为 Sparanoid, Inc.。
Electron 44.7.0 Windows x64 包 SHA-256：`eee30dc8fa1f5ea95490e59f44e46ea68dd24c6e93d22facf70fe5c2d4c2665c`，从 Electron 文档列出的 npmmirror 镜像下载，并与官方包内校验表及 GitHub 资产摘要核对一致。
本地修改后的 overlay 没有作者的代码签名；桥接器仍为未修改的官方已签名程序。

## 构建及验证

已有 Node.js 24 / pnpm：

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm bridge:prepare
# 首次准备 Electron 时设置 electron_config_cache 指向上述缓存，然后执行：
node node_modules/electron/install.js
node node_modules/typescript/bin/tsc --noEmit
pnpm lint
pnpm test:security
$env:NODE_ENV = 'production'
pnpm package
```

依赖安装禁用生命周期脚本，仅显式执行已审阅的 Electron 安装器。包内预置校验表必须保留，不启用“使用镜像提供的新校验值”的选项。不要直接运行原仓库的 `make` 或发布任务。

真实桌面 smoke 检查使用开发 Electron 加载已构建的主进程/renderer，注入原项目的 29 条预览事件并检查设置、IPC、CSP、置顶与穿透切换；测试脚本不会被打进生产 ASAR。没有代替用户登录或操作真实直播间。
