# JLPT 课程资料来源与授权

## 1. JLPT 官方资料（仅用于考试蓝图）

课程的等级能力、考试时间、评分结构和题型依据 Japan Foundation / Japan Educational Exchanges and Services 的 JLPT 官方页面整理：

- [Level Summary](https://www.jlpt.jp/e/about/levelsummary.html)
- [Test Sections and Test Times](https://www.jlpt.jp/e/guideline/testsections.html)
- [Scoring and Pass/Fail](https://www.jlpt.jp/e/guideline/results.html)
- [FAQ](https://www.jlpt.jp/e/faq/index.html)
- [Sample Questions](https://www.jlpt.jp/e/samples/forlearners.html)

官方资料不提供固定 N5—N1 词汇、汉字和语法清单。本项目没有复制官方试题，也不声称获得 JLPT 主办方认可。

## 2. OpenJLPT 0.3.0

- 项目：<https://github.com/evanclan/OpenJLPT>
- 授权：Creative Commons Attribution-ShareAlike 4.0 International（CC BY-SA 4.0）
- 用途：N5—N1 社区等级归类的词汇、汉字、语法和例句参考。
- 本地授权副本：`third_party/OpenJLPT-LICENSE-CC-BY-SA-4.0.txt`
- 本地署名与上游说明：`third_party/OpenJLPT-NOTICE.md`

OpenJLPT 自身说明其等级列表是近似值，不是官方 JLPT 清单。其上游包括 Jonathan Waller lists、JMdict、KANJIDIC2、Tatoeba 和 OpenJLPT 原创语法资料；具体授权见 NOTICE。

例句若带 `tatoeba_id`，构建流程还使用 Tatoeba 官方的 `jpn-cmn_links.tsv` 和 `cmn_sentences.tsv` 导出查找直接中文翻译。Tatoeba 语料采用 CC BY 2.0 FR；社区翻译质量与简繁体不完全一致，所以仍标记为待审。

## 3. zh-ja-dict

- 项目：<https://github.com/inakaegg/zh-ja-dict>
- 授权：CC BY-SA 4.0
- 用途：为日语词头匹配简体中文候选释义。
- 性质：该项目说明内容由模型生成并经过自动质量流程，不等同人工审定词典。

因此所有匹配结果均标记为 `machine_assisted_needs_review`；匹配不到时保留空值和英文参考，绝不自动编造中文义。

## 4. 衍生数据的授权边界

`source/jlpt` 中由 OpenJLPT 和 zh-ja-dict 转换、合并而来的数据是 CC BY-SA 4.0 衍生数据，必须保留署名、授权说明和同方式共享要求。仓库其余代码当前仍为 `UNLICENSED`；这不撤销第三方数据自身的开放授权，也不自动把全部项目代码改为 CC BY-SA。

若发布、再分发或修改本目录的数据，应：

1. 保留本文件、OpenJLPT LICENSE 和 NOTICE。
2. 明示做过哪些转换或修改。
3. 对衍生数据继续采用 CC BY-SA 4.0。
4. 保留 Tatoeba 句子 ID 和来源信息（若记录中存在）。
5. 不把社区等级归类称为“JLPT 官方词表”。

构建日期：2026-10-29。数据版本与数量见 `manifest.json`。
