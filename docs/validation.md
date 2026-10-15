# 本地整合版验证记录

2026-10-15，Windows x64，Node v24.16.0，Electron 44.7.0，官方桥接器 0.3.21。

- TypeScript 全项目 `tsc --noEmit`：通过。
- ESLint 全项目：原验证为 0 error、1 warning；仓库清理后已移除未调用的 renderMessage，现为 0 error、0 warning。
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

## 仓库清理后的复核

仅清理未引用文件、旧发布工具及依赖，保留程序显示逻辑和 CSS。
锁文件可达 snapshot 从 630 减至 569，保留依赖的版本与清理前一致。
类型检查、ESLint、安全测试和独立目录生产构建通过；未覆盖使用中的 out 和 runtime。
桌面检查可在完成 package 后执行 `pnpm test:desktop`，会直接生成原项目预览数据，无需预先存在的缓存文件。

## 显示开关修复

原消息列表未读取 Show Interaction Events、Show Free Gifts 和 Show Entry Effects，设置保存后没有参与渲染过滤。现已将三个开关接入实际列表，切换后已有消息与新消息均立即遵循设置；过滤后没有可见消息时显示正常的等待提示。

`pnpm test:display` 使用隔离 profile、模拟 WebSocket/fetch 和隐藏 Electron 窗口，通过真实设置面板验证普通进入/关注等互动、点赞、免费礼物和独立入场特效的开关，确保重新启用时恢复消息。测试不连接真实桥接器或直播网页。
