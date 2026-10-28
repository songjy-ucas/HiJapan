# ADR 0001：Windows Electron 桌面架构

状态：接受

## 决策

首版使用 Electron + React + TypeScript + Vite，Windows 桌面端优先。课程和进度使用主进程 SQLite；AI 使用 BYOK 并由主进程直连用户选择的服务商；不部署业务服务器。

## 原因

- 用户明确需要可从 GitHub 下载并在电脑安装的本地软件。
- Electron 使用统一 TypeScript 技术栈，便于 Codex 开发和后续维护。
- SQLite、文件备份、系统加密和桌面安装包都有成熟路径。

## 约束

- main/preload/renderer 严格分层。
- 不加载远程界面代码。
- 不在渲染层启用 Node。
- macOS/Linux 必须在对应系统真实构建和验收后才声明支持。
