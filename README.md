# HiJapan 日语随行

Windows 桌面端优先、纯本地、无自建后端的日语学习软件。

## 当前开发版包含

- 酒店、餐厅、购物、景点四个旅行场景，共 20 课。
- 438 个词汇、231 条语句、30 个微语法、12 组固定对话。
- 本地 SQLite 学习记录、今日计划和间隔复习。
- 系统日语 TTS。
- 用户自带 API Key 的 OpenAI-compatible 文字对话和结构化复盘。
- 本地备份、恢复和全部数据删除。

> 当前教材状态为 `draft_needs_native_review`，只能用于开发和功能测试，不能作为正式发布内容。

## 开发环境

- Node.js 24
- npm
- Windows 10/11

```powershell
npm install
npm run content:validate
npm run typecheck
npm test
npm start
```

构建开发安装包：

```powershell
npm run make:win
```

正式发布检查会主动拒绝尚未审核的教材：

```powershell
npm run release:check
```

## 本地数据与隐私

- SQLite、备份和教材均保存在本机。
- API Key 由 Electron 主进程通过 Windows 系统加密能力保存。
- API Key 不进入 SQLite、日志或备份。
- 普通课程、计划和复习不调用 AI。
- 只有用户主动测试连接或使用 AI 对话时才会连接用户填写的服务商。

## 许可证状态

项目所有者尚未选择开源许可证，因此当前 `package.json` 标记为 `UNLICENSED`。在许可证明确前，请勿把该仓库当作已授权的开源项目重新分发。
