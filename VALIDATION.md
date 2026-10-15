# 本地整合版验证记录

2026-10-15，Windows x64，Node v24.16.0，Electron 44.7.0，官方桥接器 0.3.21。

- TypeScript 全项目 `tsc --noEmit`：通过。
- ESLint 全项目：0 error，1 个原有 warning（events.tsx 内原本未使用的 renderMessage）。
- `git diff --check`：通过。
- 安全测试 4 项：全部通过，包括真实官方桥接器的启动、认证广播、拒绝错误令牌/错误网页 Origin、端口冲突和关闭清理。
- 原仓库 29 条预览事件：全部通过事件校验；真实 Electron renderer 收到并渲染了 29 行。
- 真实 Electron 桌面检查：设置面板、托管只读配置、沙箱、Node 隔离、localStorage 不保存令牌、IPC 类型拦截、置顶和穿透切换，以及 CSP 阻止非许可外部请求均通过。
- 桌面截图已人工查看：.cache/qa/overlay.png、settings.png、bridge-settings.png。没有修改原项目 CSS 或弹幕文案/布局；加了不额外生成 DOM 的单事件错误边界。
- Forge 生产 `package`：通过，未安装额外原生编译工具链。
- 直接运行最终打包的 chat-overlay.exe：主窗口启动成功；恰好一个托管桥接进程；公开入口仅监听 127.0.0.1；正常关闭窗口后进程退出，桥接子进程与 9696 监听均消失。结果在 .cache/qa/packaged-result.json。
- 官方桥接器：下载摘要与固定值一致，Windows 签名 Valid；打包后内附 exe 摘要仍相同。
- Electron：镜像下载文件与官方预置摘要一致，打包器从本地缓存构建。

未代替用户登录官方网页、选择真实直播间或修改浏览器本地网络权限。网页的真实业务流仍需用户在自己浏览器内首次填写桥接地址和令牌；本轮已用同样 Origin、子协议及认证方式验证实际桥接链路。

普通客户端的非网页 Origin（file://、null 或无 Origin）只允许接收角色；发送角色仅允许精确的 https://chat.laplace.live。此限制针对浏览器，不是对本机恶意进程的身份认证。
