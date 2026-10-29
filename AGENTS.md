# HiJapan 开发规则

1. 本项目是 Windows 桌面端优先的 Electron 本地软件，不建设业务后端。
2. 修改前先阅读 `日语学习助手项目书.md` 和 `软件开发Coding计划_v1.1.md`。
3. `source` 是教材编辑源；不得为了让测试通过而修改日语内容。
4. 未经人工审核的内容只能保持 `draft_needs_native_review`，正式发布检查必须拒绝草稿。
5. 渲染层不得直接访问 Node、SQLite、文件系统、`safeStorage` 或第三方 AI API。
6. preload 只能暴露逐项类型化 IPC，禁止暴露通用 `ipcRenderer`。
7. API Key 不得以明文进入源码、Git、SQLite、日志、测试快照或备份。
8. 领域规则应保持纯 TypeScript，并配套单元测试。
9. 每次修改后运行相关的 content validate、typecheck、lint 和 test。
10. 保留用户现有改动，不使用破坏性 Git 命令。
11. 每次任务完成后必须更新根目录 `APP开发日志.md`，记录日期、任务目的、实际修改、验证结果和未验证事项；发布版本时整理进对应版本章节。
12. 每次任务结束前评估 `README.md`、`README_USER.md` 和 `README_AUTHOR.md` 是否受影响；只更新确实相关的 README，并在开发日志中说明判断结果。
