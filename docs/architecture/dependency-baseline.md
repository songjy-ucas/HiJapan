# 依赖基线

创建日期：2026-10-28

- Electron 45.1.0
- Electron Forge 8.0.1
- Node.js（Electron 内置）24.22.1
- React 19
- Vite 8
- TypeScript 6
- SQLite：Node.js 内置 `node:sqlite`，仅在 Electron 主进程使用
- 密钥加密：Electron 异步 `safeStorage` API
- 单元测试：Vitest + React Testing Library
- E2E：Playwright Electron

渲染层设置：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。所有系统能力通过最小 IPC 白名单调用。
