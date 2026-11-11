import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AiSettingsStatus,
  AppSnapshot,
  ChatMessage,
  ConversationFeedback,
  ConversationHistoryItem,
  DialogueGroup,
  KanaProgress,
  JlptGrammarItem,
  JlptLessonDetail,
  JlptLessonSummary,
  JlptLevel,
  JlptProgress,
  JlptVocabularyItem,
  LessonDetail,
  LessonSummary,
  ProfileInput,
  ReviewCard,
  ReviewGrade,
  Scene,
  TodayTask,
} from '../shared/contracts';
import { extractJapaneseSpeech } from '../domain/conversation';
import type { PetPreferences, PetSnapshot } from '../shared/pet-contracts';
import {
  createMemoryDeck,
  getExampleWord,
  getLessonEntries,
  hasPriorKanaLessons,
  kanaCourse,
  shuffledKanaEntries,
  type KanaEntry,
  type KanaForm,
  type KanaLesson,
  type MemoryCard,
} from '../domain/kana';
import {
  createJlptMemoryDeck,
  createJlptReadingMatchItems,
  createSentenceChunks,
  createSentenceCompletionPuzzle,
  createSentenceOrderPuzzle,
  toHiragana,
  type JlptMemoryCard,
  type JlptSentencePuzzle,
} from '../domain/jlpt';
import appIconUrl from '../assets/app-icon-master.png';
import utaCardSakuraUrl from '../assets/uta-card-sakura.png';
import utaCardToriiUrl from '../assets/uta-card-torii.png';

type View = 'today' | 'learn' | 'conversation' | 'review' | 'settings';

const MINIMUM_SPLASH_DURATION_MS = 2_600;

const scenes: Array<{
  id: Scene;
  name: string;
  icon: string;
  description: string;
}> = [
  {
    id: 'hotel',
    name: '酒店住宿',
    icon: '🏨',
    description: '入住、接驳、温泉与问题处理',
  },
  {
    id: 'restaurant',
    name: '餐厅点餐',
    icon: '🍣',
    description: '日本料理、忌口、放题与结账',
  },
  {
    id: 'shopping',
    name: '购物付款',
    icon: '🛍️',
    description: '尺码、免税、付款与退换',
  },
  {
    id: 'sightseeing',
    name: '景点预约',
    icon: '⛩️',
    description: '门票、时段、规则与寺社',
  },
];

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: 'today', label: '今日', icon: '◉' },
  { id: 'learn', label: '学习', icon: '本' },
  { id: 'conversation', label: '对话', icon: '話' },
  { id: 'review', label: '复习', icon: '↻' },
  { id: 'settings', label: '设置', icon: '⚙' },
];

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('AI_AUTH_FAILED'))
    return 'API Key 无效或没有访问该模型的权限。';
  if (raw.includes('AI_REQUEST_FAILED'))
    return 'AI 服务请求失败，请检查地址、模型和账户状态。';
  if (raw.includes('AI_NOT_CONFIGURED'))
    return '请先在设置中配置并测试 AI API。';
  if (raw.includes('AI_BASE_URL_MUST_USE_HTTPS'))
    return 'API 地址必须使用 HTTPS；仅本机地址允许 HTTP。';
  if (raw.includes('CONVERSATION_NOT_FOUND'))
    return '这条对话已被删除或已超过 7 天保存期限。';
  if (raw.includes('SECURE_STORAGE_UNAVAILABLE'))
    return 'Windows 安全存储当前不可用。';
  return raw.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function speakJapanese(text: string) {
  const japanese = extractJapaneseSpeech(text);
  if (!japanese) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(japanese);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.82;
  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice =
    voices.find((voice) => voice.lang.toLowerCase() === 'ja-jp') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('ja'));
  if (japaneseVoice) utterance.voice = japaneseVoice;
  utterance.onstart = () => {
    void window.hiJapan.companion.setActivity('speak').catch(() => {});
  };
  const finishSpeech = () => {
    void window.hiJapan.companion.setActivity('idle').catch(() => {});
  };
  utterance.onend = finishSpeech;
  utterance.onerror = finishSpeech;
  window.speechSynthesis.speak(utterance);
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [view, setView] = useState<View>('today');
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError('');
      setSnapshot(await window.hiJapan.app.getSnapshot());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setTimeout(
      () => setSplashElapsed(true),
      MINIMUM_SPLASH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(
    () =>
      window.hiJapan.companion.onNavigate((destination) => {
        setView(destination);
        setSelectedLesson(null);
      }),
    [],
  );
  useEffect(() => {
    void window.hiJapan.companion
      .setActivity(view === 'learn' || view === 'review' ? 'study' : 'idle')
      .catch(() => {});
  }, [view]);
  useEffect(
    () =>
      window.hiJapan.companion.onLesson((id) => {
        setSelectedLesson(id);
        setView('learn');
      }),
    [],
  );

  if (loading || !splashElapsed) return <LoadingScreen startup />;
  if (error && !snapshot) return <FatalError message={error} retry={refresh} />;
  if (!snapshot?.isOnboarded) return <Onboarding onComplete={setSnapshot} />;

  const openLesson = (lessonId: string) => {
    setSelectedLesson(lessonId);
    setView('learn');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={appIconUrl} alt="" />
          <div>
            <strong>HiJapan</strong>
            <span>日语随行</span>
          </div>
        </div>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button
              className={view === item.id ? 'nav-button active' : 'nav-button'}
              key={item.id}
              onClick={() => {
                setView(item.id);
                setSelectedLesson(null);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'review' && snapshot.stats.dueReviews > 0 && (
                <span className="nav-badge">{snapshot.stats.dueReviews}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>本地模式</span>
          <small>课程学习不调用 AI</small>
        </div>
      </aside>

      <main className="main-area">
        {snapshot.content.reviewStatus.includes('draft') && (
          <div className="draft-banner">
            当前教材为开发审阅版，尚待日语母语者审核，不应作为正式发布内容。
          </div>
        )}
        {error && <InlineAlert message={error} onClose={() => setError('')} />}
        {view === 'today' && (
          <TodayView
            snapshot={snapshot}
            openLesson={openLesson}
            goTo={setView}
          />
        )}
        {view === 'learn' &&
          (selectedLesson?.startsWith('kana-') ? (
            <KanaLessonPlayer
              key={selectedLesson}
              lesson={kanaCourse.lessons.find(
                (item) => item.id === selectedLesson,
              )!}
              onBack={() => setSelectedLesson(null)}
              onProgress={refresh}
            />
          ) : selectedLesson?.startsWith('jlpt-') ? (
            <JlptLessonPlayer
              key={selectedLesson}
              lessonId={selectedLesson.split('::')[0]!}
              initialStage={
                (selectedLesson.split('::')[1] as JlptStage) ?? 'menu'
              }
              onBack={() => setSelectedLesson(null)}
              onProgress={refresh}
            />
          ) : selectedLesson ? (
            <LessonView
              lessonId={selectedLesson}
              onBack={() => setSelectedLesson(null)}
              onComplete={async () => {
                await refresh();
                setSelectedLesson(null);
              }}
            />
          ) : (
            <LearnView openLesson={openLesson} />
          ))}
        {view === 'conversation' && <ConversationView />}
        {view === 'review' && <ReviewView onChange={refresh} />}
        {view === 'settings' && (
          <SettingsView snapshot={snapshot} onChange={refresh} />
        )}
      </main>
    </div>
  );
}

function LoadingScreen({ startup = false }: { startup?: boolean }) {
  return (
    <div
      className={startup ? 'splash-screen startup' : 'splash-screen'}
      role="status"
      aria-live="polite"
    >
      <div className="splash-status">
        <div className="spinner small" />
        <span>正在准备本地课程…</span>
      </div>
    </div>
  );
}

function FatalError({
  message,
  retry,
}: {
  message: string;
  retry: () => Promise<void>;
}) {
  return (
    <div className="center-screen">
      <h1>软件启动失败</h1>
      <p>{message}</p>
      <button className="primary" onClick={() => void retry()}>
        重试
      </button>
    </div>
  );
}

function InlineAlert({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="inline-alert" role="alert">
      <span>{message}</span>
      <button onClick={onClose}>关闭</button>
    </div>
  );
}

function Onboarding({
  onComplete,
}: {
  onComplete: (snapshot: AppSnapshot) => void;
}) {
  const [step, setStep] = useState<'ai' | 'profile'>('ai');
  const [aiConfigured, setAiConfigured] = useState(false);

  return (
    <div className="onboarding-shell">
      <section className="onboarding-aside">
        <div className="brand large">
          <img className="brand-mark" src={appIconUrl} alt="" />
          <div>
            <strong>HiJapan</strong>
            <span>按你的目的学习真正用得上的日语</span>
          </div>
        </div>
        <ol className="steps">
          <li className={step === 'ai' ? 'current' : 'done'}>
            1. AI 配置（可跳过）
          </li>
          <li className={step === 'profile' ? 'current' : ''}>2. 学习目标</li>
        </ol>
        <p>
          课程、进度和复习全部保存在这台电脑。只有你主动使用 AI 功能时才会联网。
        </p>
      </section>
      <section className="onboarding-content">
        {step === 'ai' ? (
          <>
            <header className="page-header compact">
              <span className="eyebrow">第一步</span>
              <h1>配置你的 AI API</h1>
              <p>
                用于自由对话和自愿测试分析。旅游课程无需
                AI，之后也可以在设置中配置。
              </p>
            </header>
            <AiSettingsPanel
              onboarding
              onSaved={() => {
                setAiConfigured(true);
                setStep('profile');
              }}
            />
            <button className="text-button" onClick={() => setStep('profile')}>
              暂不配置，先使用本地课程 →
            </button>
          </>
        ) : (
          <ProfileForm aiConfigured={aiConfigured} onComplete={onComplete} />
        )}
      </section>
    </div>
  );
}

function ProfileForm({
  aiConfigured,
  onComplete,
}: {
  aiConfigured: boolean;
  onComplete: (snapshot: AppSnapshot) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [dailyMinutes, setDailyMinutes] =
    useState<ProfileInput['dailyMinutes']>(10);
  const [level, setLevel] = useState<ProfileInput['level']>('starter');
  const [focusScenes, setFocusScenes] = useState<Scene[]>([
    'restaurant',
    'hotel',
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleScene = (scene: Scene) => {
    setFocusScenes((current) =>
      current.includes(scene)
        ? current.filter((item) => item !== scene)
        : [...current, scene],
    );
  };

  const submit = async () => {
    if (focusScenes.length === 0) {
      setError('请至少选择一个重点场景。');
      return;
    }
    setSaving(true);
    try {
      const next = await window.hiJapan.app.saveProfile({
        displayName,
        primaryMode: 'travel',
        dailyMinutes,
        level,
        focusScenes,
      });
      onComplete(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header compact">
        <span className="eyebrow">第二步</span>
        <h1>你想先学什么？</h1>
        <p>
          {aiConfigured ? 'AI 已配置。' : 'AI 已跳过。'}{' '}
          首版先从旅行日语开始，可随时修改。
        </p>
      </header>
      {error && <InlineAlert message={error} onClose={() => setError('')} />}
      <label className="field">
        <span>称呼（可选）</span>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="例如：小林"
        />
      </label>
      <fieldset className="choice-section">
        <legend>目前的日语水平</legend>
        <div className="segmented">
          {[
            ['starter', '零基础/刚入门'],
            ['N5', '约 N5'],
            ['N4_or_above', 'N4 或以上'],
          ].map(([value, label]) => (
            <button
              className={level === value ? 'selected' : ''}
              key={value}
              onClick={() => setLevel(value as ProfileInput['level'])}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-section">
        <legend>每天学习时间</legend>
        <div className="segmented compact-segments">
          {[5, 10, 20, 30].map((minutes) => (
            <button
              className={dailyMinutes === minutes ? 'selected' : ''}
              key={minutes}
              onClick={() =>
                setDailyMinutes(minutes as ProfileInput['dailyMinutes'])
              }
            >
              {minutes} 分钟
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-section">
        <legend>旅行重点场景（可多选）</legend>
        <div className="scene-grid small">
          {scenes.map((scene) => (
            <button
              className={
                focusScenes.includes(scene.id)
                  ? 'scene-card selected'
                  : 'scene-card'
              }
              key={scene.id}
              onClick={() => toggleScene(scene.id)}
            >
              <span>{scene.icon}</span>
              <strong>{scene.name}</strong>
              <small>{scene.description}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <button
        className="primary wide"
        disabled={saving}
        onClick={() => void submit()}
      >
        {saving ? '正在建立计划…' : '开始学习'}
      </button>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function TodayView({
  snapshot,
  openLesson,
  goTo,
}: {
  snapshot: AppSnapshot;
  openLesson: (lessonId: string) => void;
  goTo: (view: View) => void;
}) {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const name = snapshot.profile?.displayName
    ? `，${snapshot.profile.displayName}`
    : '';

  useEffect(() => {
    void window.hiJapan.learning.getTodayPlan().then(setTasks);
  }, [snapshot.stats.completedLessons, snapshot.stats.dueReviews]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="今日学习"
        title={`こんにちは${name}`}
        description={`按 ${snapshot.profile?.dailyMinutes ?? 10} 分钟预算安排；先复习，再学习新内容。`}
      />
      <div className="stat-grid">
        <Stat
          label="已完成课程"
          value={`${snapshot.stats.completedLessons}/${snapshot.stats.totalLessons}`}
        />
        <Stat label="已接触内容" value={String(snapshot.stats.learnedItems)} />
        <Stat
          label="到期复习"
          value={String(snapshot.stats.dueReviews)}
          accent
        />
        <Stat label="软件版本" value={snapshot.appVersion} />
      </div>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TODAY</span>
            <h2>今日任务</h2>
          </div>
          <span className="duration">
            约 {tasks.reduce((sum, task) => sum + task.minutes, 0)} 分钟
          </span>
        </div>
        <div className="task-list">
          {tasks.map((task, index) => (
            <button
              className="task-row"
              key={task.id}
              onClick={() => {
                if (task.lessonId) openLesson(task.lessonId);
                else if (task.type === 'review') goTo('review');
                else goTo('learn');
              }}
            >
              <span className="task-number">{index + 1}</span>
              <span className="task-copy">
                <strong>{task.title}</strong>
                <small>{task.detail}</small>
              </span>
              <span>{task.minutes} 分钟 →</span>
            </button>
          ))}
          {tasks.length === 0 && (
            <p className="empty-copy">今天的任务已完成，可以自由浏览课程。</p>
          )}
        </div>
      </section>
      <section className="mode-note">
        <div>
          <span className="eyebrow">后续内容</span>
          <h2>JLPT 模式正在准备审核题库</h2>
          <p>
            软件框架已经预留，但不会使用 AI
            临时生成正式考题。当前先完成旅行日语闭环。
          </p>
        </div>
        <span className="big-kanji">学</span>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? 'stat-card accent' : 'stat-card'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LearnView({ openLesson }: { openLesson: (lessonId: string) => void }) {
  const [learningArea, setLearningArea] = useState<'kana' | 'jlpt' | 'travel'>(
    'kana',
  );
  const [selectedScene, setSelectedScene] = useState<Scene>('restaurant');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [dialogues, setDialogues] = useState<DialogueGroup[]>([]);
  const [tab, setTab] = useState<'lessons' | 'dialogues'>('lessons');
  const [kanaLesson, setKanaLesson] = useState<KanaLesson | null>(null);
  const [kanaProgress, setKanaProgress] = useState<KanaProgress | null>(null);
  const [jlptLevel, setJlptLevel] = useState<JlptLevel>('N5');
  const [jlptLessons, setJlptLessons] = useState<JlptLessonSummary[]>([]);
  const [jlptProgress, setJlptProgress] = useState<JlptProgress | null>(null);
  const [selectedJlptLesson, setSelectedJlptLesson] = useState<string | null>(
    null,
  );

  const refreshKanaProgress = useCallback(async () => {
    setKanaProgress(await window.hiJapan.learning.getKanaProgress());
  }, []);

  useEffect(() => {
    void refreshKanaProgress();
  }, [refreshKanaProgress]);

  useEffect(() => {
    void Promise.all([
      window.hiJapan.learning.listLessons(selectedScene),
      window.hiJapan.learning.listDialogues(selectedScene),
    ]).then(([nextLessons, nextDialogues]) => {
      setLessons(nextLessons);
      setDialogues(nextDialogues);
    });
  }, [selectedScene]);

  const refreshJlpt = useCallback(async () => {
    const [nextLessons, nextProgress] = await Promise.all([
      window.hiJapan.learning.listJlptLessons(jlptLevel),
      window.hiJapan.learning.getJlptProgress(),
    ]);
    setJlptLessons(nextLessons);
    setJlptProgress(nextProgress);
  }, [jlptLevel]);

  useEffect(() => {
    if (learningArea === 'jlpt') void refreshJlpt();
  }, [learningArea, refreshJlpt]);

  if (kanaLesson) {
    return (
      <KanaLessonPlayer
        lesson={kanaLesson}
        onBack={() => setKanaLesson(null)}
        onProgress={refreshKanaProgress}
      />
    );
  }

  if (selectedJlptLesson) {
    return (
      <JlptLessonPlayer
        lessonId={selectedJlptLesson}
        onBack={() => setSelectedJlptLesson(null)}
        onProgress={refreshJlpt}
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="本地学习资料"
        title="选择学习内容"
        description="五十音和旅行课程都完全离线运行，不需要配置 AI。"
      />
      <div className="learning-area-tabs">
        <button
          className={learningArea === 'kana' ? 'active' : ''}
          onClick={() => setLearningArea('kana')}
        >
          <span className="area-kanji">あ</span>
          <span>
            <strong>五十音基础</strong>
            <small>平假名、片假名、拼读与测试</small>
          </span>
        </button>
        <button
          className={learningArea === 'jlpt' ? 'active' : ''}
          onClick={() => setLearningArea('jlpt')}
        >
          <span className="area-kanji">級</span>
          <span>
            <strong>JLPT N5—N1</strong>
            <small>词汇、语法、例句与综合测试</small>
          </span>
        </button>
        <button
          className={learningArea === 'travel' ? 'active' : ''}
          onClick={() => setLearningArea('travel')}
        >
          <span className="area-kanji">旅</span>
          <span>
            <strong>旅行场景日语</strong>
            <small>酒店、餐厅、购物与景点</small>
          </span>
        </button>
      </div>

      {learningArea === 'kana' ? (
        <section className="kana-course-map">
          <div className="kana-course-intro">
            <div>
              <span className="eyebrow">五节课程 · 每节两行</span>
              <h2>从 あ 行学到 わ 行</h2>
              <p>
                建议先认识平假名与片假名，再用已学假名拼读词语；也可以自由跳到连线、翻牌复习，或把已经掌握的课程直接标记完成。
              </p>
            </div>
            <strong>
              {kanaProgress?.completedLessonIds.length ?? 0} /{' '}
              {kanaCourse.lessons.length}
            </strong>
          </div>
          <div className="kana-lesson-grid">
            {kanaCourse.lessons.map((lesson, index) => {
              const completed =
                kanaProgress?.completedLessonIds.includes(lesson.id) ?? false;
              const gameCompleted =
                kanaProgress?.gameCompletedLessonIds.includes(lesson.id) ??
                false;
              return (
                <button
                  className={`kana-lesson-card ${completed ? 'completed' : ''}`}
                  key={lesson.id}
                  onClick={() => setKanaLesson(lesson)}
                >
                  <span className="kana-step">{index + 1}</span>
                  <span className="kana-lesson-copy">
                    <small>
                      {lesson.rows.map((row) => row.name).join(' + ')}
                    </small>
                    <strong>{lesson.title}</strong>
                    <span>
                      {lesson.rows
                        .flatMap((row) => row.entries)
                        .map((entry) => entry.hiragana)
                        .join('　')}
                    </span>
                  </span>
                  <span className="kana-status">
                    {gameCompleted
                      ? '学习与游戏已完成'
                      : completed
                        ? '已完成或标记掌握'
                        : index === 0
                          ? '建议从这里开始'
                          : '可自由开始'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="content-review-note">
            本五十音课程为开发审阅版，日语词例仍需母语者正式审核。
          </p>
        </section>
      ) : learningArea === 'jlpt' ? (
        <section className="jlpt-course-map">
          <div className="jlpt-level-tabs" aria-label="选择 JLPT 等级">
            {(['N5', 'N4', 'N3', 'N2', 'N1'] as JlptLevel[]).map((level) => (
              <button
                className={jlptLevel === level ? 'active' : ''}
                key={level}
                onClick={() => setJlptLevel(level)}
              >
                <strong>{level}</strong>
                <small>
                  {
                    jlptProgress?.completedLessonIds.filter((id) =>
                      id.startsWith(`jlpt-${level.toLowerCase()}-`),
                    ).length
                  }{' '}
                  已完成
                </small>
              </button>
            ))}
          </div>
          <div className="jlpt-course-intro">
            <div>
              <span className="eyebrow">每节 5—10 分钟 · 约 10 个新词</span>
              <h2>{jlptLevel} 词汇与语法课程</h2>
              <p>
                先学习词义与语法例句，再完成本节匹配和组句测试；完成过课程后可随时进行综合复习。
              </p>
            </div>
            <button
              className="secondary"
              disabled={
                !jlptProgress?.completedLessonIds.some((id) =>
                  id.startsWith(`jlpt-${jlptLevel.toLowerCase()}-`),
                )
              }
              onClick={async () => {
                const cumulative =
                  await window.hiJapan.learning.getJlptCumulativeLesson(
                    jlptLevel,
                  );
                if (cumulative)
                  setSelectedJlptLesson(`cumulative:${jlptLevel}`);
              }}
            >
              综合复习
            </button>
          </div>
          <div className="jlpt-lesson-grid">
            {jlptLessons.map((lesson) => (
              <button
                className={`jlpt-lesson-card ${lesson.status}`}
                key={lesson.id}
                onClick={() => setSelectedJlptLesson(lesson.id)}
              >
                <span className="jlpt-lesson-number">
                  {String(lesson.lessonNumber).padStart(2, '0')}
                </span>
                <span>
                  <strong>{lesson.title}</strong>
                  <small>
                    {lesson.vocabularyCount} 词 · {lesson.grammarCount} 语法 ·{' '}
                    {lesson.minutes} 分钟
                  </small>
                </span>
                <em>
                  {lesson.status === 'completed'
                    ? `${Math.round(lesson.lessonScore ?? 0)} 分`
                    : '开始'}
                </em>
              </button>
            ))}
          </div>
          <p className="content-review-note">
            本课程为开发审阅版；中文机翻、等级划分和日语例句均待人工审核。
          </p>
        </section>
      ) : (
        <>
          <div className="scene-tabs">
            {scenes.map((scene) => (
              <button
                className={selectedScene === scene.id ? 'active' : ''}
                key={scene.id}
                onClick={() => setSelectedScene(scene.id)}
              >
                <span>{scene.icon}</span>
                {scene.name}
              </button>
            ))}
          </div>
          <div className="subtabs">
            <button
              className={tab === 'lessons' ? 'active' : ''}
              onClick={() => setTab('lessons')}
            >
              课程
            </button>
            <button
              className={tab === 'dialogues' ? 'active' : ''}
              onClick={() => setTab('dialogues')}
            >
              固定对话
            </button>
          </div>
          {tab === 'lessons' ? (
            <div className="lesson-grid">
              {lessons.map((lesson, index) => (
                <button
                  className="lesson-card"
                  key={lesson.lessonId}
                  onClick={() => openLesson(lesson.lessonId)}
                >
                  <div className="lesson-index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="lesson-card-copy">
                    <div className="meta-row">
                      <span>{lesson.level}</span>
                      <span>{lesson.minutes} 分钟</span>
                      <span>{lesson.itemCount} 项内容</span>
                    </div>
                    <h2>{lesson.title}</h2>
                    <p>{lesson.objectives}</p>
                  </div>
                  <span className={`status-pill ${lesson.status}`}>
                    {lesson.status === 'completed'
                      ? '已完成'
                      : lesson.status === 'in_progress'
                        ? '继续'
                        : '开始'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <DialogueList groups={dialogues} />
          )}
        </>
      )}
    </div>
  );
}

type KanaStage =
  | 'menu'
  | 'characters'
  | 'words'
  | 'practice-choice'
  | 'current-test'
  | 'cumulative-test'
  | 'game'
  | 'finished';

function KanaLessonPlayer({
  lesson,
  onBack,
  onProgress,
}: {
  lesson: KanaLesson;
  onBack: () => void;
  onProgress: () => Promise<void>;
}) {
  const lessonIndex = kanaCourse.lessons.findIndex(
    (item) => item.id === lesson.id,
  );
  const entries = lesson.rows.flatMap((row) => row.entries);
  const [stage, setStage] = useState<KanaStage>('menu');
  const [position, setPosition] = useState(0);

  const goTo = (nextStage: KanaStage) => {
    setPosition(0);
    setStage(nextStage);
  };

  const nextCharacter = () => {
    if (position < entries.length - 1) setPosition(position + 1);
    else {
      goTo('words');
    }
  };
  const nextWord = () => {
    if (position < lesson.words.length - 1) setPosition(position + 1);
    else {
      goTo('practice-choice');
    }
  };
  const saveCompletion = async (gameCompleted = false) => {
    await window.hiJapan.learning.completeKanaLesson(lesson.id, gameCompleted);
    await onProgress();
  };
  const skipLesson = async () => {
    if (
      !window.confirm(
        `确认将“${lesson.title}”标记为已掌握吗？之后仍可随时回来重新学习。`,
      )
    )
      return;
    await saveCompletion(false);
    onBack();
  };

  if (stage === 'menu' || stage === 'practice-choice') {
    return (
      <div className="kana-entry-page">
        <button className="back-button" onClick={onBack}>
          ← 返回五十音课程
        </button>
        <section className="kana-entry-panel">
          <span className="eyebrow">
            {stage === 'menu' ? '自由选择学习方式' : '已完成认识与拼读'}
          </span>
          <h1>{lesson.title}</h1>
          <p>
            {stage === 'menu'
              ? '你可以按推荐顺序学习，也可以直接进入适合自己的复习方式。所有选项都在本机运行。'
              : '接下来可以自由选择连线或翻牌练习，也可以跳过练习并完成本节。'}
          </p>
          <div className="kana-entry-options">
            <button className="featured" onClick={() => goTo('characters')}>
              <span>学</span>
              <strong>
                {stage === 'menu' ? '完整学习本节' : '重新学习本节'}
              </strong>
              <small>认识假名 → 拼读词语</small>
            </button>
            <button onClick={() => goTo('current-test')}>
              <span>結</span>
              <strong>本节连线复习</strong>
              <small>只匹配 {lesson.title} 的假名</small>
            </button>
            {hasPriorKanaLessons(lessonIndex) && (
              <button onClick={() => goTo('cumulative-test')}>
                <span>復</span>
                <strong>累计连线复习</strong>
                <small>复习本节及此前全部假名</small>
              </button>
            )}
            <button onClick={() => goTo('game')}>
              <span>遊</span>
              <strong>直接翻牌复习</strong>
              <small>用歌牌游戏巩固记忆</small>
            </button>
          </div>
          <button
            className="skip-lesson-button"
            onClick={() => void skipLesson()}
          >
            我已经学过，标记掌握并跳过本节
          </button>
        </section>
      </div>
    );
  }

  if (stage === 'game') {
    return (
      <KanaMemoryGame
        lesson={lesson}
        entries={getLessonEntries(lessonIndex, true)}
        onBack={() => goTo('menu')}
        onComplete={async () => {
          await saveCompletion(true);
          goTo('finished');
        }}
      />
    );
  }

  if (stage === 'current-test' || stage === 'cumulative-test') {
    const cumulative = stage === 'cumulative-test';
    return (
      <KanaMatchingTest
        key={stage}
        title={cumulative ? '累计连线复习' : '本节连线复习'}
        description="请匹配"
        entries={getLessonEntries(lessonIndex, cumulative)}
        onBack={() => goTo('menu')}
        onComplete={async () => {
          await saveCompletion(false);
          goTo('finished');
        }}
      />
    );
  }

  if (stage === 'finished') {
    return (
      <div className="kana-celebration">
        <button className="back-button" onClick={onBack}>
          ← 返回五十音课程
        </button>
        <section>
          <span className="celebration-mark">✓</span>
          <span className="eyebrow">本节进度已保存</span>
          <h1>{lesson.title} 已完成</h1>
          <p>你可以返回课程自由选择下一节，也可以继续用连线或翻牌巩固。</p>
          <div className="button-row centered">
            <button className="primary" onClick={() => goTo('current-test')}>
              再做本节连线
            </button>
            <button className="secondary" onClick={() => goTo('game')}>
              玩翻牌游戏
            </button>
            <button className="secondary" onClick={onBack}>
              返回课程
            </button>
          </div>
        </section>
      </div>
    );
  }

  const currentEntry = entries[position];
  const currentWord = lesson.words[position];
  return (
    <div className="kana-player">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回五十音课程
        </button>
        <div>
          <strong>{lesson.title}</strong>
          <small>
            {stage === 'characters' ? '认识假名' : '用已学假名拼读词语'}
          </small>
        </div>
        <span>
          {position + 1} /{' '}
          {stage === 'characters' ? entries.length : lesson.words.length}
        </span>
      </header>
      <div className="progress-track">
        <span
          style={{
            width: `${((position + 1) / (stage === 'characters' ? entries.length : lesson.words.length)) * 100}%`,
          }}
        />
      </div>
      {stage === 'characters' && currentEntry ? (
        <section className="kana-study-card">
          <span className="card-type">平假名 · 片假名 · 罗马音</span>
          <div className="kana-pair-display">
            <div>
              <small>平假名</small>
              <strong lang="ja">{currentEntry.hiragana}</strong>
            </div>
            <div>
              <small>片假名</small>
              <strong lang="ja">{currentEntry.katakana}</strong>
            </div>
          </div>
          <div className="romaji-chip">{currentEntry.romaji}</div>
          <button
            className="audio-button icon-only"
            onClick={() => speakJapanese(currentEntry.hiragana)}
            aria-label="播放假名发音"
            title="播放发音"
          >
            🔊
          </button>
          <button className="text-button compact" onClick={() => goTo('words')}>
            跳过认识，直接拼读词语
          </button>
          <button className="primary wide" onClick={nextCharacter}>
            {position === entries.length - 1 ? '开始拼读词语 →' : '认识了 →'}
          </button>
        </section>
      ) : currentWord ? (
        <section className="kana-study-card word-stage">
          <span className="card-type">拼读练习 · 只使用已学假名</span>
          <h1 lang="ja">{currentWord.japanese}</h1>
          <p className="word-reading" lang="ja">
            {currentWord.reading}
          </p>
          <strong className="word-meaning">{currentWord.meaning_zh}</strong>
          <button
            className="audio-button icon-only"
            onClick={() => speakJapanese(currentWord.reading)}
            aria-label="播放词语读音"
            title="播放读音"
          >
            🔊
          </button>
          <button
            className="text-button compact"
            onClick={() => goTo('practice-choice')}
          >
            跳过词语，选择复习方式
          </button>
          <button className="primary wide" onClick={nextWord}>
            {position === lesson.words.length - 1
              ? '选择复习方式 →'
              : '下一个词 →'}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function KanaMatchingTest({
  title,
  description,
  entries,
  onBack,
  onComplete,
}: {
  title: string;
  description: string;
  entries: KanaEntry[];
  onBack: () => void;
  onComplete: () => void | Promise<void>;
}) {
  const forms: Array<{ id: KanaForm; label: string }> = [
    { id: 'hiragana', label: '平假名' },
    { id: 'katakana', label: '片假名' },
    { id: 'romaji', label: '罗马音' },
  ];
  const [columns] = useState(() => ({
    hiragana: shuffledKanaEntries(entries),
    katakana: shuffledKanaEntries(entries),
    romaji: shuffledKanaEntries(entries),
  }));
  const [selected, setSelected] = useState<Partial<Record<KanaForm, string>>>(
    {},
  );
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const choose = (form: KanaForm, entry: KanaEntry) => {
    if (completed.has(entry.romaji)) return;
    const next = { ...selected, [form]: entry.romaji };
    setSelected(next);
    if (!next.hiragana || !next.katakana || !next.romaji) return;
    if (next.hiragana === next.katakana && next.katakana === next.romaji) {
      const word = getExampleWord(entry);
      setCompleted((current) => new Set(current).add(entry.romaji));
      setFeedback({
        ok: true,
        message: word
          ? `${word.japanese}（${word.reading}）：${word.meaning_zh}`
          : `${entry.hiragana} · ${entry.katakana} · ${entry.romaji}`,
      });
      if (word) speakJapanese(word.reading);
      setSelected({});
    } else {
      setFeedback({
        ok: false,
        message: '这三个选项不属于同一个假名，请重试。',
      });
      window.setTimeout(() => {
        setSelected({});
        setFeedback(null);
      }, 650);
    }
  };

  const done = completed.size === entries.length;
  return (
    <div className="kana-test-page">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回上一步
        </button>
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
        <span>
          {completed.size} / {entries.length}
        </span>
      </header>
      <div className="progress-track">
        <span
          style={{ width: `${(completed.size / entries.length) * 100}%` }}
        />
      </div>
      <div
        className={
          feedback?.ok
            ? 'kana-test-feedback correct'
            : feedback
              ? 'kana-test-feedback wrong'
              : 'kana-test-feedback'
        }
      >
        {feedback?.message ?? '请匹配'}
      </div>
      <div className="kana-match-board">
        {forms.map((form) => (
          <section key={form.id}>
            <h2>{form.label}</h2>
            <div>
              {columns[form.id].map((entry) => {
                const isComplete = completed.has(entry.romaji);
                const isSelected = selected[form.id] === entry.romaji;
                return (
                  <button
                    className={`${isComplete ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                    disabled={isComplete}
                    key={`${form.id}-${entry.romaji}`}
                    onClick={() => choose(form.id, entry)}
                  >
                    {entry[form.id]}
                    {isComplete && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {done && (
        <button
          className="primary kana-test-next"
          onClick={() => void onComplete()}
        >
          完成本轮，继续 →
        </button>
      )}
    </div>
  );
}

function KanaMemoryGame({
  lesson,
  entries,
  onBack,
  onComplete,
}: {
  lesson: KanaLesson;
  entries: KanaEntry[];
  onBack: () => void;
  onComplete: () => Promise<void>;
}) {
  const [deck, setDeck] = useState<MemoryCard[]>(() =>
    createMemoryDeck(entries),
  );
  const [openCards, setOpenCards] = useState<string[]>([]);
  const [matchedCards, setMatchedCards] = useState<Set<string>>(
    () => new Set(),
  );
  const [saving, setSaving] = useState(false);

  const selectCard = (card: MemoryCard) => {
    if (
      openCards.length >= 2 ||
      openCards.includes(card.id) ||
      matchedCards.has(card.id)
    )
      return;
    const next = [...openCards, card.id];
    setOpenCards(next);
    if (next.length !== 2) return;
    const [firstId, secondId] = next;
    const first = deck.find((item) => item.id === firstId);
    const second = deck.find((item) => item.id === secondId);
    if (first && second && first.matchId === second.matchId) {
      window.setTimeout(() => {
        setMatchedCards((current) =>
          new Set(current).add(first.id).add(second.id),
        );
        setOpenCards([]);
        const entry = entries.find((item) => item.romaji === first.matchId);
        if (entry) speakJapanese(entry.hiragana);
      }, 380);
    } else {
      window.setTimeout(() => setOpenCards([]), 780);
    }
  };

  const won = matchedCards.size === deck.length;
  const restart = () => {
    setDeck(createMemoryDeck(entries));
    setOpenCards([]);
    setMatchedCards(new Set());
  };
  const save = async () => {
    setSaving(true);
    await onComplete();
  };

  return (
    <div className="kana-game-page">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 暂停游戏
        </button>
        <div>
          <strong>{lesson.title} · 翻牌游戏</strong>
          <small>找到属于同一个假名的两张牌</small>
        </div>
        <span>
          {matchedCards.size / 2} / {deck.length / 2}
        </span>
      </header>
      <div className="uta-game-board">
        {deck.map((card) => {
          const open = openCards.includes(card.id);
          const matched = matchedCards.has(card.id);
          return (
            <button
              className={`uta-card ${open ? 'open' : ''} ${matched ? 'removed' : ''}`}
              disabled={matched}
              key={card.id}
              onClick={() => selectCard(card)}
              aria-label={open ? card.value : '翻开歌牌'}
            >
              <span className="uta-card-inner">
                <span
                  className={`uta-card-back ${card.back}`}
                  style={{
                    backgroundImage: `url(${card.back === 'torii' ? utaCardToriiUrl : utaCardSakuraUrl})`,
                  }}
                  aria-hidden="true"
                />
                <span className="uta-card-front" lang="ja">
                  <strong>{card.value}</strong>
                  <small>
                    {card.form === 'hiragana'
                      ? '平假名'
                      : card.form === 'katakana'
                        ? '片假名'
                        : '罗马音'}
                  </small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {won && (
        <div className="game-result">
          <strong>全部配对完成！</strong>
          <div className="button-row centered">
            <button className="secondary" onClick={restart}>
              再玩一局
            </button>
            <button
              className="primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? '正在保存…' : '保存游戏成绩'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type JlptStage =
  | 'menu'
  | 'vocabulary'
  | 'grammar'
  | 'matching'
  | 'puzzle'
  | 'game'
  | 'finished';

function JlptLessonPlayer({
  initialStage = 'menu',
  lessonId,
  onBack,
  onProgress,
}: {
  initialStage?: JlptStage;
  lessonId: string;
  onBack: () => void;
  onProgress: () => Promise<void>;
}) {
  const cumulativeLevel = lessonId.startsWith('cumulative:')
    ? (lessonId.split(':')[1] as JlptLevel)
    : null;
  const [lesson, setLesson] = useState<JlptLessonDetail | null>(null);
  const [stage, setStage] = useState<JlptStage>(initialStage);
  const [position, setPosition] = useState(0);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [revealedToken, setRevealedToken] = useState<number | null>(null);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [revealedExtraToken, setRevealedExtraToken] = useState<string | null>(
    null,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    const request = cumulativeLevel
      ? window.hiJapan.learning.getJlptCumulativeLesson(cumulativeLevel)
      : window.hiJapan.learning.getJlptLesson(lessonId);
    void request
      .then((value) => {
        if (!value) throw new Error('请先完成至少一节课程，再进行综合复习。');
        setLesson(value);
        if (initialStage === 'puzzle' && !value.grammar.length)
          setStage('matching');
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, [cumulativeLevel, lessonId]);

  if (error) return <FatalError message={error} retry={async () => onBack()} />;
  if (!lesson) return <LoadingScreen />;

  const goTo = (next: JlptStage) => {
    setPosition(0);
    setRevealedToken(null);
    setShowMoreExamples(false);
    setRevealedExtraToken(null);
    setStage(next);
  };
  const finish = async (gameCompleted = false) => {
    if (!cumulativeLevel) {
      const total = lesson.vocabulary.length + lesson.grammar.length;
      const uniqueMistakes = [...new Set(mistakes)];
      await window.hiJapan.learning.completeJlptLesson({
        lessonId: lesson.id,
        score:
          total === 0
            ? 100
            : Math.max(0, ((total - uniqueMistakes.length) / total) * 100),
        difficultItemIds: uniqueMistakes,
        gameCompleted,
      });
      await onProgress();
    }
    goTo('finished');
  };

  if (stage === 'menu') {
    return (
      <div className="jlpt-entry-page">
        <button className="back-button" onClick={onBack}>
          ← 返回 JLPT 课程
        </button>
        <section className="jlpt-entry-panel">
          <span className="eyebrow">
            {cumulativeLevel
              ? '只使用已完成课程出题'
              : `${lesson.minutes} 分钟短课`}
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.description}</p>
          <div className="jlpt-entry-options">
            {!cumulativeLevel && (
              <button className="featured" onClick={() => goTo('vocabulary')}>
                <span>学</span>
                <strong>完整学习本节</strong>
                <small>单词 → 语法例句 → 测试</small>
              </button>
            )}
            <button onClick={() => goTo('matching')}>
              <span>試</span>
              <strong>
                {cumulativeLevel ? '开始综合测试' : '直接做本节测试'}
              </strong>
              <small>读音匹配、句子补全与完整组句</small>
            </button>
            <button onClick={() => goTo('game')}>
              <span>遊</span>
              <strong>词汇翻牌游戏</strong>
              <small>平假名读音与单词释义配对</small>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (stage === 'matching') {
    return (
      <JlptMatchingTest
        vocabulary={lesson.vocabulary}
        onBack={() => goTo('menu')}
        onComplete={(wrongIds) => {
          setMistakes((items) => [...items, ...wrongIds]);
          if (lesson.grammar.length) goTo('puzzle');
          else void finish(false);
        }}
      />
    );
  }
  if (stage === 'puzzle') {
    return (
      <JlptSentenceTest
        grammar={lesson.grammar}
        vocabulary={lesson.vocabulary}
        onBack={() => goTo('menu')}
        onComplete={(wrongIds) => {
          setMistakes((items) => [...items, ...wrongIds]);
          void finish(false);
        }}
      />
    );
  }
  if (stage === 'game') {
    return (
      <JlptMemoryGame
        vocabulary={lesson.vocabulary}
        title={lesson.title}
        onBack={() => goTo('menu')}
        onComplete={() => finish(true)}
      />
    );
  }
  if (stage === 'finished') {
    return (
      <div className="kana-celebration">
        <button className="back-button" onClick={onBack}>
          ← 返回 JLPT 课程
        </button>
        <section>
          <span className="celebration-mark">✓</span>
          <span className="eyebrow">
            {cumulativeLevel ? '综合复习完成' : '进度已保存在本机'}
          </span>
          <h1>{lesson.title} 已完成</h1>
          <p>错题会影响本节得分；你可以随时再次学习或继续下一节。</p>
          <div className="button-row centered">
            <button className="primary" onClick={() => goTo('matching')}>
              再做一次测试
            </button>
            <button className="secondary" onClick={() => goTo('game')}>
              玩翻牌游戏
            </button>
            <button className="secondary" onClick={onBack}>
              返回课程
            </button>
          </div>
        </section>
      </div>
    );
  }

  const vocabulary = lesson.vocabulary[position];
  const grammar = lesson.grammar[position];
  const studyingGrammar = stage === 'grammar';
  const itemCount = studyingGrammar
    ? lesson.grammar.length
    : lesson.vocabulary.length;
  const nextStudy = () => {
    if (position < itemCount - 1) {
      setPosition((value) => value + 1);
      setRevealedToken(null);
      setShowMoreExamples(false);
      setRevealedExtraToken(null);
    } else if (stage === 'vocabulary' && lesson.grammar.length) goTo('grammar');
    else goTo('matching');
  };

  return (
    <div className="jlpt-player">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回 JLPT 课程
        </button>
        <div>
          <strong>{lesson.title}</strong>
          <small>{studyingGrammar ? '语法与例句' : '新单词'}</small>
        </div>
        <span>
          {position + 1} / {itemCount}
        </span>
      </header>
      <div className="progress-track">
        <span style={{ width: `${((position + 1) / itemCount) * 100}%` }} />
      </div>
      {!studyingGrammar && vocabulary ? (
        <section className="jlpt-vocabulary-card">
          <span className="card-type">{vocabulary.level} · 新单词</span>
          <button
            className="audio-button icon-only"
            onClick={() => speakJapanese(vocabulary.reading)}
            aria-label="播放单词读音"
          >
            🔊
          </button>
          <h1 lang="ja">{vocabulary.japanese}</h1>
          <p className="word-reading" lang="ja">
            {vocabulary.reading}
          </p>
          <strong className="jlpt-word-meaning">{vocabulary.meaningZh}</strong>
          <button className="primary wide" onClick={nextStudy}>
            {position === itemCount - 1
              ? lesson.grammar.length
                ? '进入语法学习 →'
                : '进入本节测试 →'
              : '下一个单词 →'}
          </button>
        </section>
      ) : grammar ? (
        <section className="jlpt-grammar-card">
          <span className="card-type">{grammar.level} · 语法</span>
          <h1 lang="ja">{grammar.pattern}</h1>
          <div className="grammar-summary">
            <strong>{grammar.meaningZh}</strong>
            <span>{grammar.formationZh}</span>
          </div>
          <div className="grammar-example">
            <button
              className="speak-inline"
              onClick={() => speakJapanese(grammar.exampleJapanese)}
              aria-label="播放例句"
            >
              🔊
            </button>
            <div className="interactive-sentence" lang="ja">
              {grammar.tokens.map((token, index) => (
                <button
                  key={`${token.surface}-${index}`}
                  className={revealedToken === index ? 'active' : ''}
                  onClick={() => setRevealedToken(index)}
                >
                  {token.reading && <small>{token.reading}</small>}
                  <span>{token.surface}</span>
                  {revealedToken === index && <em>{token.meaningZh}</em>}
                </button>
              ))}
            </div>
            <p>{grammar.exampleMeaningZh}</p>
          </div>
          <div className="grammar-explanation">
            <strong>结合例句理解</strong>
            <p>{grammar.explanationZh}</p>
          </div>
          {grammar.examples.length > 1 && (
            <div className="grammar-more-examples">
              <button
                className="grammar-more-toggle"
                onClick={() => {
                  setShowMoreExamples((visible) => !visible);
                  setRevealedExtraToken(null);
                }}
                aria-expanded={showMoreExamples}
              >
                {showMoreExamples
                  ? '收起更多示例 ↑'
                  : `更多示例（${grammar.examples.length - 1}）↓`}
              </button>
              {showMoreExamples && (
                <div className="grammar-extra-list">
                  {grammar.examples.slice(1).map((example, exampleIndex) => (
                    <article key={example.id}>
                      <div className="grammar-extra-heading">
                        <span>示例 {exampleIndex + 2}</span>
                        <button
                          className="speak-inline"
                          onClick={() => speakJapanese(example.japanese)}
                          aria-label={`播放示例 ${exampleIndex + 2}`}
                        >
                          🔊
                        </button>
                      </div>
                      <div className="interactive-sentence compact" lang="ja">
                        {example.tokens.map((token, tokenIndex) => {
                          const tokenId = `${example.id}:${tokenIndex}`;
                          return (
                            <button
                              key={tokenId}
                              className={
                                revealedExtraToken === tokenId ? 'active' : ''
                              }
                              onClick={() => setRevealedExtraToken(tokenId)}
                            >
                              {token.reading && <small>{token.reading}</small>}
                              <span>{token.surface}</span>
                              {revealedExtraToken === tokenId && (
                                <em>{token.meaningZh}</em>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p>{example.meaningZh}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="primary wide" onClick={nextStudy}>
            {position === itemCount - 1 ? '进入本节测试 →' : '下一个语法 →'}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function JlptMatchingTest({
  vocabulary,
  onBack,
  onComplete,
}: {
  vocabulary: JlptVocabularyItem[];
  onBack: () => void;
  onComplete: (wrongIds: string[]) => void;
}) {
  const [matchItems] = useState(() => createJlptReadingMatchItems(vocabulary));
  const [readings] = useState(() =>
    [...matchItems].sort(() => Math.random() - 0.5),
  );
  const [words] = useState(() =>
    [...matchItems].sort(() => Math.random() - 0.5),
  );
  const [readingId, setReadingId] = useState<string | null>(null);
  const [wordId, setWordId] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const choose = (side: 'reading' | 'word', id: string) => {
    const nextReading = side === 'reading' ? id : readingId;
    const nextWord = side === 'word' ? id : wordId;
    setReadingId(nextReading);
    setWordId(nextWord);
    if (!nextReading || !nextWord) return;
    if (nextReading === nextWord) {
      setMatched((current) => new Set(current).add(id));
      const item = matchItems.find((entry) => entry.id === id);
      if (item) speakJapanese(item.reading);
    } else setWrongIds((current) => [...current, nextReading, nextWord]);
    window.setTimeout(() => {
      setReadingId(null);
      setWordId(null);
    }, 280);
  };
  const done = matched.size === matchItems.length;
  return (
    <div className="jlpt-test-page">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回选择
        </button>
        <div>
          <strong>单词读音匹配</strong>
          <small>请匹配平假名读音与对应的单词（中文释义）</small>
        </div>
        <span>
          {matched.size} / {matchItems.length}
        </span>
      </header>
      <div className="jlpt-match-board">
        <section>
          <h2>平假名读音</h2>
          {readings.map((item) => (
            <button
              key={item.id}
              disabled={matched.has(item.id)}
              className={`${matched.has(item.id) ? 'matched' : ''} ${readingId === item.id ? 'selected' : ''}`}
              onClick={() => choose('reading', item.id)}
            >
              <strong className="reading-choice" lang="ja">
                {toHiragana(item.reading)}
              </strong>
            </button>
          ))}
        </section>
        <section>
          <h2>单词（中文释义）</h2>
          {words.map((item) => (
            <button
              key={item.id}
              disabled={matched.has(item.id)}
              className={`${matched.has(item.id) ? 'matched' : ''} ${wordId === item.id ? 'selected' : ''}`}
              onClick={() => choose('word', item.id)}
            >
              <strong lang="ja">{item.japanese}</strong>
              <small>（{item.meaningZh}）</small>
            </button>
          ))}
        </section>
      </div>
      {done && (
        <button
          className="primary kana-test-next"
          onClick={() => onComplete([...new Set(wrongIds)])}
        >
          继续句子测试 →
        </button>
      )}
    </div>
  );
}

function JlptSentenceTest({
  grammar,
  vocabulary,
  onBack,
  onComplete,
}: {
  grammar: JlptGrammarItem[];
  vocabulary: JlptVocabularyItem[];
  onBack: () => void;
  onComplete: (wrongIds: string[]) => void;
}) {
  const questions = useMemo(() => {
    if (grammar.length === 1)
      return [
        { grammar: grammar[0] as JlptGrammarItem, kind: 'completion' as const },
        { grammar: grammar[0] as JlptGrammarItem, kind: 'order' as const },
      ];
    return grammar.map((item, index) => ({
      grammar: item,
      kind: index % 2 === 0 ? ('completion' as const) : ('order' as const),
    }));
  }, [grammar]);
  const distractorPool = useMemo(
    () => [
      ...vocabulary.map((item) => item.japanese),
      ...grammar.flatMap((item) => createSentenceChunks(item).chunks),
    ],
    [grammar, vocabulary],
  );
  const [position, setPosition] = useState(0);
  const question = questions[position];
  const current = question?.grammar;
  const createPuzzle = useCallback(
    (
      item: (typeof questions)[number] | undefined,
    ): JlptSentencePuzzle | null => {
      if (!item) return null;
      return item.kind === 'completion'
        ? createSentenceCompletionPuzzle(
            item.grammar,
            distractorPool.filter(
              (token) =>
                !createSentenceChunks(item.grammar).chunks.includes(token),
            ),
          )
        : createSentenceOrderPuzzle(item.grammar);
    },
    [distractorPool],
  );
  const [puzzle, setPuzzle] = useState<JlptSentencePuzzle | null>(() =>
    createPuzzle(question),
  );
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (question) {
      setPuzzle(createPuzzle(question));
      setSelectedIndexes([]);
      setFeedback('');
    }
  }, [createPuzzle, question]);
  if (!current || !puzzle) return null;
  const selected = selectedIndexes.map((index) => puzzle.options[index]);
  const check = () => {
    const ok = selected.join('') === puzzle.answer.join('');
    if (!ok) {
      setWrongIds((items) => [...items, current.id]);
      setFeedback(
        puzzle.kind === 'completion'
          ? '还有空格没有选对，请根据句意重新选择。'
          : '顺序还不正确，请调整后再检查。',
      );
      return;
    }
    speakJapanese(current.exampleJapanese);
    if (position < questions.length - 1) setPosition((value) => value + 1);
    else onComplete([...new Set(wrongIds)]);
  };
  const removeSelected = (selectedPosition: number) =>
    setSelectedIndexes((items) =>
      items.filter((_, index) => index !== selectedPosition),
    );
  const punctuationAt = (index: number) =>
    puzzle.punctuationSlots[index] ? (
      <span className="fixed-punctuation" aria-label="固定标点">
        {puzzle.punctuationSlots[index]}
      </span>
    ) : null;
  return (
    <div className="jlpt-test-page sentence-test">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回选择
        </button>
        <div>
          <strong>
            {puzzle.kind === 'completion' ? '句子补全' : '完整组句'}
          </strong>
          <small>
            {puzzle.kind === 'completion'
              ? '根据中文，从含干扰项的选项中补全一至两个词块'
              : '根据中文排列完整词块；标点已经固定，无需选择'}
          </small>
        </div>
        <span>
          {position + 1} / {questions.length}
        </span>
      </header>
      <section className="sentence-puzzle-card">
        <span className="eyebrow">
          {puzzle.kind === 'completion' ? '补全这句话' : '翻译这句话'}
        </span>
        <h2>{current.exampleMeaningZh}</h2>
        {puzzle.kind === 'completion' ? (
          <div className="sentence-answer sentence-completion" lang="ja">
            {punctuationAt(0)}
            {puzzle.chunks.map((chunk, chunkIndex) => {
              const blankPosition = puzzle.blankIndexes.indexOf(chunkIndex);
              const selectedToken =
                blankPosition >= 0 ? selected[blankPosition] : null;
              return (
                <span className="sentence-slot" key={`${chunk}-${chunkIndex}`}>
                  {blankPosition >= 0 ? (
                    selectedToken ? (
                      <button onClick={() => removeSelected(blankPosition)}>
                        {selectedToken}
                      </button>
                    ) : (
                      <span className="sentence-blank">
                        空格 {blankPosition + 1}
                      </span>
                    )
                  ) : (
                    <span>{chunk}</span>
                  )}
                  {punctuationAt(chunkIndex + 1)}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="sentence-answer sentence-order" lang="ja">
            {punctuationAt(0)}
            {puzzle.answer.map((_, answerIndex) => (
              <span className="sentence-slot" key={`slot-${answerIndex}`}>
                {selected[answerIndex] ? (
                  <button onClick={() => removeSelected(answerIndex)}>
                    {selected[answerIndex]}
                  </button>
                ) : (
                  <span className="sentence-blank compact" />
                )}
                {punctuationAt(answerIndex + 1)}
              </span>
            ))}
          </div>
        )}
        <div className="sentence-options">
          {puzzle.options.map((token, index) => (
            <button
              key={`${token}-${index}`}
              disabled={selectedIndexes.includes(index)}
              onClick={() =>
                setSelectedIndexes((items) =>
                  items.length >= puzzle.answer.length
                    ? items
                    : [...items, index],
                )
              }
            >
              {token}
            </button>
          ))}
        </div>
        {feedback && <p className="puzzle-feedback">{feedback}</p>}
        <div className="button-row centered">
          <button className="secondary" onClick={() => setSelectedIndexes([])}>
            重置
          </button>
          <button
            className="primary"
            disabled={selectedIndexes.length !== puzzle.answer.length}
            onClick={check}
          >
            检查
          </button>
        </div>
      </section>
    </div>
  );
}

function JlptMemoryGame({
  vocabulary,
  title,
  onBack,
  onComplete,
}: {
  vocabulary: JlptVocabularyItem[];
  title: string;
  onBack: () => void;
  onComplete: () => Promise<void>;
}) {
  const [deck, setDeck] = useState<JlptMemoryCard[]>(() =>
    createJlptMemoryDeck(vocabulary),
  );
  const [openCards, setOpenCards] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const select = (card: JlptMemoryCard) => {
    if (
      openCards.length >= 2 ||
      openCards.includes(card.id) ||
      matched.has(card.id)
    )
      return;
    const next = [...openCards, card.id];
    setOpenCards(next);
    if (next.length !== 2) return;
    const pair = next.map((id) => deck.find((item) => item.id === id));
    if (pair[0]?.matchId === pair[1]?.matchId)
      window.setTimeout(() => {
        setMatched((current) =>
          new Set(current).add(next[0] as string).add(next[1] as string),
        );
        setOpenCards([]);
      }, 360);
    else window.setTimeout(() => setOpenCards([]), 760);
  };
  const won = matched.size === deck.length;
  return (
    <div className="kana-game-page">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 暂停游戏
        </button>
        <div>
          <strong>{title} · 读音翻牌</strong>
          <small>找到平假名读音与对应的单词（中文释义）</small>
        </div>
        <span>
          {matched.size / 2} / {deck.length / 2}
        </span>
      </header>
      <div className="uta-game-board">
        {deck.map((card) => {
          const open = openCards.includes(card.id);
          return (
            <button
              className={`uta-card ${open ? 'open' : ''} ${matched.has(card.id) ? 'removed' : ''}`}
              disabled={matched.has(card.id)}
              key={card.id}
              onClick={() => select(card)}
            >
              <span className="uta-card-inner">
                <span
                  className={`uta-card-back ${card.back}`}
                  style={{
                    backgroundImage: `url(${card.back === 'torii' ? utaCardToriiUrl : utaCardSakuraUrl})`,
                  }}
                />
                <span className={`uta-card-front jlpt-card-front ${card.side}`}>
                  <strong>{card.primaryText}</strong>
                  {card.secondaryText && (
                    <small className="jlpt-card-secondary">
                      （{card.secondaryText}）
                    </small>
                  )}
                  <em>{card.side === 'reading' ? '读音' : '单词'}</em>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {won && (
        <div className="game-result">
          <strong>全部配对完成！</strong>
          <div className="button-row centered">
            <button
              className="secondary"
              onClick={() => {
                setDeck(createJlptMemoryDeck(vocabulary));
                setMatched(new Set());
                setOpenCards([]);
              }}
            >
              再玩一局
            </button>
            <button className="primary" onClick={() => void onComplete()}>
              保存并完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DialogueList({ groups }: { groups: DialogueGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(
    groups[0]?.dialogueId ?? null,
  );
  useEffect(() => setOpenId(groups[0]?.dialogueId ?? null), [groups]);
  return (
    <div className="dialogue-list">
      {groups.map((group) => (
        <article className="dialogue-card" key={group.dialogueId}>
          <button
            className="dialogue-title"
            onClick={() =>
              setOpenId(openId === group.dialogueId ? null : group.dialogueId)
            }
          >
            <span>
              <small>{group.dialogueId}</small>
              <strong>{group.title}</strong>
            </span>
            <span>{openId === group.dialogueId ? '−' : '+'}</span>
          </button>
          {openId === group.dialogueId && (
            <div className="dialogue-lines">
              {group.lines.map((line) => (
                <div className={`dialogue-line ${line.role}`} key={line.id}>
                  <span className="role-label">
                    {line.role === 'user' ? '你' : '对方'}
                  </span>
                  <div>
                    <button
                      className="speak-inline"
                      onClick={() => speakJapanese(line.japanese)}
                      aria-label="播放日语"
                    >
                      🔊
                    </button>
                    <strong>{line.japanese}</strong>
                    <small>{line.kana}</small>
                    <p>{line.meaning_zh}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function LessonView({
  lessonId,
  onBack,
  onComplete,
}: {
  lessonId: string;
  onBack: () => void;
  onComplete: () => Promise<void>;
}) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [position, setPosition] = useState(0);
  const [difficultIds, setDifficultIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void window.hiJapan.learning
      .getLesson(lessonId)
      .then(setLesson)
      .catch((caught) => setError(errorMessage(caught)));
  }, [lessonId]);

  const items = useMemo(() => {
    if (!lesson) return [];
    return [
      ...lesson.vocabulary.map((item) => ({ ...item, kind: 'word' as const })),
      ...lesson.phrases.map((item) => ({ ...item, kind: 'phrase' as const })),
      ...lesson.grammar.map((item) => ({ ...item, kind: 'grammar' as const })),
    ];
  }, [lesson]);
  const current = items[position];

  if (error)
    return (
      <FatalError
        message={error}
        retry={async () =>
          setLesson(await window.hiJapan.learning.getLesson(lessonId))
        }
      />
    );
  if (!lesson || !current) return <LoadingScreen />;

  const itemId = current.id;
  const japanese =
    current.kind === 'grammar' ? current.pattern : current.japanese;
  const meaning =
    current.kind === 'grammar' ? current.function_zh : current.meaning_zh;
  const kana = current.kind === 'grammar' ? current.example_jp : current.kana;
  const note =
    current.kind === 'word'
      ? current.usage_note
      : current.kind === 'phrase'
        ? current.slot_hint
        : current.example_zh;

  const move = (difficult: boolean) => {
    setDifficultIds((ids) => {
      if (difficult && !ids.includes(itemId)) return [...ids, itemId];
      if (!difficult) return ids.filter((id) => id !== itemId);
      return ids;
    });
    if (position < items.length - 1) setPosition(position + 1);
  };

  const complete = async () => {
    setSaving(true);
    try {
      await window.hiJapan.learning.completeLesson(lessonId, difficultIds);
      await onComplete();
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  return (
    <div className="lesson-player">
      <header className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回课程
        </button>
        <div>
          <strong>{lesson.title}</strong>
          <small>{lesson.objectives}</small>
        </div>
        <span>
          {position + 1} / {items.length}
        </span>
      </header>
      <div className="progress-track">
        <span style={{ width: `${((position + 1) / items.length) * 100}%` }} />
      </div>
      <section className="learning-card">
        <span className="card-type">
          {current.kind === 'word'
            ? '单词'
            : current.kind === 'phrase'
              ? '实用语句'
              : '微语法'}
        </span>
        <button
          className="audio-button"
          onClick={() => speakJapanese(japanese)}
        >
          🔊 播放
        </button>
        <h1 lang="ja">{japanese}</h1>
        <p className="kana" lang="ja">
          {kana}
        </p>
        <div className="meaning-box">
          <strong>{meaning}</strong>
          {note && <p>{note}</p>}
        </div>
        <div className="lesson-actions">
          {position < items.length - 1 ? (
            <>
              <button
                className="secondary danger-soft"
                onClick={() => move(true)}
              >
                需要复习
              </button>
              <button className="primary" onClick={() => move(false)}>
                记住了 →
              </button>
            </>
          ) : (
            <button
              className="primary wide"
              disabled={saving}
              onClick={() => void complete()}
            >
              {saving
                ? '正在保存…'
                : `完成课程 · ${difficultIds.length} 项待复习`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewView({ onChange }: { onChange: () => Promise<void> }) {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void window.hiJapan.review.getDue().then((items) => {
      setCards(items);
      setLoading(false);
    });
  }, []);

  const card = cards[0];
  const grade = async (value: ReviewGrade) => {
    if (!card) return;
    setCards(await window.hiJapan.review.grade(card.contentId, value));
    setRevealed(false);
    await onChange();
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="间隔复习"
        title="到期复习"
        description="根据你的反馈安排下一次出现时间，所有计算都在本地完成。"
      />
      {loading ? (
        <LoadingScreen />
      ) : !card ? (
        <section className="empty-state">
          <span>✓</span>
          <h2>目前没有到期项目</h2>
          <p>完成新课程或稍后回来，这里会出现需要巩固的内容。</p>
        </section>
      ) : (
        <section className="review-stage">
          <div className="review-count">剩余 {cards.length} 项</div>
          <div className="review-card">
            <button
              className="audio-button"
              onClick={() => speakJapanese(card.japanese)}
            >
              🔊 播放
            </button>
            <h1 lang="ja">{card.japanese}</h1>
            <p className="kana" lang="ja">
              {card.kana}
            </p>
            {revealed ? (
              <div className="review-answer">
                <strong>{card.meaningZh}</strong>
                <small>当前掌握度 {Math.round(card.masteryScore)}%</small>
              </div>
            ) : (
              <button
                className="primary reveal-button"
                onClick={() => setRevealed(true)}
              >
                显示答案
              </button>
            )}
          </div>
          {revealed && (
            <div className="grade-grid">
              <button className="again" onClick={() => void grade('again')}>
                <strong>忘记</strong>
                <span>10 分钟</span>
              </button>
              <button className="hard" onClick={() => void grade('hard')}>
                <strong>困难</strong>
                <span>较短间隔</span>
              </button>
              <button className="good" onClick={() => void grade('good')}>
                <strong>掌握</strong>
                <span>正常间隔</span>
              </button>
              <button className="easy" onClick={() => void grade('easy')}>
                <strong>简单</strong>
                <span>更长间隔</span>
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ConversationView() {
  const [settings, setSettings] = useState<AiSettingsStatus | null>(null);
  const [history, setHistory] = useState<ConversationHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReadOnly, setHistoryReadOnly] = useState(false);
  const [scene, setScene] = useState<Scene>('restaurant');
  const [difficulty, setDifficulty] = useState<'starter' | 'N5' | 'N4'>(
    'starter',
  );
  const [correctionStyle, setCorrectionStyle] = useState<
    'gentle' | 'standard' | 'strict'
  >('standard');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<ConversationFeedback | null>(null);

  const refreshHistory = useCallback(async () => {
    setHistory(await window.hiJapan.ai.listHistory());
  }, []);

  useEffect(() => {
    void Promise.all([
      window.hiJapan.ai.getSettings().then(setSettings),
      refreshHistory(),
    ]).catch((caught) => setError(errorMessage(caught)));
  }, [refreshHistory]);

  const startNewConversation = () => {
    setFeedback(null);
    setMessages([]);
    setSessionId(null);
    setHistoryReadOnly(false);
    setHistoryOpen(false);
    setError('');
  };

  const openHistory = async (item: ConversationHistoryItem) => {
    if (sending) return;
    setError('');
    try {
      const detail = await window.hiJapan.ai.getHistory(item.id);
      setScene(detail.session.scene);
      setDifficulty(detail.session.difficulty);
      setCorrectionStyle(detail.session.correctionStyle);
      setSessionId(detail.session.id);
      setMessages(detail.messages);
      setFeedback(null);
      setHistoryReadOnly(
        detail.session.status === 'completed' || !settings?.configured,
      );
      setHistoryOpen(false);
    } catch (caught) {
      setError(errorMessage(caught));
      await refreshHistory();
    }
  };

  const deleteHistory = async (id: string) => {
    if (!window.confirm('确定删除这条本地对话记录吗？')) return;
    try {
      setHistory(await window.hiJapan.ai.deleteHistory(id));
      if (sessionId === id) startNewConversation();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const deleteAllHistory = async () => {
    if (!history.length || !window.confirm('确定清空近 7 天的全部对话记录吗？'))
      return;
    try {
      await window.hiJapan.ai.deleteAllHistory();
      setHistory([]);
      startNewConversation();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const send = async () => {
    const message = text.trim();
    if (!message || sending || historyReadOnly) return;
    setSending(true);
    setError('');
    setText('');
    const localMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, localMessage]);
    try {
      const result = await window.hiJapan.ai.sendTurn({
        sessionId,
        scene,
        difficulty,
        correctionStyle,
        message,
      });
      setSessionId(result.sessionId);
      setMessages((current) => [...current, result.reply]);
      await refreshHistory();
    } catch (caught) {
      setMessages((current) =>
        current.filter((item) => item.id !== localMessage.id),
      );
      setText(message);
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  const finish = async () => {
    if (!sessionId || sending) return;
    setSending(true);
    try {
      setFeedback(await window.hiJapan.ai.finishConversation(sessionId));
      await refreshHistory();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  if (!settings) return <LoadingScreen />;
  if (!settings.configured && messages.length === 0) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="自由对话"
          title="先配置你的 AI API"
          description="AI 对话是可选功能，费用由你的服务商账户承担。"
        />
        <section className="empty-state">
          <span>鍵</span>
          <h2>尚未配置 API</h2>
          <p>请在“设置”中填写服务地址、模型和 API Key，并完成连接测试。</p>
          {history.length > 0 && (
            <button className="secondary" onClick={() => setHistoryOpen(true)}>
              查看近 7 天记录（{history.length}）
            </button>
          )}
        </section>
        {historyOpen && (
          <ConversationHistoryPanel
            history={history}
            onClose={() => setHistoryOpen(false)}
            onOpen={(item) => void openHistory(item)}
            onDelete={(id) => void deleteHistory(id)}
            onDeleteAll={() => void deleteAllHistory()}
          />
        )}
      </div>
    );
  }

  return (
    <div className="conversation-page">
      <header className="conversation-header">
        <div>
          <span className="eyebrow">AI 自由对话 · 使用你的 API</span>
          <h1>{scenes.find((item) => item.id === scene)?.name}</h1>
        </div>
        <div className="conversation-controls">
          <button
            className="secondary history-toggle"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            近 7 天记录{history.length > 0 ? ` · ${history.length}` : ''}
          </button>
          <select
            value={scene}
            onChange={(event) => setScene(event.target.value as Scene)}
            disabled={messages.length > 0}
          >
            {scenes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(event.target.value as typeof difficulty)
            }
            disabled={messages.length > 0}
          >
            <option value="starter">入门</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
          </select>
          <select
            value={correctionStyle}
            onChange={(event) =>
              setCorrectionStyle(event.target.value as typeof correctionStyle)
            }
            disabled={messages.length > 0}
          >
            <option value="gentle">轻纠错</option>
            <option value="standard">标准</option>
            <option value="strict">严格</option>
          </select>
          <button
            className="secondary"
            onClick={() => void finish()}
            disabled={!sessionId || sending || historyReadOnly}
          >
            结束并复盘
          </button>
        </div>
      </header>
      {error && <InlineAlert message={error} onClose={() => setError('')} />}
      {historyOpen && (
        <ConversationHistoryPanel
          history={history}
          onClose={() => setHistoryOpen(false)}
          onOpen={(item) => void openHistory(item)}
          onDelete={(id) => void deleteHistory(id)}
          onDeleteAll={() => void deleteAllHistory()}
        />
      )}
      {feedback ? (
        <FeedbackPanel feedback={feedback} onRestart={startNewConversation} />
      ) : (
        <>
          <div className="message-list">
            {messages.length === 0 && (
              <div className="conversation-intro">
                <span>会話</span>
                <h2>开始场景任务</h2>
                <p>
                  试着用日语打招呼或提出你的第一个需求。AI 会保持工作人员角色。
                </p>
              </div>
            )}
            {messages.map((message) => (
              <div className={`message ${message.role}`} key={message.id}>
                <span>{message.role === 'user' ? '你' : 'AI'}</span>
                <div>
                  <p>{message.content}</p>
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => speakJapanese(message.content)}
                      aria-label="朗读日语正文"
                      title="只朗读日语正文"
                    >
                      🔊
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="typing">对方正在回复…</div>}
          </div>
          {historyReadOnly ? (
            <div className="history-readonly-bar">
              <span>这是本地历史记录，当前仅供复习查看。</span>
              <button className="primary" onClick={startNewConversation}>
                开始新对话
              </button>
            </div>
          ) : (
            <div className="composer">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="输入日语；Enter 发送，Shift+Enter 换行"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                className="primary"
                disabled={!text.trim() || sending}
                onClick={() => void send()}
              >
                发送
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConversationHistoryPanel({
  history,
  onClose,
  onOpen,
  onDelete,
  onDeleteAll,
}: {
  history: ConversationHistoryItem[];
  onClose: () => void;
  onOpen: (item: ConversationHistoryItem) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  return (
    <aside className="conversation-history" aria-label="近 7 天对话记录">
      <header>
        <div>
          <span className="eyebrow">本地保存</span>
          <h2>近 7 天对话</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭记录">
          ×
        </button>
      </header>
      <p className="history-note">超过 7 天的记录会在本机自动删除。</p>
      <div className="history-list">
        {history.length === 0 ? (
          <div className="history-empty">还没有可查看的对话。</div>
        ) : (
          history.map((item) => (
            <article className="history-item" key={item.id}>
              <button className="history-open" onClick={() => onOpen(item)}>
                <strong>
                  {scenes.find((scene) => scene.id === item.scene)?.name ??
                    item.scene}
                  <small>
                    {item.status === 'active' ? '可继续' : '已结束'}
                  </small>
                </strong>
                <span>
                  {new Date(item.lastActivityAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {item.messageCount} 条消息
                </span>
                <p>{item.preview || '尚未发送消息'}</p>
              </button>
              <button
                className="history-delete"
                onClick={() => onDelete(item.id)}
                aria-label="删除这条对话记录"
              >
                删除
              </button>
            </article>
          ))
        )}
      </div>
      {history.length > 0 && (
        <button className="danger-link" onClick={onDeleteAll}>
          清空全部对话记录
        </button>
      )}
    </aside>
  );
}

function FeedbackPanel({
  feedback,
  onRestart,
}: {
  feedback: ConversationFeedback;
  onRestart: () => void;
}) {
  return (
    <div className="feedback-panel">
      <div className="feedback-hero">
        <span>{feedback.taskCompleted ? '✓' : '→'}</span>
        <div>
          <small>任务结果</small>
          <h2>
            {feedback.taskCompleted ? '场景任务已完成' : '还可以继续练习'}
          </h2>
          <p>{feedback.summaryZh}</p>
        </div>
      </div>
      <div className="feedback-grid">
        <section>
          <h3>做得好的地方</h3>
          {feedback.strengths.map((item) => (
            <p key={item}>✓ {item}</p>
          ))}
        </section>
        <section>
          <h3>值得改进</h3>
          {feedback.corrections.map((item) => (
            <div
              className="correction"
              key={`${item.original}-${item.suggested}`}
            >
              <del>{item.original}</del>
              <strong>{item.suggested}</strong>
              <small>{item.explanationZh}</small>
            </div>
          ))}
        </section>
      </div>
      <section className="review-candidates">
        <h3>建议复习</h3>
        {feedback.reviewCandidates.map((item) => (
          <div key={item.japanese}>
            <strong>{item.japanese}</strong>
            <span>{item.meaningZh}</span>
          </div>
        ))}
      </section>
      <button className="primary" onClick={onRestart}>
        开始新对话
      </button>
    </div>
  );
}

function SettingsView({
  snapshot,
  onChange,
}: {
  snapshot: AppSnapshot;
  onChange: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const exportData = async () =>
    setMessage((await window.hiJapan.backup.exportData()).message);
  const importData = async () => {
    const result = await window.hiJapan.backup.importData();
    setMessage(result.message);
    if (result.ok) await onChange();
  };
  const reset = async () => {
    await window.hiJapan.app.resetAllData();
    window.location.reload();
  };

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="本地设置"
        title="设置与数据"
        description="所有学习数据保存在这台电脑；API Key 不会写入备份。"
      />
      {message && (
        <InlineAlert message={message} onClose={() => setMessage('')} />
      )}
      <section className="settings-section">
        <h2>AI API</h2>
        <p>用于自由对话；普通课程不调用 AI。</p>
        <AiSettingsPanel />
      </section>
      <PetSettingsPanel />
      <section className="settings-section">
        <h2>学习数据</h2>
        <p>
          教材包版本 {snapshot.content.version}，已完成{' '}
          {snapshot.stats.completedLessons} 课。
        </p>
        <div className="button-row">
          <button className="secondary" onClick={() => void exportData()}>
            导出备份
          </button>
          <button className="secondary" onClick={() => void importData()}>
            导入备份
          </button>
        </div>
      </section>
      <section className="settings-section danger-zone">
        <h2>删除全部本地数据</h2>
        <p>将删除学习进度、对话、设置和加密密钥。内置课程不会删除。</p>
        {confirmReset ? (
          <div className="button-row">
            <button className="danger" onClick={() => void reset()}>
              确认永久删除
            </button>
            <button
              className="secondary"
              onClick={() => setConfirmReset(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            className="danger-outline"
            onClick={() => setConfirmReset(true)}
          >
            删除全部数据
          </button>
        )}
      </section>
      <section className="about">
        <strong>HiJapan 日语随行</strong>
        <span>v{snapshot.appVersion} · Windows 桌面开发版 · 无自建后端</span>
      </section>
    </div>
  );
}

function PetSettingsPanel() {
  const [state, setState] = useState<PetSnapshot | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let mounted = true;
    void window.hiJapan.companion
      .getState()
      .then((next) => {
        if (mounted) setState(next);
      })
      .catch(() => setError('桌宠配置读取失败，请重启后重试。'));
    const off = window.hiJapan.companion.onState(setState);
    return () => {
      mounted = false;
      off();
    };
  }, []);
  const update = async (patch: Partial<PetPreferences>) => {
    setSaving(true);
    setError('');
    try {
      setState(await window.hiJapan.companion.updatePreferences(patch));
    } catch {
      setError('桌宠配置更新失败，请重试。');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="settings-section pet-settings">
      <h2>桌面学习伙伴</h2>
      {state && (
        <div className="pet-settings-options">
          <label>
            性格
            <select
              value={state.preferences.persona}
              onChange={(event) =>
                void update({
                  persona: event.target.value as PetPreferences['persona'],
                })
              }
            >
              <option value="buddy">开朗学习搭档</option>
              <option value="mentor">温柔严谨导师</option>
              <option value="whale">聪明慵懒·傲娇鲸鱼少女</option>
            </select>
          </label>
          <label>
            关系
            <select
              value={state.preferences.relationship}
              onChange={(event) =>
                void update({
                  relationship: event.target
                    .value as PetPreferences['relationship'],
                })
              }
            >
              <option value="friend">朋友</option>
              <option value="teacher">师生</option>
              <option value="partner">虚构恋人（成年设定）</option>
            </select>
          </label>
          <label>
            自定义人设
            <textarea
              aria-label="自定义人设"
              maxLength={2000}
              defaultValue={state.preferences.customPersona}
              onBlur={(event) =>
                void update({ customPersona: event.target.value })
              }
              placeholder="可以粘贴 PERSONA_LOAD 风格的人设，失去焦点自动保存"
            />
          </label>
          <p>
            桌宠聊天共用下方/上方已配置的 AI
            API；发送消息时会提交最近对话、人设和与问题相关的课程摘要。
          </p>
        </div>
      )}
      <button
        className="secondary"
        onClick={() =>
          void window.hiJapan.companion
            .resetPosition()
            .catch(() => setError('位置重置失败，请重试。'))
        }
      >
        重置到屏幕右下角
      </button>
      <p>
        拖动角色移动位置，单击或右键打开互动菜单，双击回到学习。最小化主窗口后仍可陪伴；关闭软件时一起退出。
      </p>
      {error && <p role="alert">{error}</p>}
      {state ? (
        <>
          {state.persistenceError && (
            <p role="alert">偏好未能保存到本机，请检查应用数据目录是否可写。</p>
          )}
          <div className="pet-settings-options">
            {(
              [
                ['enabled', '显示桌宠（下次启动保持此选择）'],
                ['locked', '锁定位置，防止误拖动'],
                ['reducedMotion', '减少动画'],
                ['bubbles', '显示学习提示气泡'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={state.preferences[key]}
                  disabled={saving}
                  onChange={(event) =>
                    void update({ [key]: event.target.checked })
                  }
                />
                {label}
              </label>
            ))}
            <label>
              桌宠大小
              <select
                aria-label="桌宠大小"
                value={state.preferences.scale}
                disabled={saving}
                onChange={(event) =>
                  void update({ scale: Number(event.target.value) })
                }
              >
                <option value={0.75}>小（75%）</option>
                <option value={1}>标准（100%）</option>
                <option value={1.25}>大（125%）</option>
              </select>
            </label>
          </div>
          <p className="pet-settings-note">
            日常陪伴、课程反馈和动作均在本地执行。需要 AI
            时，从互动菜单进入“对话”后主动发送。当前为透明立绘与轻量动效，逐帧表情动画后续加入。
          </p>
        </>
      ) : (
        !error && <p>正在读取桌宠设置…</p>
      )}
    </section>
  );
}

function AiSettingsPanel({
  onboarding = false,
  onSaved,
}: {
  onboarding?: boolean;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState<AiSettingsStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void window.hiJapan.ai.getSettings().then((next) => {
      setStatus(next);
      setBaseUrl(next.baseUrl);
      setModel(next.model);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const next = await window.hiJapan.ai.saveAndTest({
        baseUrl,
        apiKey,
        model,
      });
      setStatus(next);
      setApiKey('');
      setMessage('连接成功，密钥已用 Windows 系统能力加密保存。');
      onSaved?.();
    } catch (caught) {
      setMessage(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    await window.hiJapan.ai.deleteSettings();
    setStatus({
      configured: false,
      baseUrl,
      model: '',
      keyHint: '',
      lastTestedAt: null,
    });
    setModel('');
    setMessage('AI 配置和加密密钥已删除。');
  };

  if (!status) return <div className="spinner small" />;
  return (
    <div className="ai-settings-panel">
      {status.configured && (
        <div className="connected-status">
          <span>✓</span>
          <div>
            <strong>已配置</strong>
            <small>
              {status.model} · Key 末四位 {status.keyHint}
            </small>
          </div>
        </div>
      )}
      {message && (
        <div
          className={
            message.includes('成功') || message.includes('删除')
              ? 'form-message success'
              : 'form-message'
          }
        >
          {message}
        </div>
      )}
      <div className="form-grid">
        <label className="field full">
          <span>API Base URL</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className="field">
          <span>模型名称</span>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="由服务商提供"
          />
        </label>
        <label className="field">
          <span>
            API Key {status.configured && `（当前 ····${status.keyHint}）`}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="只在本机加密保存"
            autoComplete="off"
          />
        </label>
      </div>
      <div className="button-row">
        <button
          className="primary"
          disabled={saving || !baseUrl || !model || !apiKey}
          onClick={() => void save()}
        >
          {saving ? '正在测试连接…' : '测试连接并保存'}
        </button>
        {status.configured && !onboarding && (
          <button className="danger-outline" onClick={() => void remove()}>
            删除密钥
          </button>
        )}
      </div>
      <p className="privacy-hint">
        连接测试会向你填写的服务商发送一条最小请求，可能产生极少量费用。HiJapan
        没有中转服务器。
      </p>
    </div>
  );
}
