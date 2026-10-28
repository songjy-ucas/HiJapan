# 「日语随行」软件开发 Coding 计划

> 版本：v1.0  
> 日期：2026-10-28  
> 项目目录：`G:\小玩意\HiJapan`  
> 适用对象：项目所有者、Codex、后续参与开发与审核的人员  
> 目标：指导 Codex 从空代码目录开始，逐阶段完成一个纯本地、无自建后端、可发布到 GitHub 的日语学习 App

---

## 0. 当前状态与本计划的作用

项目当前已经具备：

- 产品项目书：`日语学习助手项目书.md`。
- 教学内容总纲：`source/教学内容总纲_v0.1.md`。
- 旅游重点场景内容：酒店、餐厅、购物、景点四类 CSV、JSON 和审阅工作簿。
- 首批内容合计：438 个词汇、231 条语句、29 个微语法、72 行对话、20 课。

项目当前尚未具备：

- Expo 应用代码。
- SQLite 数据库和迁移。
- 内容导入与校验脚本。
- 学习、复习、测试、AI 对话和备份模块。
- 自动化测试、安装包和 GitHub 发布流程。

本文件不是产品愿景文档，而是工程实施文件。Codex 应按本文件的阶段和验收条件执行，不应一次性生成整个应用，也不应在基础设施未验证前直接制作大量页面。

### 0.1 最重要的工程结论

1. 本项目是安装在用户设备上的本地 App，不建设业务服务器。
2. 课程、进度、复习、测试结果和设置保存在本地 SQLite。
3. API Key 只保存在系统安全凭据区，不进入 SQLite、普通文件、备份或日志。
4. 旅游和 JLPT 的常规学习完全不依赖 AI。
5. 自由对话、用户主动授权的测试分析才直接调用用户配置的 AI API。
6. GitHub 用于托管源码、版本说明和安装包，不充当业务后端。
7. 首个可交付平台以 Android 为主；保持 iOS 兼容，但 iOS 安装受苹果签名规则限制。

---

## 1. MVP 范围冻结

### 1.1 首版必须实现

- 首次启动与本地用户档案。
- AI API 配置页，可跳过；支持 OpenAI-compatible 配置。
- 普通需求问卷；配置 AI 后可选择 AI 访谈。
- 旅游模式的课程列表、词汇、语句、微语法和固定场景练习。
- 本地学习进度、收藏、学习事件和间隔复习。
- 今日学习计划，由确定性规则生成。
- 固定题库的本地测试框架；首版可先放样例题。
- 用户主动授权后的 AI 测试分析接口。
- AI 自由文字对话和结构化复盘。
- 系统 TTS 或本地可用的朗读能力；内容自带音频以后再替换。
- 本地数据导出、导入和全部删除。
- Android 开发包和可供测试的 release 安装包。
- 基础单元测试、组件测试和关键流程 E2E 测试。

### 1.2 首版明确不做

- 登录注册、用户账号、云同步和 Web 后台。
- 开发者代付的 AI 额度或开发者内置 API Key。
- 社交、排行榜、真人语伴和公开内容社区。
- N4—N1 完整课程。
- 自动从网络下载未经审核的课程。
- AI 自动生成正式考题或把 AI 结论直接写入当前计划。
- 实时低延迟语音通话。首版语音采用“录音/转写/文字回复/朗读”的异步流程，且可在文字对话完成后再开发。

### 1.3 MVP 完成定义

在一台全新 Android 设备上，关闭开发服务器并不配置 AI，用户仍可完成以下流程：

1. 安装并启动 App。
2. 跳过 AI 配置。
3. 选择旅游目标和每天 10 分钟。
4. 打开一节课程。
5. 学习词汇和语句，完成客观练习。
6. 查看本次结果和今日进度。
7. 第二天看到到期复习项目。
8. 导出本地备份，清除数据后再导入恢复。

配置用户自己的 AI API 后，还应能完成：

1. 测试连接。
2. 进入指定场景的自由文字对话。
3. 完成至少 4 轮交互。
4. 结束会话并取得结构化复盘。
5. 把复盘中的表达加入本地复习库。

---

## 2. 技术选型与固定决策

### 2.1 基础技术

| 领域 | 选型 | 决策理由 |
|---|---|---|
| 应用框架 | React Native + Expo + TypeScript | 一套代码覆盖 Android/iOS，适合本地应用和快速迭代 |
| 路由 | Expo Router | 文件式路由，页面结构直观 |
| 数据库 | Expo SQLite | 无服务器、离线可用、支持事务和迁移 |
| 安全凭据 | Expo SecureStore | API Key 不进入普通存储 |
| 本地轻状态 | Zustand | 保存会话期 UI 状态、筛选条件和未提交草稿 |
| 表单校验 | React Hook Form + Zod | 配置页和问卷需要可靠校验 |
| 运行时 Schema | Zod | 校验内容包、数据库边界和 AI JSON |
| UI | React Native 原生组件 + 项目设计令牌 | 避免早期绑定大型 UI 框架 |
| 单元/组件测试 | Jest + React Native Testing Library | 适合 Expo/React Native |
| E2E | Maestro | 适合 Android 关键流程自动化 |
| 代码质量 | ESLint + Prettier + TypeScript strict | 尽早发现类型和风格问题 |
| 包管理 | npm | 降低新手环境复杂度；提交 `package-lock.json` |

实施阶段开始时，Codex 应使用当时的 Expo 当前稳定版本，并将实际版本写入 `docs/architecture/dependency-baseline.md`。不要在本计划中预先猜测未来 SDK 版本，也不要随意使用 beta 或 canary 依赖。

### 2.2 为什么不采用 Web App

- 用户要求直接下载安装和离线学习。
- API Key 需要系统安全凭据存储。
- SQLite、录音、系统 TTS 和文件导入导出在原生 App 中更自然。
- 浏览器环境还会产生 CORS、浏览器存储和离线缓存限制。

### 2.3 为什么不设后端

- 教学内容是随安装包发布的审核内容。
- 学习算法可以在设备本地确定性运行。
- 用户自带 API Key，AI 请求可从 App 直接发往用户选择的服务商。
- 不做账号与跨设备自动同步，就没有必须在线保存的业务状态。

需要明确：无自建后端不等于完全不联网。使用自由对话或 AI 测试分析时，设备仍会连接用户配置的第三方 AI 服务商；普通学习可以全程离线。

---

## 3. 推荐仓库结构

首版使用单应用仓库，避免一开始建立多 App monorepo。

```text
HiJapan/
  app/                         # Expo Router 页面，仅负责组合功能
    _layout.tsx
    index.tsx
    onboarding/
    (tabs)/
      today/
      learn/
      conversation/
      review/
      settings/
    lesson/[lessonId].tsx
    assessment/[assessmentId].tsx
    conversation/[sessionId].tsx
  src/
    components/                # 通用展示组件
    design/                    # 颜色、字号、间距、圆角等令牌
    features/
      onboarding/
      ai-settings/
      today-plan/
      lessons/
      learning-session/
      review/
      assessment/
      conversation/
      backup/
    domain/                    # 与 React/Expo 无关的纯业务规则
      entities/
      review/
      planning/
      assessment/
      conversation/
    data/
      db/
        migrations/
        repositories/
        schema.ts
      content/
        importer.ts
        schemas.ts
        manifest.ts
      secure-store/
      backup/
    services/
      ai/
        provider.ts
        openai-compatible.ts
        prompts/
        schemas/
      audio/
      clock/
      logging/
    stores/                    # Zustand，仅放临时 UI 状态
    hooks/
    utils/
    types/
  assets/
    content/
      content-pack-v1.json
      manifest.json
    audio/
    images/
  source/                      # 教材编辑源文件，现有文件继续保留
    data/
  scripts/
    content/
      normalize-content.mjs
      validate-content.mjs
      build-content-pack.mjs
    release/
  tests/
    fixtures/
    integration/
    e2e/
  docs/
    architecture/
    decisions/
    testing/
    release/
  .github/workflows/
  app.config.ts
  eas.json
  package.json
  tsconfig.json
  AGENTS.md
  README.md
  LICENSE
```

### 3.1 分层依赖规则

允许的依赖方向：

```text
页面 app → feature → domain
                ↓        ↑
              data/services
```

具体约束：

- `domain` 不得导入 React、Expo、SQLite、SecureStore 或任何 AI SDK。
- 页面不得直接执行 SQL，不得直接拼 AI 请求。
- Repository 把 SQLite 行转换为领域实体。
- AI Provider 只负责通信和协议转换，不负责修改学习计划。
- 所有日期通过 `Clock` 接口取得，测试中可以注入固定时间。
- 内容 ID 是跨模块主键，不允许页面用日文文本作为关联键。
- 不创建名为 `api-client` 的远程业务层；AI Provider 是唯一外部网络边界。

---

## 4. 本地数据库设计

SQLite 迁移必须顺序编号并可重复检查，例如：

```text
001_initial.sql
002_assessments.sql
003_conversations.sql
004_backup_metadata.sql
```

每次启动先读取 `schema_migrations`，在事务中执行未应用迁移。禁止通过“删除数据库重新创建”的方式处理正式版本升级。

### 4.1 核心表

#### `app_meta`

- `key TEXT PRIMARY KEY`
- `value TEXT NOT NULL`

保存数据库版本、内容包版本、首次启动状态等非敏感元数据。

#### `profiles`

- `id TEXT PRIMARY KEY`
- `display_name TEXT NULL`
- `native_language TEXT NOT NULL DEFAULT 'zh-CN'`
- `timezone TEXT NOT NULL`
- `estimated_level TEXT NOT NULL`
- `daily_minutes INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

首版本地只保留一个 profile，但仍使用 ID，便于未来迁移。

#### `learning_goals`

- `id TEXT PRIMARY KEY`
- `profile_id TEXT NOT NULL`
- `mode TEXT NOT NULL`
- `target_level TEXT NULL`
- `target_date TEXT NULL`
- `days_per_week INTEGER NOT NULL`
- `settings_json TEXT NOT NULL`
- `status TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

#### `content_items`

- `id TEXT PRIMARY KEY`
- `type TEXT NOT NULL`
- `scene TEXT NULL`
- `level TEXT NOT NULL`
- `priority TEXT NOT NULL`
- `review_status TEXT NOT NULL`
- `content_version TEXT NOT NULL`
- `search_text TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

词汇、语句、语法和对话行统一进入该表，便于复习系统通过一个 `content_id` 引用。类型专属字段仍保存在经过 Schema 校验的 `payload_json` 中。

#### `lessons`

- `id TEXT PRIMARY KEY`
- `scene TEXT NOT NULL`
- `title TEXT NOT NULL`
- `objectives_json TEXT NOT NULL`
- `estimated_minutes INTEGER NOT NULL`
- `level TEXT NOT NULL`
- `priority TEXT NOT NULL`
- `review_status TEXT NOT NULL`
- `content_version TEXT NOT NULL`

#### `lesson_items`

- `lesson_id TEXT NOT NULL`
- `content_id TEXT NOT NULL`
- `position INTEGER NOT NULL`
- `activity_type TEXT NOT NULL`
- 复合主键：`lesson_id, content_id, activity_type`

导入时要验证课程中引用的 `vocab_ids` 和 `phrase_ids` 全部存在。

#### `learning_events`

- `id TEXT PRIMARY KEY`
- `profile_id TEXT NOT NULL`
- `content_id TEXT NOT NULL`
- `lesson_id TEXT NULL`
- `event_type TEXT NOT NULL`
- `is_correct INTEGER NULL`
- `grade INTEGER NULL`
- `response_ms INTEGER NULL`
- `confidence INTEGER NULL`
- `metadata_json TEXT NOT NULL`
- `occurred_at TEXT NOT NULL`

该表是追加型事实记录。除隐私删除外，不修改旧事件。

#### `review_states`

- `profile_id TEXT NOT NULL`
- `content_id TEXT NOT NULL`
- `mastery_score REAL NOT NULL`
- `interval_days REAL NOT NULL`
- `ease_factor REAL NOT NULL`
- `lapse_count INTEGER NOT NULL`
- `last_review_at TEXT NULL`
- `next_review_at TEXT NOT NULL`
- 复合主键：`profile_id, content_id`

#### `lesson_progress`

- `profile_id TEXT NOT NULL`
- `lesson_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `current_position INTEGER NOT NULL`
- `score REAL NULL`
- `started_at TEXT NULL`
- `completed_at TEXT NULL`
- `updated_at TEXT NOT NULL`

#### `bookmarks`

- `profile_id TEXT NOT NULL`
- `content_id TEXT NOT NULL`
- `source TEXT NOT NULL`
- `created_at TEXT NOT NULL`

#### `assessments`、`assessment_responses`、`assessment_results`

保存测试配置、逐题作答、程序统计和可选 AI 分析。必须保存 `ai_consent_at`；没有本次测试授权时间，不允许调用 AI。

#### `learning_plan_versions`

保存每次计划快照、生成原因、关联测试和是否当前版本。接受 AI 建议前先创建快照，以支持撤销。

#### `conversation_sessions`、`conversation_messages`、`conversation_feedback`

保存本地对话历史与结构化复盘。用户可逐条或全部删除。服务商会话 ID 只能作为可空元数据，不能成为本地数据的唯一依赖。

#### `ai_provider_settings`

只保存：配置 ID、类型、Base URL、模型名、能力标记、是否启用和最后测试时间。不得保存 API Key。

### 4.2 数据库事务边界

以下操作必须在事务中完成：

- 内容包导入或升级。
- 完成一节课并写入事件、进度、复习状态。
- 提交一场测试和生成本地结果。
- 接受新计划并切换当前版本。
- 导入本地备份。

---

## 5. 内容管线设计

### 5.1 编辑源与运行时内容分离

- `source/data/*.csv` 和审阅工作簿是内容编辑源。
- `assets/content/content-pack-v1.json` 是 App 运行时读取的标准包。
- App 不直接解析 Excel。
- 构建脚本从 CSV/JSON 标准化生成运行时包和 `manifest.json`。

### 5.2 内容包结构

```json
{
  "schema_version": 1,
  "content_version": "travel-0.1.0",
  "generated_at": "ISO-8601",
  "items": [],
  "lessons": [],
  "dialogues": [],
  "manifest": {
    "item_count": 0,
    "lesson_count": 0,
    "sha256": "..."
  }
}
```

现有内容字段必须先被映射而不是丢弃，例如：

- 词汇：`id, scene, category, japanese, kana, meaning_zh, usage_note, level, priority, review_status`。
- 语句：`id, scene, situation, japanese, kana, meaning_zh, slot_hint, level, priority, review_status`。
- 课程：`lesson_id, target_scene, title, objectives, vocab_ids, phrase_ids, minutes, level, priority, review_status`。

### 5.3 自动校验规则

`npm run content:validate` 至少检查：

- ID 全局唯一。
- 必填字段非空。
- `scene`、`level`、`priority` 和 `review_status` 属于允许枚举。
- 日文、假名和中文字段没有明显错位。
- 课程引用的所有内容 ID 均存在。
- 对话顺序连续。
- 课程时长为合理正整数。
- 内容版本合法且 manifest 计数一致。
- 发布内容中不存在 `draft_needs_native_review`。

### 5.4 开发与正式发布门禁

- 开发构建：允许导入草稿，界面显示“开发内容”标识。
- Preview/Release 构建：只允许 `reviewed` 或 `published`。
- 如果 release 内容包包含草稿，CI 和本地 `npm run release:check` 必须失败。
- 任何人工改动内容后都要重新生成 checksum，禁止直接编辑打包产物后发布。

### 5.5 首次导入与升级

首次启动：

1. 初始化数据库。
2. 读取内置 manifest。
3. 如果本地无该内容版本，在事务中导入。
4. 记录 `content_version` 和 checksum。
5. 导入失败则回滚，不进入半导入状态。

升级时按稳定 ID upsert 内容，不删除用户学习事件。内容被撤下时使用状态标记，保留历史引用。

---

## 6. 页面和用户流程实施清单

### 6.1 首次启动

路由流程：

```text
启动检查
  → 首次使用说明
  → AI 配置（可跳过）
  → AI 需求访谈或普通问卷
  → 可选水平测试
  → 计划预览
  → 今日页
```

验收要点：

- “暂不配置，先学习”始终可见。
- 跳过 AI 后功能不出现错误或空白页。
- 测试连接成功后才把配置标记为启用。
- API Key 输入后只显示末四位，重新进入页面不回填完整密钥。
- 首次流程被中断后可以恢复，不重复创建 profile。

### 6.2 今日页

显示：当前模式、今日预计时间、到期复习、新课程、已完成进度、继续学习入口。

任务生成顺序：

1. 到期复习。
2. 上次未完成课程。
3. 新内容。
4. 可选固定场景演练。

不调用 AI。相同输入和同一天必须生成稳定结果。

### 6.3 学习页和课程播放器

课程活动类型：

- `vocabulary_exposure`：日文、假名、中文、用法、播放。
- `phrase_exposure`：表达、含义、替换槽位。
- `micro_grammar`：最小解释和例句。
- `recognition_choice`：选择正确含义。
- `recall_choice`：根据中文选择日文。
- `listening_choice`：播放后选择。
- `fixed_dialogue`：按预设分支完成任务。
- `lesson_summary`：结果和进入复习的项目。

播放器每完成一个活动保存位置，进程被系统终止后可继续。

### 6.4 复习页

支持“忘记、困难、掌握、简单”四级反馈。首版采用可解释规则：

- 忘记：`mastery - 18`，`lapse + 1`，10 分钟后再次出现，随后转为次日。
- 困难：`mastery + 3`，间隔约为旧间隔的 1.2 倍，最低 1 天。
- 掌握：`mastery + 9`；新项目 1 天，旧项目约为 2.2 倍。
- 简单：`mastery + 14`；新项目 3 天，旧项目约为 3.2 倍。
- `mastery_score` 限制在 0—100，间隔加入少量可复现抖动，避免同日大量堆积。

具体参数集中在 `src/domain/review/config.ts`，不得散落页面。任何参数调整必须增加规则版本和测试。

### 6.5 测试页

- 从审核题库按目标和知识点选题。
- 本地计时、本地判分和本地知识点统计。
- 先展示本地结果，再单独询问是否请求 AI 深度分析。
- 请求前展示即将发送的字段摘要。
- AI 建议只能生成 proposal；用户确认后才能形成新的计划版本。
- 用户拒绝或请求失败时保持原计划。

### 6.6 自由对话页

对话前选择：场景、角色、难度、文字/语音、纠错强度和任务目标。

对话中：

- 用户消息立即写本地草稿状态，成功发送后写数据库。
- 网络超时可重试，不重复追加同一消息。
- 显示停止按钮和本次可能产生 API 费用的提示。
- 支持“我可以怎样说”的最小提示。
- 不在聊天过程中频繁长篇纠错。

结束时：

- 再调用一次结构化复盘。
- Zod 校验失败时保留原对话，显示可重试状态。
- 收藏项必须由用户确认后进入复习库。

### 6.7 设置与数据管理

- AI Provider 配置、测试、启用和删除。
- 学习目标、每日时长、假名和罗马音显示设置。
- TTS 语速和声音选择。
- 导出备份、导入备份、删除全部本地数据。
- 隐私说明、开源许可证和版本号。

---

## 7. 领域服务接口

接口先定义，再实现页面。建议使用以下 TypeScript 形态：

```ts
export interface ContentRepository {
  getLesson(id: string): Promise<Lesson | null>;
  listLessons(filter: LessonFilter): Promise<LessonSummary[]>;
  getItems(ids: string[]): Promise<ContentItem[]>;
}

export interface LearningRepository {
  recordEvent(event: NewLearningEvent): Promise<void>;
  completeLesson(input: CompleteLessonInput): Promise<LessonResult>;
  getLessonProgress(lessonId: string): Promise<LessonProgress | null>;
}

export interface ReviewService {
  getDue(now: Date, limit: number): Promise<ReviewCard[]>;
  grade(input: ReviewGradeInput): Promise<ReviewState>;
}

export interface TodayPlanService {
  build(input: TodayPlanInput): Promise<TodayPlan>;
}

export interface AssessmentService {
  create(config: AssessmentConfig): Promise<Assessment>;
  submit(id: string, answers: AssessmentAnswer[]): Promise<LocalAssessmentResult>;
  requestAiAnalysis(id: string, consent: AiConsent): Promise<AssessmentProposal>;
}

export interface ConversationService {
  create(config: ConversationConfig): Promise<ConversationSession>;
  sendMessage(sessionId: string, text: string): Promise<ConversationMessage>;
  finish(sessionId: string): Promise<ConversationFeedback>;
}
```

所有返回结果使用明确类型；预期错误使用带错误码的结果或领域异常，不使用字符串比较判断错误。

建议错误码：

- `CONTENT_NOT_FOUND`
- `CONTENT_NOT_REVIEWED`
- `DB_MIGRATION_FAILED`
- `AI_NOT_CONFIGURED`
- `AI_CONNECTION_FAILED`
- `AI_RESPONSE_INVALID`
- `AI_CONSENT_REQUIRED`
- `BACKUP_VERSION_UNSUPPORTED`
- `SECURE_CREDENTIAL_DELETE_FAILED`

---

## 8. AI Provider 设计

### 8.1 配置模型

```ts
type AiProviderSettings = {
  id: string;
  type: 'openai-compatible';
  baseUrl: string;
  model: string;
  enabled: boolean;
  capabilities: {
    text: boolean;
    transcription: boolean;
    speech: boolean;
  };
};
```

API Key 通过配置 ID 单独写入 SecureStore，例如 `ai-key:<settings-id>`。

### 8.2 Provider 接口

```ts
export interface AiProvider {
  testConnection(signal?: AbortSignal): Promise<ConnectionTestResult>;
  createConversationTurn(
    input: ConversationTurnInput,
    signal?: AbortSignal,
  ): Promise<ConversationTurnOutput>;
  createConversationFeedback(
    input: ConversationFeedbackInput,
    signal?: AbortSignal,
  ): Promise<ConversationFeedback>;
  analyzeAssessment(
    input: AssessmentAnalysisInput,
    signal?: AbortSignal,
  ): Promise<AssessmentProposal>;
}
```

业务层只依赖该接口。供应商请求格式、端点和响应抽取只存在于 adapter 中。

### 8.3 网络和安全规则

- 默认只接受 HTTPS Base URL；开发环境 localhost 例外需显式开关。
- Base URL 规范化，拒绝 URL 中内嵌用户名或密码。
- 请求超时，最多有限重试；鉴权失败不重试。
- 每次用户操作生成 request ID，防止重复点击造成重复计费。
- 日志只记录 provider 类型、耗时、状态类别和 request ID，不记录 Authorization、完整 prompt 或响应正文。
- App 切到后台后清除 React state 中的明文 Key。
- 删除配置时先删 SecureStore 密钥，再删除普通配置；任一步失败需告知用户。
- 备份文件不含 API Key。
- 自定义 Provider 属于高级功能，配置页明确提示第三方数据和费用风险。

### 8.4 AI 输出校验

自由对话复盘和测试分析都必须使用独立 Zod Schema。解析失败时：

1. 不写入正式结果。
2. 保存本地可重试状态和不敏感错误摘要。
3. 最多执行一次“只修复 JSON 格式”的受控重试。
4. 仍失败则提示用户，不伪造复盘。

### 8.5 Prompt 管理

- Prompt 文件放在 `src/services/ai/prompts`。
- 每类 Prompt 有显式版本，例如 `conversation-role.v1.ts`。
- Prompt 变更配套快照测试和结构化输出测试。
- 不把 Prompt 长文本写在页面组件中。
- 正式课程事实不从模型即时生成。

---

## 9. 音频实施策略

### 9.1 第一阶段

- 使用设备系统 TTS 朗读日文词汇和语句。
- 用户可以调节语速。
- 如果设备缺少日语语音，显示安装/启用提示，不让页面崩溃。
- 播放按钮有可见状态，重复点击不会叠加播放。

### 9.2 第二阶段

- 为审核内容增加授权音频 ID 和本地文件。
- 优先播放内容自带音频，缺失时回退系统 TTS。
- 音频清单进入 manifest 和 checksum 校验。

### 9.3 AI 异步语音

- 录音前请求权限并说明用途。
- 默认不永久保存原始录音；用户可选择保留。
- Provider 不支持转写时，自动回退文字输入。
- 语音能力不能阻塞自由文字对话的发布。

---

## 10. 本地备份格式

导出文件建议扩展名：`.hijapan-backup.json`，外层结构：

```json
{
  "backup_schema_version": 1,
  "app_version": "...",
  "exported_at": "...",
  "content_version": "...",
  "checksum": "...",
  "data": {
    "profiles": [],
    "learning_goals": [],
    "learning_events": [],
    "review_states": [],
    "lesson_progress": [],
    "bookmarks": [],
    "assessments": [],
    "conversations": [],
    "ai_provider_settings_without_keys": []
  }
}
```

导入流程：

1. 选择文件。
2. 校验文件大小、JSON、版本和 checksum。
3. 显示将导入的记录数量和冲突策略。
4. 导入前自动创建当前数据临时快照。
5. 在事务中导入。
6. 成功后提示 API Key 必须重新配置。
7. 失败则回滚。

首版冲突策略使用“整库替换”比逐条合并更安全，但必须二次确认并保留导入前快照。

---

## 11. 测试计划

### 11.1 测试金字塔

#### 纯领域单元测试

必须覆盖：

- 四级复习评分和边界值。
- 今日计划的时间预算、优先级和稳定性。
- 测试本地判分和知识点统计。
- AI 建议规则校验和计划回滚。
- 内容 Schema 和引用完整性。
- 备份版本、checksum 和敏感字段排除。

领域层目标：关键规则分支覆盖率不低于 90%。覆盖率是辅助指标，不能用无意义断言凑数。

#### Repository 集成测试

- 全新数据库迁移。
- 重复启动不重复迁移。
- 内容导入幂等。
- 完课事务要么全部成功，要么全部回滚。
- 删除本地数据后无残留业务记录。

#### 组件测试

- AI 配置表单验证、跳过和遮罩显示。
- 课程卡和活动切换。
- 复习四级按钮。
- 错误、空状态和加载状态。
- 大字号下的关键页面。

#### E2E

至少建立以下 Maestro 流程：

1. 首次启动跳过 AI → 建档 → 打开第一课。
2. 完成一节课 → 今日页更新 → 复习队列出现。
3. 配置无效 API → 测试失败但普通学习正常。
4. 使用 mock Provider 完成对话 → 查看复盘 → 收藏表达。
5. 导出、清除并导入数据。

### 11.2 固定质量命令

`package.json` 至少提供：

```text
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:coverage
npm run content:validate
npm run release:check
npm run android
```

Codex 完成每个阶段后必须运行该阶段相关命令，并在交付说明中报告真实结果。不得声称未运行的测试已经通过。

### 11.3 手工验收设备矩阵

- Android 当前主流版本真机至少 1 台。
- Android 较小屏幕或模拟器 1 个。
- 深色/浅色主题。
- 系统字号 100% 和较大字号。
- 飞行模式。
- 无日语 TTS、无麦克风权限、无 AI 配置等降级场景。
- iOS 在具备 macOS/Xcode 条件后进行兼容验证；不能因当前无苹果构建环境而声称 iOS 已验收。

---

## 12. 分阶段实施路线

每个阶段建议由 Codex 单独执行、验证和提交。只有本阶段 Definition of Done 全部满足后才进入下一阶段。

### 阶段 0：仓库和决策基线

目标：把现有资料变成安全可开发的 Git 仓库。

任务：

- 检查目录和已有文件，不覆盖用户内容。
- 初始化 Git（若尚未初始化）。
- 建立 `.gitignore`，排除密钥、构建产物、缓存和本地数据库。
- 选择开源许可证；未得到项目所有者确认前先建立 `LICENSE-TBD.md`，不要擅自决定。
- 新建 `README.md`、`AGENTS.md` 和 `docs/decisions/0001-local-only.md`。
- 在 README 写明：无后端、BYOK、内容审核状态和当前不可用于正式学习的限制。
- 建立 issue/里程碑命名规则。

Definition of Done：

- `git status` 不包含 API Key、缓存或大型临时文件。
- 文档之间没有“需要后端”的矛盾描述。
- `AGENTS.md` 明确 Codex 的工作边界、测试要求和内容不可臆造规则。

### 阶段 1：Expo 工程骨架

目标：得到可启动、可导航、带严格质量检查的空应用。

任务：

- 在项目根目录初始化 Expo Router TypeScript 项目，保留 `source` 和现有文档。
- 配置 TypeScript strict、路径别名、ESLint、Prettier、Jest。
- 建立设计令牌和基础组件：Screen、Text、Button、Card、Input、Loading、ErrorState、EmptyState。
- 建立五个底部导航占位页。
- 建立 Error Boundary 和不含敏感数据的本地日志接口。
- 建立 CI：安装、typecheck、lint、test、content validate。

Definition of Done：

- Android 模拟器或真机可启动。
- 页面导航可用。
- 所有质量命令通过。
- 页面中没有业务逻辑和示例密钥。

### 阶段 2：SQLite、迁移和 Repository

目标：建立可演进的本地数据基础。

任务：

- 完成初始数据库 Schema 和迁移运行器。
- 建立 Repository 接口和 SQLite 实现。
- 注入 Clock、ID Generator 和事务接口。
- 编写迁移、CRUD、事务回滚和幂等测试。
- 建立仅开发环境可见的数据库诊断页，不显示密钥。

Definition of Done：

- 全新安装和已有数据库重复启动均通过。
- 自动测试证明迁移幂等、完课事务可回滚。
- 页面不直接使用 SQL。

### 阶段 3：内容校验、打包和导入

目标：把现有旅游内容可靠导入 App。

任务：

- 为现有词汇、语句、语法、对话和课程建立 Zod Schema。
- 实现 normalize、validate、build 三个脚本。
- 生成标准内容包和 manifest。
- 实现首次启动导入和版本升级。
- 开发构建显示草稿标签；release check 拒绝草稿。
- 为重复 ID、缺失引用、非法枚举、checksum 错误建立失败测试。

Definition of Done：

- 现有 438/231/29/72/20 计数在导入前后完全一致。
- 所有课程引用均可解析。
- 第二次导入不生成重复记录。
- release check 会因当前草稿状态而预期失败，并给出明确原因；这是正确行为，不应绕过。

### 阶段 4：首次启动和 AI 配置

目标：用户能建档，AI 配置可选且安全。

任务：

- 实现首次启动状态机。
- 实现 API Base URL、Key、模型和测试连接表单。
- Key 写 SecureStore，普通设置写 SQLite。
- 实现普通需求问卷和结构化本地画像。
- AI 访谈先使用 mock Provider 验证，真实 Provider 在阶段 9 接入。
- 实现删除配置和异常恢复。

Definition of Done：

- 跳过 AI 能顺利完成 onboarding。
- 数据库、日志和备份测试中不存在 Key。
- 测试连接失败不会丢失普通课程入口。
- App 重启后不能读取并显示完整 Key。

### 阶段 5：旅游课程浏览与播放器

目标：用户能够使用现有内容完成一节本地课程。

任务：

- 实现场景和课程列表。
- 实现词汇、语句、微语法活动。
- 实现本地 TTS 和无语音降级。
- 实现识别/回忆选择题的确定性生成。
- 保存活动位置和完课结果。
- 实现课程总结和收藏。

Definition of Done：

- 酒店、餐厅、购物、景点课程可浏览。
- 中途退出后可从正确位置继续。
- 完课写入学习事件、课程进度和复习状态。
- 飞行模式下可完整完成课程。

### 阶段 6：复习系统

目标：形成“学习—到期—复习—再安排”的闭环。

任务：

- 实现四级评分算法和规则版本。
- 实现到期队列、收藏队列和错项队列。
- 实现复习卡片和当次总结。
- 建立固定时钟测试和边界测试。

Definition of Done：

- 相同状态、评分和时间产生相同结果。
- 复习状态不会因页面重复渲染而多次更新。
- 忘记项目会重新出现，掌握项目按规则延后。

### 阶段 7：今日计划

目标：根据每日时长生成稳定、可解释的任务。

任务：

- 实现时间预算、到期优先、续学优先和新课限制。
- 今日页显示每项任务的安排原因。
- 完成任务后即时更新，但不随意重排已开始任务。
- 处理没有课程、没有到期项和错过多日等情况。

Definition of Done：

- 5/10/20/30 分钟配置均有测试。
- 计划不调用 AI。
- 同一日期重复打开结果稳定。
- 总预计时长与预算误差处于约定范围内。

### 阶段 8：本地测试与计划版本

目标：实现自愿测试、本地判分和可撤销调级基础。

任务：

- 建立审核题目 Schema 和样例题库。
- 实现组卷、计时、逐题保存、本地判分和统计。
- 实现 `learning_plan_versions` 快照、接受和回滚。
- 建立 AI proposal 占位接口和规则校验器。

Definition of Done：

- 跳过测试不改变计划。
- 客观题判分不使用 AI。
- 接受建议前保存旧计划，回滚后恢复一致。
- 没有授权时调用 AI 分析会被领域层拒绝。

### 阶段 9：真实 AI 文字对话与测试分析

目标：BYOK 用户可直接连接自己的 AI 服务完成文字对话。

任务：

- 实现 OpenAI-compatible Provider Adapter。
- 完成连接测试、超时、取消、有限重试和错误映射。
- 实现角色对话 Prompt、复盘 Prompt、测试分析 Prompt。
- 用 Zod 验证所有结构化输出。
- 实现对话历史、幂等发送、结束复盘和收藏确认。
- 实现测试结果最小化预览、单次授权和 proposal。
- 使用 mock server 完成自动测试；真实 API 测试只由开发者手工执行，不进入 CI。

Definition of Done：

- 无 Key 时明确提示配置，不影响其他模块。
- 无效 Key、限流、超时、非 JSON 响应均有可理解错误。
- 日志和测试快照不包含 Key。
- AI 建议不能绕过用户确认直接改计划。
- 真实 API 调用次数由用户操作明确触发。

### 阶段 10：固定场景对话与异步语音

目标：补足非 AI 固定练习，并在文字稳定后增加可降级语音。

任务：

- 实现内容库中的固定分支对话。
- 对已审核内容进行本地任务完成判定。
- 接入录音权限、录音、可选转写和朗读。
- Provider 不支持语音时回退文字。
- 增加录音删除和保留设置。

Definition of Done：

- 不配置 AI 也能完成固定场景练习。
- 拒绝麦克风权限时不崩溃。
- 语音失败可继续文字对话。
- 默认策略符合隐私说明。

### 阶段 11：备份、隐私、可访问性和稳定性

目标：让应用具备公开测试所需的数据安全与降级能力。

任务：

- 实现导出、校验、整库替换导入和回滚。
- 实现单条对话删除、全部对话删除和全部本地数据删除。
- 检查大字号、屏幕阅读标签、颜色对比和触控尺寸。
- 检查飞行模式、磁盘不足、数据库损坏和系统 TTS 缺失。
- 编写隐私说明，明确数据流向第三方 AI 服务商。

Definition of Done：

- 备份不包含 API Key。
- 导入失败不会破坏原数据。
- 全部删除后数据库业务数据和 SecureStore 密钥均清理。
- 关键页面可在较大系统字号下使用。

### 阶段 12：发布候选与 GitHub Release

目标：交付可审计、可安装、可回滚的首个公开测试版本。

任务：

- 完成内容人工审核；将发布条目标记为 reviewed/published。
- 执行完整质量命令和 E2E。
- 配置 Android 应用 ID、图标、启动页、版本号和签名说明。
- 生成 SBOM 或依赖清单，检查许可证和已知高风险依赖。
- 编写安装、API 配置、隐私、备份和故障排除文档。
- 创建 GitHub Release，上传 APK/AAB、checksum 和 release notes。
- 保留上一稳定版本的回退说明。

Definition of Done：

- `npm run release:check` 通过。
- release 内容包不含草稿。
- 全新设备能完成 MVP 完整流程。
- GitHub Release 中的安装包 checksum 可验证。
- README 不承诺尚未实现的平台或功能。

---

## 13. Codex 执行协议

### 13.1 每次开始任务前

Codex 必须：

1. 读取根目录 `AGENTS.md`、本 Coding 计划和本阶段相关文档。
2. 检查 `git status`，保留用户已有变更。
3. 只处理当前阶段，不提前实现后续大模块。
4. 先说明准备修改的范围和验收方式。
5. 涉及依赖时说明添加理由，避免功能重叠的库。

### 13.2 编码规则

- TypeScript 开启 strict，不用 `any` 逃避类型问题。
- 领域规则必须写测试后再接页面。
- 不硬编码 API Key、模型名、用户目录或开发机路径。
- 不在组件里直接调用 SQLite 或第三方 AI API。
- 不修改教材日文来“让测试通过”；内容错误要单独报告。
- 不把 AI 生成内容直接标记为 reviewed/published。
- 不通过删除测试、降低严格程度或忽略错误完成验收。
- 不执行破坏性 Git 操作，不覆盖用户未提交内容。

### 13.3 每次结束任务时

Codex 必须报告：

- 实现了什么。
- 修改和新增了哪些关键文件。
- 运行了哪些命令，结果如何。
- 哪些内容未验证及原因。
- 当前阶段 Definition of Done 的完成情况。
- 下一步建议，但不自动扩展范围。

### 13.4 推荐提交粒度

每个提交只表达一个清晰目的，例如：

```text
chore: initialize expo application
feat(db): add initial sqlite migrations
feat(content): validate and import travel content pack
feat(learning): add lesson player persistence
feat(review): implement deterministic review scheduling
feat(ai): add openai-compatible provider adapter
test(e2e): cover offline first lesson flow
docs: add android release procedure
```

提交前至少运行与修改范围相关的 typecheck、lint 和测试。

---

## 14. 可直接交给 Codex 的阶段指令

以下指令应一次只使用一条，不要把 12 个阶段同时交给 Codex。

### 14.1 阶段 0 指令

```text
请在 G:\小玩意\HiJapan 执行《软件开发Coding计划_v1.0》的阶段 0。
先读取项目书、教学内容总纲和 Coding 计划，检查现有目录和 git 状态。
只完成仓库基线、README、AGENTS.md、本地无后端架构决策和安全的 .gitignore；不要初始化 Expo，也不要改动 source 教材。
如果许可证需要我选择，请保留待决定状态，不要擅自选择。
完成后运行适当检查，并按 Coding 计划报告 Definition of Done。
```

### 14.2 阶段 1 指令

```text
请执行《软件开发Coding计划_v1.0》的阶段 1：Expo 工程骨架。
保留所有现有项目文档和 source 内容，使用当前稳定 Expo + Expo Router + TypeScript strict。
建立基础设计令牌、五个底部导航占位页、Error Boundary、Jest、ESLint、Prettier 和 CI。
不要实现数据库、课程或 AI 业务。实际依赖版本写入 dependency-baseline.md。
完成后运行 typecheck、lint 和测试，并报告结果。
```

### 14.3 阶段 2 指令

```text
请只执行 Coding 计划阶段 2：SQLite、迁移和 Repository。
先定义领域接口和迁移策略，再实现 SQLite；页面不得直接 SQL。
为迁移幂等、Repository CRUD、事务回滚编写测试。
不要开始内容 UI 或 AI 功能。完成后报告数据库表、迁移文件和测试结果。
```

### 14.4 阶段 3 指令

```text
请只执行 Coding 计划阶段 3：内容校验、打包和导入。
以 source/data 的真实字段为输入，建立 Zod Schema、normalize/validate/build 脚本、manifest 和首次导入。
必须验证现有 438 个词汇、231 条语句、29 个微语法、72 行对话和 20 课的计数与引用。
开发构建允许草稿但要显示标记；release 检查必须拒绝 draft_needs_native_review，不能绕过。
完成后运行内容校验、测试和 typecheck，报告真实结果。
```

### 14.5 阶段 4—8 通用指令模板

```text
请执行《软件开发Coding计划_v1.0》的阶段 X，不扩大到后续阶段。
先检查上一阶段 Definition of Done 和 git 状态；若前置条件不满足，先报告而不是隐藏问题。
领域规则先写测试，页面只通过 service/repository 接口访问数据。
实现本阶段任务、错误状态和离线降级，运行相关质量命令，并逐条报告本阶段验收条件。
```

### 14.6 阶段 9 AI 指令

```text
请执行 Coding 计划阶段 9：真实 BYOK AI 文字对话与测试分析。
API Key 只能进入 SecureStore，不能进入 SQLite、日志、测试快照、备份或 Git。
业务层只依赖 AiProvider 接口；实现 OpenAI-compatible adapter、超时、取消、有限重试、错误映射和 Zod 输出校验。
用 mock provider/server 完成自动测试，禁止在 CI 使用真实 Key。
AI 测试分析必须检查本次授权，只生成 proposal，不能直接修改当前学习计划。
完成后专门执行一次敏感信息扫描，并报告未使用真实 API 的部分。
```

### 14.7 阶段 12 发布指令

```text
请执行 Coding 计划阶段 12 的发布候选检查，但在创建公开 GitHub Release 或上传安装包前先停下让我确认。
先验证内容审核状态、release:check、完整测试、E2E、依赖许可证、APK 安装和 checksum。
不得发布包含 draft_needs_native_review 的教材，不得把签名文件或 API Key 加入 Git。
输出发布清单、阻塞项和候选 release notes。
```

---

## 15. GitHub 与发布策略

### 15.1 分支

- `main`：始终保持可构建，保护分支。
- 功能分支：`feat/<short-name>`。
- 修复分支：`fix/<short-name>`。
- 内容分支：`content/<scene-or-level>`。

个人项目早期可以直接使用短分支和 Pull Request，不建立复杂 Git Flow。

### 15.2 CI

每个 Pull Request 执行：

- npm clean install。
- TypeScript typecheck。
- ESLint、格式检查。
- 单元和组件测试。
- 内容 Schema、引用和计数检查。
- 敏感信息和 release 内容状态检查。

公开 Release 标签触发 Android 构建前，还应验证版本号、内容版本和 changelog 一致。

### 15.3 密钥与签名

- `.env`、keystore、服务账号、API Key 不进入 Git。
- 用户 BYOK Key 不是项目构建 secret。
- Android 发布签名独立安全备份；GitHub Actions 若未来使用签名，应使用 repository secrets。
- 开源仓库提供无密钥的 `.env.example`，其中只能有字段名和安全示例。

### 15.4 版本号

- App 使用语义版本：`MAJOR.MINOR.PATCH`。
- 内容包有独立版本，例如 `travel-0.1.0`。
- 数据库迁移有单调递增整数版本。
- Prompt 有显式版本。

这四种版本不得混为一个字段。

---

## 16. 风险清单与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 日语内容尚未母语审核 | 可能教错或表达不自然 | release 构建拒绝草稿；正式发布前人工审核 |
| BYOK Provider 协议差异 | 自定义接口连接失败 | 首版限定 OpenAI-compatible 基本能力，adapter 隔离差异 |
| 用户 Key 泄露 | 产生费用和隐私风险 | SecureStore、日志清洗、不备份、风险提示和一键删除 |
| 无后端导致换机困难 | 数据丢失 | 本地导出/导入、checksum、导入前快照 |
| SQLite 升级损坏 | 无法启动或丢进度 | 迁移事务、备份、幂等测试、禁止破坏性重建 |
| 一开始页面过多 | 延期且难验证 | 严格阶段交付，先完成一课闭环 |
| AI 输出格式不稳定 | 复盘或分析崩溃 | Zod 校验、受控修复重试、失败保留原数据 |
| 语音功能复杂 | 阻塞 MVP | 先文字和系统 TTS，异步语音后置 |
| GitHub 用户不会自行构建 | 降低可用性 | 发布签名安装包、安装说明和 checksum |
| iOS 无法像 APK 一样分发 | 用户预期不符 | README 明确苹果签名限制，先完成 Android |

---

## 17. 首个开发迭代建议

不要立即从“漂亮首页”开始。首个可运行纵切应该是：

```text
内置 1 节餐厅课程
  → 从内容包导入 SQLite
  → 课程列表读取
  → 显示 3 个词和 2 个语句
  → 完成 2 道本地选择题
  → 写入 learning_event
  → 生成 review_state
  → 在复习页看到到期项目
```

这个纵切能同时验证内容格式、数据库、Repository、课程播放器和复习闭环。完成后再扩展到全部 20 课，能够显著降低返工。

### 17.1 建议实际执行顺序

1. 项目所有者确认 Android 优先和开源许可证。
2. Codex 执行阶段 0。
3. Codex 执行阶段 1。
4. Codex 执行阶段 2 和阶段 3。
5. 建立首个纵切。
6. 日语审核与程序开发并行，但未审核内容不进入 release。
7. 完成离线学习闭环后才接真实 AI。

### 17.2 两个需要项目所有者最终决定的问题

开发不必因此停下，但在首次公开发布前必须确认：

1. 开源许可证：推荐在 MIT 或 Apache-2.0 中选择；课程内容是否采用同一许可证，需要单独考虑。
2. 首发范围：建议 Android 优先；是否要求第一版同时提供 iOS 构建，需要结合苹果开发者账号和 macOS 构建条件决定。

---

## 18. 最终验收总表

### 离线核心

- [ ] 无网络、无 AI 配置时可以首次建档。
- [ ] 可以学习、做题、记录进度和复习。
- [ ] 今日计划不调用 AI。
- [ ] 重启后进度完整。
- [ ] 内容升级不破坏旧学习记录。

### AI

- [ ] Key 仅存在 SecureStore。
- [ ] 测试连接有超时和可理解错误。
- [ ] 自由文字对话可完成并复盘。
- [ ] 所有结构化结果经过 Schema 校验。
- [ ] 测试分析有单次授权并只产生 proposal。
- [ ] 删除 Key 后离线学习完整可用。

### 数据安全

- [ ] 日志、Git、SQLite、备份中没有 Key。
- [ ] 备份可导入且失败可回滚。
- [ ] 全部数据删除同时清理 SecureStore。
- [ ] 隐私说明准确描述第三方 AI 数据流。

### 内容

- [ ] 运行时内容计数和引用自动校验。
- [ ] release 中没有草稿条目。
- [ ] 发布内容经过日语审核。
- [ ] 内容来源和授权状态可追溯。

### 工程质量

- [ ] TypeScript strict 通过。
- [ ] lint、格式、测试、内容校验通过。
- [ ] Android 真机完成关键 E2E。
- [ ] 飞行模式和异常降级已验收。
- [ ] README、安装、备份和故障排除文档齐全。

---

## 结论

本项目应采用“内容先行、离线闭环优先、AI 后置增强”的开发方法。最先证明的不是 AI 能聊天，而是用户在完全不配置 AI 的情况下，也能从审核课程中完成一节有用的学习、留下进度，并在合适时间得到复习。

Codex 后续应严格按阶段工作。每个阶段都必须有可运行产物、自动测试和明确的完成定义；出现内容审核、平台签名或用户选择等真正的外部前置条件时，应报告阻塞项，而不是通过降低质量门槛绕过。
