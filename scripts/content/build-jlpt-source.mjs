import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.argv[2] ?? '.');
const inputDir = path.resolve(
  process.argv[3] ?? path.join(projectRoot, '.tmp-build', 'jlpt-sources'),
);
const outputRoot = path.join(projectRoot, 'source', 'jlpt');
const dataDir = path.join(outputRoot, 'data');
const generatedAt = '2026-10-29';
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];

const levelPlans = {
  N5: {
    ability:
      '理解少量基础日语：能读平假名、片假名和基础汉字写成的常用表达，能听懂慢速、简短的课堂及日常对话。',
    modules: [
      ['文字、数字与基础判断', '建立假名、数字、时间和礼貌判断句基础'],
      ['自我介绍与家庭', '说明身份、国籍、职业、家庭与所属关系'],
      ['时间与日常作息', '描述日期、频率、移动和每日活动'],
      ['家与位置', '表达存在、地点、方向、数量和物品位置'],
      ['学校与工作', '理解课堂指示，说明学习、工作和简单计划'],
      ['饮食与购物', '完成点餐、询价、数量选择和喜好表达'],
      ['交通、天气与健康', '问路、乘车并说明天气和基础身体状况'],
      ['基础听读整合', '整合短消息、标牌、通知和慢速生活对话'],
    ],
  },
  N4: {
    ability:
      '理解以熟悉日常主题为中心的基础日语：能读基础词汇和汉字构成的短文，能听懂语速较慢的日常对话。',
    modules: [
      ['普通形与日常叙述', '从礼貌形扩展到普通形、引用和连贯叙述'],
      ['经历、计划与意向', '表达经验、预定、打算、尝试和建议'],
      ['理由、条件与转折', '运用原因、让步及基础条件句组织复句'],
      ['请求与授受', '处理许可、义务、帮助、请求和授受关系'],
      ['变化与动作关系', '掌握状态变化、自动词他动词和进行结果'],
      ['可能、被动与使役', '理解能力、影响、受身和基础使役表达'],
      ['社会生活与旅行', '应对设施、健康、校园、职场和旅行计划'],
      ['日常短文与听力整合', '处理较长叙述、通知、邮件和行动选择'],
    ],
  },
  N3: {
    ability:
      '在一定程度上理解日常场景中的日语：能把握标题、稍难日常文章的大意，并跟上接近自然速度的连贯会话。',
    modules: [
      ['口语与书面语衔接', '辨认语体、缩约、引用和篇章衔接差异'],
      ['传闻、推测与判断', '区分信息来源、外观、可能性和主观判断'],
      ['变化、决定与倾向', '表达变化过程、习惯、决定、结果和倾向'],
      ['阶段、时点与持续', '掌握动作阶段、刚刚、期间和时间关系'],
      ['限制、程度与强调', '准确表达限定、比较、程度和焦点'],
      ['因果、让步与目的', '组织多层原因、反预期、目的和结果关系'],
      ['语态与基础敬语', '整合被动、使役、使役被动及社会距离'],
      ['信息整合与观点把握', '综合广告、说明文、对话和多项信息'],
    ],
  },
  N2: {
    ability:
      '能在日常及较广泛场景中理解日语：阅读报道、评论和简单评论性文章，听懂接近自然速度的新闻与连贯谈话。',
    modules: [
      ['正式书面语基础', '掌握书面搭配、名词化和正式表达方式'],
      ['职场与社会议题', '扩展工作、制度、经济、文化和公共生活词汇'],
      ['原因与逻辑展开', '区分原因、依据、结果、范围和逻辑顺序'],
      ['对比与让步', '理解并运用复杂转折、对照和反预期关系'],
      ['条件与评价', '表达前提、限定、评价标准和必然性'],
      ['立场、证据与语气', '识别说话者态度、证据强度和隐含判断'],
      ['新闻、评论与说明', '解析信息结构、观点关系和写作目的'],
      ['长文与自然语速听力', '整合长篇信息、任务决策和主旨推断'],
    ],
  },
  N1: {
    ability:
      '能在广泛场景中理解日语：阅读逻辑复杂或抽象的评论与社论，并听懂自然速度、结构复杂的新闻、讲座和多方谈话。',
    modules: [
      ['高级词汇与语义辨析', '辨析低频词、惯用搭配、同义词和语域差异'],
      ['逻辑与论证结构', '追踪前提、反驳、保留、结论和论证推进'],
      ['抽象与社会主题', '处理政策、学术、文化、科技和社会议题'],
      ['正式与学术语体', '掌握高度书面化表达、压缩结构和名词化'],
      ['情态、立场与评价', '识别微妙态度、责任归属、确信度和价值判断'],
      ['修辞、省略与言外之意', '恢复省略信息，理解反讽、比喻和语用含义'],
      ['新闻、讲座与多方观点', '整合多位说话者立场、证据和结论'],
      ['高密度听读与应试整合', '在时间限制下完成复杂文本和听力任务'],
    ],
  },
};

const officialBlueprint = {
  title: 'JLPT 官方能力与题型蓝图（课程编排依据）',
  disclaimer:
    '本文件仅整理 JLPT 官方公布的等级能力、考试时间、评分结构和题型。JLPT 自 2010 年起不再公布固定词汇、汉字、语法清单；本项目数据中的等级归类属于社区近似值，不是官方指定清单。',
  official_sources: [
    {
      title: 'Summary of Linguistic Competence Required for Each Level',
      url: 'https://www.jlpt.jp/e/about/levelsummary.html',
    },
    {
      title: 'Test Sections and Test Times',
      url: 'https://www.jlpt.jp/e/guideline/testsections.html',
    },
    {
      title: 'Scoring Sections, Pass or Fail, Score Report',
      url: 'https://www.jlpt.jp/e/guideline/results.html',
    },
    {
      title: 'FAQ: Test Content Specifications',
      url: 'https://www.jlpt.jp/e/faq/index.html',
    },
    {
      title: 'Sample Questions',
      url: 'https://www.jlpt.jp/e/samples/forlearners.html',
    },
  ],
  levels: {
    N1: {
      times_minutes: { language_knowledge_and_reading: 110, listening: 55 },
      scoring: { total_pass: 100, section_minimum: 19, total: 180 },
      emphasis: [
        '高级词汇与语法在语境中的使用',
        '逻辑复杂、抽象度高的长文',
        '新闻、讲座及自然语速多方谈话',
      ],
    },
    N2: {
      times_minutes: { language_knowledge_and_reading: 105, listening: 50 },
      scoring: { total_pass: 90, section_minimum: 19, total: 180 },
      emphasis: [
        '词义、用法和句子组织',
        '报道、评论和观点关系',
        '接近自然语速的连贯信息',
      ],
    },
    N3: {
      times_minutes: { vocabulary: 30, grammar_and_reading: 70, listening: 40 },
      scoring: { total_pass: 95, section_minimum: 19, total: 180 },
      emphasis: [
        '日常词汇、汉字读法与语法',
        '短中篇阅读和信息检索',
        '接近自然语速的日常对话',
      ],
    },
    N4: {
      times_minutes: { vocabulary: 25, grammar_and_reading: 55, listening: 35 },
      scoring: {
        total_pass: 90,
        section_minimum: { language_knowledge_and_reading: 38, listening: 19 },
        total: 180,
      },
      emphasis: ['基础词汇与汉字', '日常主题短文', '较慢语速的日常会话'],
    },
    N5: {
      times_minutes: { vocabulary: 20, grammar_and_reading: 40, listening: 30 },
      scoring: {
        total_pass: 80,
        section_minimum: { language_knowledge_and_reading: 38, listening: 19 },
        total: 180,
      },
      emphasis: [
        '假名、基础汉字和常用表达',
        '极短生活文本',
        '慢速课堂及日常对话',
      ],
    },
  },
  item_types: {
    language_knowledge: [
      'kanji_reading',
      'orthography',
      'word_formation',
      'context_expression',
      'paraphrase',
      'usage',
      'sentence_grammar',
      'sentence_composition',
      'text_grammar',
    ],
    reading: [
      'short_passage',
      'mid_passage',
      'long_passage',
      'integrated_comprehension',
      'thematic_comprehension',
      'information_retrieval',
    ],
    listening: [
      'task_comprehension',
      'key_points',
      'general_outline',
      'verbal_expressions',
      'quick_response',
      'integrated_comprehension',
    ],
  },
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeJsonl = (file, rows) =>
  fs.writeFileSync(
    file,
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .trim();

function loadChineseGlosses() {
  const rows = fs
    .readFileSync(path.join(inputDir, 'ja-zh-glosses.jsonl'), 'utf8')
    .trim()
    .split(/\r?\n/);
  const map = new Map();
  for (const line of rows) {
    const item = JSON.parse(line);
    const meanings = [
      ...new Set(
        (item.zh ?? []).map((entry) => normalize(entry.s)).filter(Boolean),
      ),
    ];
    if (meanings.length) map.set(normalize(item.word), meanings);
  }
  return map;
}

function loadTatoebaChineseTranslations() {
  const linksFile = path.join(inputDir, 'jpn-cmn_links.tsv');
  const sentencesFile = path.join(inputDir, 'cmn_sentences.tsv');
  if (!fs.existsSync(linksFile) || !fs.existsSync(sentencesFile))
    return new Map();
  const chineseById = new Map();
  for (const line of fs.readFileSync(sentencesFile, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const [id, language, ...textParts] = line.split('\t');
    if (language === 'cmn' && textParts.length)
      chineseById.set(Number(id), textParts.join('\t'));
  }
  const result = new Map();
  for (const line of fs.readFileSync(linksFile, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const [japaneseId, chineseId] = line.split('\t').map(Number);
    const translation = chineseById.get(chineseId);
    if (!translation) continue;
    const values = result.get(japaneseId) ?? [];
    if (!values.includes(translation)) values.push(translation);
    result.set(japaneseId, values);
  }
  return result;
}

function findChineseMeanings(item, glosses) {
  const candidates = [
    item.word,
    ...(item.other_forms ?? []),
    item.reading,
    ...(item.readings ?? []),
  ]
    .map((entry) =>
      typeof entry === 'string' ? entry : (entry?.word ?? entry?.reading),
    )
    .map(normalize)
    .filter(Boolean);
  for (const [index, candidate] of candidates.entries()) {
    const result = glosses.get(candidate);
    if (result)
      return {
        meanings: result,
        match: index === 0 ? 'headword' : 'alternate_form_or_reading',
      };
  }
  return { meanings: [], match: null };
}

function provenance(kind, level) {
  return {
    dataset: 'OpenJLPT 0.3.0 derived corpus',
    level_assignment: 'community_estimate_not_official_jlpt_list',
    upstream_kind: kind,
    upstream_level: level,
    license: 'CC-BY-SA-4.0',
    imported_on: generatedAt,
  };
}

function transformVocabulary(item, glosses, posMap) {
  const zh = findChineseMeanings(item, glosses);
  return {
    id: `jlpt-vocab-${item.id}`,
    level: item.level,
    word: item.word,
    reading: item.reading,
    romaji: item.romaji ?? null,
    meanings_zh: zh.meanings,
    meanings_en_reference: item.meanings ?? [],
    meaning_zh_status: zh.meanings.length
      ? 'machine_assisted_needs_review'
      : 'pending_human_translation',
    zh_match_method: zh.match,
    part_of_speech: item.pos ?? [],
    part_of_speech_labels_en: (item.pos ?? []).map(
      (code) => posMap[code] ?? code,
    ),
    other_forms: item.other_forms ?? [],
    jmdict_id: item.jmdict_id ?? null,
    example_ids: (item.examples ?? []).map(
      (_, index) => `jlpt-sentence-vocab-${item.id}-${index + 1}`,
    ),
    review_status: 'draft_needs_native_review',
    provenance: provenance('vocabulary', item.level),
  };
}

function transformKanji(item, glosses) {
  const meanings = glosses.get(normalize(item.character)) ?? [];
  return {
    id: `jlpt-kanji-${item.character.codePointAt(0).toString(16)}`,
    level: item.level,
    character: item.character,
    strokes: item.strokes ?? null,
    school_grade_reference: item.grade ?? null,
    newspaper_frequency_rank_reference: item.freq ?? null,
    radical: item.radical ?? null,
    radical_number: item.radical_number ?? null,
    onyomi: item.onyomi ?? [],
    kunyomi: item.kunyomi ?? [],
    nanori: item.nanori ?? [],
    meanings_zh: meanings,
    meanings_en_reference: item.meanings ?? [],
    meaning_zh_status: meanings.length
      ? 'machine_assisted_needs_review'
      : 'pending_human_translation',
    example_words: item.words ?? [],
    review_status: 'draft_needs_native_review',
    provenance: provenance('kanji', item.level),
  };
}

function transformGrammar(item) {
  return {
    id: `jlpt-grammar-${item.level.toLowerCase()}-${item.id}`,
    level: item.level,
    pattern: item.pattern,
    reading: item.reading ?? null,
    romaji: item.romaji ?? null,
    formation_reference_en: item.formation ?? null,
    meaning_reference_en: item.meaning ?? null,
    notes_reference_en: item.notes ?? null,
    tags: item.tags ?? [],
    explanation_zh: null,
    usage_restrictions_zh: null,
    confusion_notes_zh: null,
    translation_status: 'pending_human_translation_and_native_review',
    example_ids: (item.examples ?? []).map(
      (_, index) =>
        `jlpt-sentence-grammar-${item.level.toLowerCase()}-${item.id}-${index + 1}`,
    ),
    review_status: 'draft_needs_native_review',
    provenance: provenance('grammar', item.level),
  };
}

function extractSentences(vocabulary, grammar, tatoebaChinese) {
  const sentences = [];
  for (const item of vocabulary) {
    for (const [index, example] of (item.examples ?? []).entries()) {
      const chineseCandidates = example.tatoeba_id
        ? (tatoebaChinese.get(example.tatoeba_id) ?? [])
        : [];
      sentences.push({
        id: `jlpt-sentence-vocab-${item.id}-${index + 1}`,
        level: item.level,
        japanese: example.ja,
        furigana: example.furigana ?? null,
        translation_zh: chineseCandidates[0] ?? null,
        translation_zh_candidates: chineseCandidates,
        translation_en_reference: example.en ?? null,
        translation_status: chineseCandidates.length
          ? 'community_translation_needs_review'
          : 'pending_human_translation_and_native_review',
        source_context: { type: 'vocabulary', id: `jlpt-vocab-${item.id}` },
        tatoeba_id: example.tatoeba_id ?? null,
        review_status: 'draft_needs_native_review',
        provenance: {
          ...provenance('example_sentence', item.level),
          upstream_sentence_source: example.tatoeba_id
            ? 'Tatoeba CC-BY-2.0-FR via OpenJLPT'
            : 'OpenJLPT original grammar/vocabulary material',
          chinese_translation_source: chineseCandidates.length
            ? 'Tatoeba jpn-cmn direct translation link, CC-BY-2.0-FR'
            : null,
        },
      });
    }
  }
  for (const item of grammar) {
    for (const [index, example] of (item.examples ?? []).entries()) {
      sentences.push({
        id: `jlpt-sentence-grammar-${item.level.toLowerCase()}-${item.id}-${index + 1}`,
        level: item.level,
        japanese: example.ja,
        furigana: example.furigana ?? null,
        translation_zh: null,
        translation_en_reference: example.en ?? null,
        translation_status: 'pending_human_translation_and_native_review',
        source_context: {
          type: 'grammar',
          id: `jlpt-grammar-${item.level.toLowerCase()}-${item.id}`,
        },
        tatoeba_id: null,
        review_status: 'draft_needs_native_review',
        provenance: provenance('grammar_example_sentence', item.level),
      });
    }
  }
  return sentences;
}

function divideIds(ids, count) {
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * ids.length) / count);
    const end = Math.floor(((index + 1) * ids.length) / count);
    return ids.slice(start, end);
  });
}

function lessonKind(index) {
  return [
    {
      phase: 'recognition',
      focus: '新内容识别与语境理解',
      task: '学习本课词汇、汉字和语法，在短句中识别形式与核心功能。',
    },
    {
      phase: 'contrast_and_use',
      focus: '易混辨析与受控输出',
      task: '比较近义形式，在替换、排序和情境选择中正确使用。',
    },
    {
      phase: 'integrated_input',
      focus: '听读整合与任务完成',
      task: '阅读短文或听取对话，提取关键信息并完成真实任务。',
    },
  ][index % 3];
}

function createLessons(level, vocabulary, kanji, grammar, sentences) {
  const lessonCount = Math.max(
    Math.ceil(vocabulary.length / 12),
    Math.ceil(kanji.length / 5),
    Math.ceil(grammar.length / 2),
  );
  const vocabularyGroups = divideIds(
    vocabulary.map((item) => item.id),
    lessonCount,
  );
  const kanjiGroups = divideIds(
    kanji.map((item) => item.id),
    lessonCount,
  );
  const grammarGroups = divideIds(
    grammar.map((item) => item.id),
    lessonCount,
  );
  const sentenceGroups = divideIds(
    sentences.map((item) => item.id),
    lessonCount,
  );
  return Array.from({ length: lessonCount }, (_, index) => {
    const moduleIndex = Math.min(7, Math.floor((index * 8) / lessonCount));
    const module = levelPlans[level].modules[moduleIndex];
    const kind = lessonKind(index);
    const lessonNumber = index + 1;
    const sentenceIds = sentenceGroups[index];
    const targetSentenceIds = sentenceIds.slice(0, 6);
    const referenceSentenceIds = sentenceIds.slice(6);
    const itemTypes =
      index % 3 === 2
        ? [
            'context_expression',
            'text_grammar',
            'short_passage',
            'task_comprehension',
            'key_points',
          ]
        : index % 3 === 1
          ? ['paraphrase', 'usage', 'sentence_composition', 'quick_response']
          : [
              'kanji_reading',
              'orthography',
              'context_expression',
              'sentence_grammar',
            ];
    return {
      id: `jlpt-${level.toLowerCase()}-lesson-${String(lessonNumber).padStart(3, '0')}`,
      level,
      module_number: moduleIndex + 1,
      lesson_number: lessonNumber,
      title: `${module[0]} · ${kind.focus} ${String(lessonNumber).padStart(3, '0')}`,
      module_goal: module[1],
      level_ability_goal: levelPlans[level].ability,
      phase: kind.phase,
      objectives: [
        kind.task,
        `掌握本课分配的 ${vocabularyGroups[index].length} 个词汇、${kanjiGroups[index].length} 个汉字和 ${grammarGroups[index].length} 个语法点。`,
        `精学 ${targetSentenceIds.length} 条目标例句，其余 ${referenceSentenceIds.length} 条作为检索和扩展语料。`,
        '通过复习任务把新内容与此前课程建立联系。',
      ],
      content_ids: {
        vocabulary: vocabularyGroups[index],
        kanji: kanjiGroups[index],
        grammar: grammarGroups[index],
        target_sentences: targetSentenceIds,
        reference_sentences: referenceSentenceIds,
      },
      activities: [
        {
          type: 'recognition',
          instruction: '形式—读音—含义三向识别；错误项进入本地错题与间隔复习。',
        },
        {
          type: 'controlled_practice',
          instruction: '完成语境选择、句子排序、改写和易混辨析。',
        },
        {
          type: 'reading',
          instruction:
            '使用本课及已学内容完成分级阅读；正式发布前补齐经审核文本和解析。',
        },
        {
          type: 'listening',
          instruction:
            '使用本课及已学内容完成分级听辨；正式发布前补齐经审核音频、脚本和解析。',
        },
        {
          type: 'output',
          instruction:
            '按情境组织 2—5 句口头或书面表达；AI 反馈为可选，不影响本地课程学习。',
        },
      ],
      official_item_type_alignment: itemTypes,
      pass_criteria: {
        recognition_accuracy: 0.8,
        production_accuracy: 0.7,
        reading_or_listening_accuracy: 0.7,
        minimum_review_items: 5,
      },
      review_plan: {
        first_review: 'same_day',
        later_reviews_days: [1, 3, 7, 14, 30],
        adaptive_rule: '按本地答题结果调整；未经用户主动选择不调用 AI。',
      },
      review_status: 'draft_needs_native_review',
    };
  });
}

fs.mkdirSync(dataDir, { recursive: true });
const glosses = loadChineseGlosses();
const tatoebaChinese = loadTatoebaChineseTranslations();
const posMap = readJson(path.join(inputDir, 'pos.json'));
const manifest = {
  schema_version: '0.2.0-draft',
  generated_on: generatedAt,
  review_status: 'draft_needs_native_review',
  levels: {},
  totals: {},
};
const curriculum = {
  schema_version: '0.2.0-draft',
  generated_on: generatedAt,
  disclaimer: officialBlueprint.disclaimer,
  levels: {},
};
const quality = {
  generated_on: generatedAt,
  status: 'draft_needs_native_review',
  blocking_release_issues: [
    '全部语法中文解释尚待翻译和母语者复核',
    'Tatoeba 未覆盖的例句仍待中文翻译，已有社区翻译也必须复核',
    '机器辅助中文词义不可直接作为正式教材发布',
    '尚未制作经审核的阅读文章、听力音频、题目和人工解析',
  ],
  levels: {},
};
let totalVocabulary = 0;
let totalKanji = 0;
let totalGrammar = 0;
let totalSentences = 0;
let totalLessons = 0;

for (const level of levels) {
  const slug = level.toLowerCase();
  const rawVocabulary = readJson(path.join(inputDir, `vocab-${slug}.json`));
  const rawKanji = readJson(path.join(inputDir, `kanji-${slug}.json`));
  const rawGrammar = readJson(path.join(inputDir, `grammar-${slug}.json`));
  const vocabulary = rawVocabulary.map((item) =>
    transformVocabulary(item, glosses, posMap),
  );
  const kanji = rawKanji.map((item) => transformKanji(item, glosses));
  const grammar = rawGrammar.map(transformGrammar);
  const sentences = extractSentences(rawVocabulary, rawGrammar, tatoebaChinese);
  const lessons = createLessons(level, vocabulary, kanji, grammar, sentences);

  writeJsonl(path.join(dataDir, `vocabulary-${level}.jsonl`), vocabulary);
  writeJsonl(path.join(dataDir, `kanji-${level}.jsonl`), kanji);
  writeJsonl(path.join(dataDir, `grammar-${level}.jsonl`), grammar);
  writeJsonl(path.join(dataDir, `sentences-${level}.jsonl`), sentences);
  writeJson(path.join(dataDir, `lessons-${level}.json`), lessons);

  const zhVocab = vocabulary.filter((item) => item.meanings_zh.length).length;
  const zhKanji = kanji.filter((item) => item.meanings_zh.length).length;
  const zhSentences = sentences.filter((item) => item.translation_zh).length;
  manifest.levels[level] = {
    files: {
      vocabulary: `data/vocabulary-${level}.jsonl`,
      kanji: `data/kanji-${level}.jsonl`,
      grammar: `data/grammar-${level}.jsonl`,
      sentences: `data/sentences-${level}.jsonl`,
      lessons: `data/lessons-${level}.json`,
    },
    counts: {
      vocabulary: vocabulary.length,
      kanji: kanji.length,
      grammar: grammar.length,
      sentences: sentences.length,
      lessons: lessons.length,
    },
  };
  curriculum.levels[level] = {
    ability_goal: levelPlans[level].ability,
    modules: levelPlans[level].modules.map(([title, goal], index) => ({
      module_number: index + 1,
      title,
      goal,
      lesson_ids: lessons
        .filter((lesson) => lesson.module_number === index + 1)
        .map((lesson) => lesson.id),
    })),
  };
  quality.levels[level] = {
    counts: manifest.levels[level].counts,
    chinese_coverage: {
      vocabulary: {
        complete: zhVocab,
        pending: vocabulary.length - zhVocab,
        ratio: Number((zhVocab / vocabulary.length).toFixed(4)),
      },
      kanji: {
        complete: zhKanji,
        pending: kanji.length - zhKanji,
        ratio: Number((zhKanji / kanji.length).toFixed(4)),
      },
      grammar: { complete: 0, pending: grammar.length, ratio: 0 },
      sentences: {
        complete: zhSentences,
        pending: sentences.length - zhSentences,
        ratio: Number((zhSentences / sentences.length).toFixed(4)),
      },
    },
  };
  totalVocabulary += vocabulary.length;
  totalKanji += kanji.length;
  totalGrammar += grammar.length;
  totalSentences += sentences.length;
  totalLessons += lessons.length;
}

manifest.totals = {
  vocabulary: totalVocabulary,
  kanji: totalKanji,
  grammar: totalGrammar,
  sentences: totalSentences,
  lessons: totalLessons,
};
writeJson(path.join(outputRoot, 'manifest.json'), manifest);
writeJson(path.join(outputRoot, 'curriculum_plan.json'), curriculum);
writeJson(path.join(outputRoot, 'exam_blueprint.json'), officialBlueprint);
writeJson(path.join(outputRoot, 'quality_report.json'), quality);
console.log(`Built JLPT draft corpus: ${JSON.stringify(manifest.totals)}`);
