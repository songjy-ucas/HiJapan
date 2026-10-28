# HiJapan 日语随行

<p align="center">
  <img src="src/assets/app-icon-master.png" width="132" alt="HiJapan 图标" />
</p>

HiJapan 是一款 Windows 桌面端优先、纯本地、无自建后端的日语学习软件。普通课程、学习记录、今日计划和间隔复习都在用户电脑上运行；只有用户主动配置并使用 AI 对话时，软件才会连接用户选择的 OpenAI-compatible API。

> 当前版本：`0.1.0 开发预览版`。教材仍处于 `draft_needs_native_review` 状态，适合功能体验和协作开发，不应视为已完成日语专业审校的正式教材。

![HiJapan 启动画面](src/assets/splash-background.png)

## 当前功能

- 酒店住宿、餐厅点餐、购物付款、景点预约四个重点旅行场景，共 20 课。
- 438 个词汇、231 条语句、30 个微语法和 72 行固定对话。
- 今日学习计划、课程学习器、系统日语朗读、难点标记和间隔复习。
- 用户自带 API Key 的文字角色对话与结构化复盘。
- API Key 使用 Windows 系统加密能力保存，不写入 SQLite、日志或备份。
- 本地学习数据备份、恢复和全部数据删除。
- JLPT 数据结构和界面方向已预留；未经审核的 N5—N1 题库不会由 AI 临时生成。

## 应该下载哪个文件

请在 GitHub 仓库右侧的 **Releases** 页面选择对应版本：

| 文件                                   | 适合谁                          | 使用方式                                              |
| -------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| `HiJapan 日语随行-x.y.z Setup.exe`     | 大多数 Windows 用户，推荐       | 双击安装，之后从开始菜单启动                          |
| `HiJapan 日语随行-win32-x64-x.y.z.zip` | 不想安装或需要放在 U 盘中的用户 | 解压全部文件，再运行文件夹内的 `HiJapan 日语随行.exe` |
| `SHA256SUMS.txt`                       | 需要验证下载完整性的用户        | 使用 `Get-FileHash` 对照 SHA-256                      |

本地构建出的 `0.1.0` 预览产物位于 `dist/0.1.0-preview/`。该目录默认不提交到 Git。

安装版和便携版的功能相同。普通用户不需要安装 Node.js、数据库或服务器，也不需要配置开发环境。当前安装包尚未进行商业代码签名，Windows SmartScreen 可能显示“未知发布者”；请只从项目官方 Releases 下载。

完整安装、首次启动、AI 配置和各功能操作请阅读：[用户使用说明](README_USER.md)。

## 开发环境

- Windows 10/11 64 位
- Node.js 24
- npm（使用仓库内的 `package-lock.json` 锁定依赖）

```powershell
git clone <仓库地址>
cd HiJapan
npm ci
npm run content:validate
npm run typecheck
npm run lint
npm test
npm start
```

生成 Windows 安装包和便携压缩包：

```powershell
npm run make:win
```

若所在网络无法访问 Electron 的默认下载源，可在当前 PowerShell 会话中设置镜像后再构建：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm run make:win
```

项目结构、进程边界、数据库、IPC、内容包和发布流程请阅读：[开发者说明](README_AUTHOR.md)。

## 隐私与联网边界

- SQLite 数据库、学习记录和复习队列只保存在本机。
- 课程学习、固定对话和复习无需 AI，也不会调用 AI API。
- 用户只有在测试连接、发送自由对话或请求复盘时才会连接所填写的 AI 服务商。
- API Key 由 Electron 主进程通过 Windows 系统加密能力保存；渲染页面不能读取完整 Key。
- 导出的学习备份不包含 API Key，恢复备份后需要重新配置。

## 文档入口

- [用户使用说明](README_USER.md)：面向安装和使用软件的人。
- [开发者说明](README_AUTHOR.md)：面向维护、扩展和发布项目的人。
- [项目书](日语学习助手项目书.md)：产品目标、范围和阶段规划。
- [Coding 计划](软件开发Coding计划_v1.1.md)：实现原则、模块拆分和验收要求。
- [0.1.0 预览版说明](docs/releases/0.1.0-preview.md)：当前交付内容和限制。

## 许可证状态

项目所有者尚未选择开源许可证，因此当前标记为 `UNLICENSED`。公开仓库不自动等于授权他人复制、修改或分发；选择许可证后应同步更新本节和 `package.json`。
