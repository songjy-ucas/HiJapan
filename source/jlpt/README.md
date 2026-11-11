# HiJapan JLPT N5—N1 课程资料草案

本目录为后续 JLPT 学习模块准备结构化资料，当前**没有接入软件，也不代表已经达到可发布教材质量**。内容涵盖 N5—N1 的词汇、汉字、语法参考、例句、官方考试蓝图和 667 课课程地图。

## 当前规模

| 等级 | 词汇 | 汉字 | 语法 | 课程 |
|---|---:|---:|---:|---:|
| N5 | 674 | 84 | 81 | 57 |
| N4 | 630 | 169 | 98 | 53 |
| N3 | 1,659 | 387 | 101 | 139 |
| N2 | 1,778 | 398 | 123 | 149 |
| N1 | 3,070 | 1,345 | 123 | 269 |
| 合计 | 7,811 | 2,383 | 526 | 667 |

这些等级归类来自社区数据，只是课程制作起点，**不是 JLPT 官方词汇、汉字或语法清单**。JLPT 官方已说明，自 2010 年起不再发布固定的 Test Content Specifications。

## 文件说明

- `manifest.json`：文件、数量、Schema 版本和统一审核状态。
- `exam_blueprint.json`：官方等级能力、时间、评分与题型的结构化整理。
- `curriculum_plan.json`：每级 8 个模块、每模块 3 课的总课程地图。
- `quality_report.json`：中文覆盖率、发布阻断项和待审规模。
- `data/vocabulary-N*.jsonl`：表记、读音、罗马音、词性、中文机器辅助释义、英文参考和来源。
- `data/kanji-N*.jsonl`：笔画、音读、训读、部首、词例及中英文参考义。
- `data/grammar-N*.jsonl`：形式、接续、英文功能说明、标签和例句引用；中文详解尚待翻译与审核。
- `data/sentences-N*.jsonl`：日文、振假名、英文参考、Tatoeba ID（若有）；能与 Tatoeba 日中直译关系匹配的条目附中文候选，其余留空待译，全部仍待审核。
- `data/lessons-N*.json`：按每课最多 12 词、5 汉字、2 语法和 6 条精学例句生成的内容分配，并附活动框架、考试题型对齐、通过标准和复习规则。
- `SOURCES_AND_LICENSES.md`：完整来源、授权和署名要求。

## 审核状态的含义

所有记录统一为 `draft_needs_native_review`。其中：

- `machine_assisted_needs_review`：存在机器辅助中文义，但必须核对词义、词性、语域和等级。
- `pending_human_translation`：尚未补齐可靠中文内容。
- `community_translation_needs_review`：存在 Tatoeba 社区中文译文，仍须核对简繁体、自然度和与日文语义的一致性。
- `pending_human_translation_and_native_review`：既需要翻译，也需要日语母语者或同等水平人员核对。

任何人都不得为了让发布校验通过而直接把这些状态改成已审核。正式课程还需补齐中文语法说明、例句翻译、原创分级阅读、听力音频、题目、错误选项和人工解析，并逐项记录审核人和审核日期。

## 生成与验证

原始第三方数据仅放在 `.tmp-build/jlpt-sources`，不提交 Git。重新生成：

```powershell
node scripts/content/build-jlpt-source.mjs . .tmp-build/jlpt-sources
node scripts/content/validate-jlpt-source.mjs .
```

生成脚本不会调用 AI，也不会使用用户 API Key。课程学习未来仍应默认完全本地运行；AI 只用于用户主动选择的测试分析或对话功能。
