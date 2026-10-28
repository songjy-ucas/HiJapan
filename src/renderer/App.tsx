import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AiSettingsStatus,
  AppSnapshot,
  ChatMessage,
  ConversationFeedback,
  DialogueGroup,
  LessonDetail,
  LessonSummary,
  ProfileInput,
  ReviewCard,
  ReviewGrade,
  Scene,
  TodayTask,
} from '../shared/contracts';

type View = 'today' | 'learn' | 'conversation' | 'review' | 'settings';

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
  if (raw.includes('SECURE_STORAGE_UNAVAILABLE'))
    return 'Windows 安全存储当前不可用。';
  return raw.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function speakJapanese(text: string) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [view, setView] = useState<View>('today');
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  }, [refresh]);

  if (loading) return <LoadingScreen />;
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
          <div className="brand-mark">日</div>
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
          (selectedLesson ? (
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

function LoadingScreen() {
  return (
    <div className="center-screen">
      <div className="spinner" />
      <p>正在准备本地课程…</p>
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
          <div className="brand-mark">日</div>
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
        <Stat label="内容版本" value={snapshot.content.version} />
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
  const [selectedScene, setSelectedScene] = useState<Scene>('restaurant');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [dialogues, setDialogues] = useState<DialogueGroup[]>([]);
  const [tab, setTab] = useState<'lessons' | 'dialogues'>('lessons');

  useEffect(() => {
    void Promise.all([
      window.hiJapan.learning.listLessons(selectedScene),
      window.hiJapan.learning.listDialogues(selectedScene),
    ]).then(([nextLessons, nextDialogues]) => {
      setLessons(nextLessons);
      setDialogues(nextDialogues);
    });
  }, [selectedScene]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="旅行模式"
        title="场景课程"
        description="先选现实场景，再学习马上能用的词汇和表达。"
      />
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

  useEffect(() => {
    void window.hiJapan.ai.getSettings().then(setSettings);
  }, []);

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
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
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  if (!settings) return <LoadingScreen />;
  if (!settings.configured) {
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
        </section>
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
            disabled={!sessionId || sending}
          >
            结束并复盘
          </button>
        </div>
      </header>
      {error && <InlineAlert message={error} onClose={() => setError('')} />}
      {feedback ? (
        <FeedbackPanel
          feedback={feedback}
          onRestart={() => {
            setFeedback(null);
            setMessages([]);
            setSessionId(null);
          }}
        />
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
                    <button onClick={() => speakJapanese(message.content)}>
                      🔊
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="typing">对方正在回复…</div>}
          </div>
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
        </>
      )}
    </div>
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
      <section className="settings-section">
        <h2>学习数据</h2>
        <p>
          内容版本 {snapshot.content.version}，已完成{' '}
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
        <span>v0.1.0 · Windows 桌面开发版 · 无自建后端</span>
      </section>
    </div>
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
