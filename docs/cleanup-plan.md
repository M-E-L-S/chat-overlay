# 已确认的仓库清理清单

用户于 2026-10-15 明确批准按以下清单删除。已完成删除并同步构建引用。

仅删除以下已纳入 Git 历史的旧文件；可从清理前的提交 05d8bca 恢复。当前运行程序、resources/bridge/leb-server-windows-x64.exe、runtime、out、node_modules 及下载缓存均不在删除范围。

已先移除 Forge 对跨平台安装器、签名和 desktop.ejs 的引用；准备替换上游专用 CI。保留 src/dev、全部实际事件组件、安全测试、两份许可证及上游历史。

- `.claude/skills/debug-on-ubuntu-vm/SKILL.md`
- `.github/workflows/build.yml`
- `.github/workflows/release.yml`
- `.mcp.json`
- `docs/screenshots.md`
- `entitlements.plist`
- `resources/desktop.ejs`
- `screenshots/hero.png`
- `screenshots/settings.png`
- `scripts/debug-build-env.ts`
- `scripts/export-certificate.sh`
- `scripts/generate-icons.mts`
- `scripts/screenshots.mts`
- `scripts/screenshots/art.mts`
- `scripts/screenshots/bridge.mts`
- `scripts/screenshots/config.mts`
- `scripts/screenshots/harness.mts`
- `scripts/screenshots/shots.mts`
- `scripts/screenshots/showcase.mts`
- `src/assets/icon-dev.png`
- `src/assets/icon.icns`
- `src/assets/icon.ico`
- `src/assets/icon.png`
- `src/assets/icons/dev/icon.icns`
- `src/assets/icons/prod/icon.icns`
- `src/assets/icons/prod/icon.icon/Assets/logo-v2-apple-solid-2.png`
- `src/assets/icons/prod/icon.icon/Assets/logo-v2-apple-solid-3.png`
- `src/assets/icons/prod/icon.icon/Assets/logo-v2-apple-solid-4.png`
- `src/assets/icons/prod/icon.icon/icon.json`
- `src/components/ui/loading.tsx`
- `src/utils/timefrom-now.ts`
