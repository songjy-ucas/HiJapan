# HiJapan 开发者说明

本文档面向项目作者、贡献者和后续维护者，说明代码结构、进程边界、数据流、开发命令和发布约束。产品需求以 `日语学习助手项目书.md` 为准，实现细则以 `软件开发Coding计划_v1.1.md` 为准。

## 1. 技术定位

HiJapan 是本地优先的 Windows Electron 桌面应用，不建设业务后端。

- **Electron 主进程**：窗口、SQLite、文件、系统安全存储和外部 AI 请求。
- **Preload**：把有限、逐项、类型化的 IPC 方法暴露给页面。
- **React 渲染层**：界面和用户交互，不直接访问 Node、文件系统、数据库或第三方 API。
- **Domain**：纯 TypeScript 的计划和复习算法，不依赖 Electron 或 React。
- **Content pack**：版本化教材源和运行时 JSON 内容包。

关键安全设置位于 `src/main.ts`：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webSecurity: true`，同时拒绝新窗口、页面跳转和权限请求。Windows 默认调用 `app.disableHardwareAcceleration()`，避免部分显卡驱动在 Electron 首帧出现绿色或黑色合成纹理；本应用没有视频或 3D 场景，软件渲染适合当前功能。

## 2. 目录与文件职责

```text
HiJapan/
├─ src/
│  ├─ main.ts                    Electron 启动、窗口和安全策略
│  ├─ preload.ts                 类型化 IPC 桥接
│  ├─ renderer.tsx               React 入口
│  ├─ index.css                  全局界面、启动页和响应式样式
│  ├─ assets/
│  │  ├─ app-icon-master.png     图标母版
│  │  ├─ app-icon.ico            Windows 多尺寸图标，由脚本生成
│  │  └─ splash-background.png   启动背景
│  ├─ main/
│  │  ├─ database.ts             SQLite 迁移、教材导入、进度和对话记录
│  │  ├─ ipc.ts                  IPC 白名单、参数校验和调用编排
│  │  ├─ credentials.ts          safeStorage 加密保存 API Key
│  │  ├─ ai-provider.ts          OpenAI-compatible 请求与响应校验
│  │  └─ backup.ts               本地备份导入/导出
│  ├─ renderer/
│  │  └─ App.tsx                 首次配置、学习、复习、对话和设置页面
│  ├─ domain/
│  │  ├─ content-schema.ts       Zod 教材 Schema
│  │  ├─ conversation.ts         对话保留期限和日语朗读文本提取
│  │  ├─ kana.ts                 五十音课程、题库约束和翻牌组牌规则
│  │  ├─ planning.ts             今日计划规则
│  │  └─ review.ts               间隔复习规则
│  └─ shared/
│     └─ contracts.ts            主进程与渲染层共享的类型契约
├─ source/
│  ├─ data/                      CSV 编辑源和运行时 JSON 内容包
│  └─ 教学内容总纲_v0.1.md       教学范围与内容说明
├─ scripts/
│  ├─ content/validate-content.mjs  教材引用、计数和发布状态检查
│  └─ assets/build-icons.mjs       PNG 转 Windows ICO
├─ tests/                        Vitest 单元测试
├─ docs/
│  ├─ architecture/              架构基线
│  ├─ decisions/                 ADR 架构决策
│  └─ releases/                  版本说明
├─ forge.config.mts              Electron Forge 打包、Maker 和 Fuses
├─ APP开发日志.md                各版本功能、修复、验证与开发中事项
├─ vite.*.config.mts             主进程、preload、renderer 构建配置
├─ package.json                  依赖和开发命令
├─ README.md                     GitHub 项目首页
├─ README_USER.md                普通用户操作手册
└─ README_AUTHOR.md              本文档
```

## 3. 启动与数据流

1. Electron 创建隐藏的主窗口并加载 Vite renderer。
2. 主进程初始化 SQLite、执行可重放迁移并事务导入内容包。
3. renderer 准备完成后显示窗口，React 以固定最高层展示至少约 2.6 秒启动背景，并等待本地快照完成，避免主界面中间帧和合成纹理暴露。
4. React 通过 `window.hiJapan` 调用 preload 暴露的 API。
5. preload 只发送固定 IPC channel；主进程验证发送方和输入后执行数据库、文件或网络操作。
6. 主进程返回经过 Schema 和类型约束的数据，renderer 更新页面。

不要在 React 中导入 `electron`、`node:*`、数据库实现或 AI SDK，也不要把通用 `ipcRenderer` 暴露给页面。

## 4. 本地数据库

`src/main/database.ts` 使用 Node 24 的 `node:sqlite`，默认数据库位于 `app.getPath('userData')/hijapan.sqlite`。

主要逻辑表：

- `app_meta`：内容版本和状态。
- `profiles`：本地学习配置。
- `content_items`、`lessons`、`lesson_items`：教材和课程编排。
- `lesson_progress`、`learning_events`、`review_states`：学习与复习状态。
- `kana_progress`：五十音课程标记完成与可选游戏的完成状态。
- `ai_provider_settings`：不含完整 Key 的普通 AI 配置。
- `conversation_sessions`、`conversation_messages`：自由对话记录；按最后活动时间仅保留近 7 天，启动、查询、导入和导出前执行清理。

数据库只允许主进程访问。教材导入必须使用事务，内容更新不能破坏已有学习进度。

## 5. 教材工作流

- `source` 是教材编辑源，不要为了让测试通过而修改日语内容。
- 当前计数基线：438 词汇、231 语句、30 语法、72 对话行、20 课程。
- `travel_priority_content.json` 是应用运行时导入的内容包。
- `kana_course.json` 是五十音编辑源与运行时内容，包含 5 节、46 个清音假名和分阶段词例。
- 五十音词例的平假名读音不得包含当前课尚未学习的假名；`content:validate` 和 `tests/kana.test.ts` 同时检查该规则。
- 五十音课程入口不做强制解锁，允许用户直接学习、连线、翻牌或标记掌握；第一节必须隐藏累计复习入口。
- `uta-card-torii.png` 和 `uta-card-sakura.png` 是翻牌游戏使用的竖版和纸牌背，替换时应保持约 2:3 比例、无文字且在 150 px 高度仍清晰。
- 所有 ID 必须稳定，课程引用必须存在，CSV 和 JSON 需要保持一致。
- 未经专业审核的项目必须保留 `draft_needs_native_review`。

开发校验：

```powershell
npm run content:validate
```

正式发布闸门：

```powershell
npm run release:check
```

草稿存在时，正式发布闸门失败是预期行为，不得通过删除校验或伪造审核状态绕过。

## 6. AI 与凭据边界

普通课程模块不得依赖 AI Provider。

AI 配置流程：

1. renderer 收集 Base URL、模型 ID 和 API Key。
2. IPC 把输入交给主进程。
3. 主进程验证 URL，只允许 HTTPS；本机开发地址可例外使用 HTTP。
4. `credentials.ts` 使用异步 `safeStorage.encryptStringAsync()` 保存 Key 密文。
5. SQLite 只保存 Base URL、模型 ID、Key 末尾提示和测试时间。
6. `ai-provider.ts` 在主进程中调用 OpenAI-compatible `chat/completions`。
7. AI 结构化反馈必须通过 Zod 校验后才能进入应用。

自由对话 Prompt 要求每句日语紧跟全角括号内的中文翻译。`src/domain/conversation.ts` 负责把显示文本转换为仅含日语的系统 TTS 文本；renderer 不应把完整双语回复直接交给 `speechSynthesis`。历史记录通过类型化 IPC 查询，已结束会话只读，未结束会话可以恢复。

完整 Key 不得进入 renderer、SQLite、日志、测试快照、备份或 Git。自动测试不得调用真实 AI API。

## 7. 视觉资产工作流

`src/assets/app-icon-master.png` 是图标母版。生成 Windows ICO：

```powershell
npm run assets:icon
```

脚本使用 `png-to-ico` 生成 `src/assets/app-icon.ico`。`forge.config.mts` 同时把它用于可执行文件和 Squirrel 安装包。

`src/assets/splash-background.png` 由 `src/index.css` 的 `.splash-screen` 使用。替换背景时应保持 16:9、安全边距和中央标题可读性，并在常用窗口尺寸上做实际启动检查。

所有项目使用的最终图片必须保存在仓库内，不能只引用临时目录或生成工具缓存路径。

## 8. 开发命令

首次安装：

```powershell
npm ci
```

日常开发：

```powershell
npm start
```

提交前检查：

```powershell
npm run content:validate
npm run typecheck
npm run lint
npm test
npm audit --audit-level=high
```

打包：

```powershell
npm run package
npm run make:win
```

`package` 生成解包后的应用目录，`make:win` 生成 Squirrel 安装包和 Windows ZIP 便携包。输出位于 `out/`，该目录不提交 Git。

若受限环境使 Electron Packager 无法完成临时目录重命名，只能在已经生成生产 `.vite` 和 `app.asar` 后采用手动便携回退。复制原始 Electron 运行时并准备好 EXE 后，必须执行：

```powershell
node scripts/package/finalize-portable.mjs `
  '.\path\HiJapan 日语随行.exe' `
  '.\path\resources\app.asar' `
  '0.1.5' `
  '.\src\assets\app-icon.ico'
```

该脚本先将 `resources/app.asar` 的真实头摘要写入 Windows PE 的 `INTEGRITY/ELECTRONASAR` 资源，再启用既定 Fuses。不得只用普通 `rcedit` 设置图标和版本后就交付：当 `EnableEmbeddedAsarIntegrityValidation` 与 `OnlyLoadAppFromAsar` 已启用但 EXE 缺少匹配摘要时，应用会在窗口创建前退出。脚本要求输入未写入完整性记录的原始 EXE，以避免重复资源。

Electron Packager 的下载缓存固定在 `node_modules/.cache/electron`，避免受受限环境的系统缓存目录权限影响；该缓存随 `node_modules` 一起保持在 Git 之外。

## 9. 测试策略

- `tests/content.test.ts`：内容 Schema、计数和引用。
- `tests/planning.test.ts`：每日时间预算和任务排序。
- `tests/review.test.ts`：间隔复习状态变化。
- `tests/conversation.test.ts`：7 天保留截止时间和日语朗读文本提取。
- `tests/conversation-database.test.ts`：本地对话查询、过期清理和删除。
- 主进程安全边界、备份和 AI Provider 后续应增加集成测试。
- 每个发布候选版本应实际启动打包后的 `.exe`，检查首次启动、课程、复习、设置和窗口缩放。

不要让测试依赖公网、真实 API Key、用户已有数据库或系统特定时间。

## 10. 发布检查清单

1. 更新 `package.json` 版本号。
2. 更新 `APP开发日志.md`，并按实际影响更新三份 README 和 `docs/releases/`。
3. 运行内容、类型、格式、测试和安全审计。
4. 确认教材审核状态；正式版必须通过 `npm run release:check`。
5. 运行 `npm run make:win`。
6. 启动安装版和便携版做冒烟测试。
7. 生成 SHA-256 校验文件。
8. 在 GitHub Release 上传 `Setup.exe`、ZIP 和 `SHA256SUMS.txt`。
9. 在获得代码签名证书后，为正式安装包签名。

每次任务即使不发布新版本，也必须在 `APP开发日志.md` 的“开发中”部分记录实际变化和验证结果。用户功能、安装方法、项目结构或开发流程没有变化时，对应 README 可以不修改，但应在开发日志中说明判断。

## 11. Git 与许可证

- 不提交 `node_modules/`、`out/`、`dist/`、SQLite、凭据文件、日志或本地备份。
- 不覆盖与当前任务无关的用户修改，不使用破坏性 Git 命令。
- 当前项目为 `UNLICENSED`；选择许可证前，不要在文档中宣称已经开源授权。
- 选定许可证后，需要添加 `LICENSE`，并同步更新 `package.json` 和三份 README。
