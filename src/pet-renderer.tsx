import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  PetAction,
  PetSnapshot,
  PetChatMessage,
} from './shared/pet-contracts';
import poseAtlas from './assets/desktop-pet-poses.png';
import extraAtlas from './assets/desktop-pet-extra-poses.png';
import petImage from './assets/desktop-pet-idle.png';
import './pet.css';

const labels = {
  walk: '行走动作',
  listen: '聆听中',
  hint: '巩固提示',
  idle: '陪伴中',
  hello: 'こんにちは',
  study: '学习中',
  think: '思考中',
  speak: '听一听',
  cheer: '做得好',
  rest: '休息中',
  sleep: '睡眠中',
  drag: '移动中',
};

function DesktopPet() {
  const [state, setState] = useState<PetSnapshot | null>(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<PetChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    void window.desktopPet
      .getChat()
      .then(setMessages)
      .catch(() => {});
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);
  const sendChat = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      setMessages(await window.desktopPet.sendChat(draft));
      setDraft('');
    } catch (caught) {
      const raw = String(caught);
      setError(
        raw.includes('配置')
          ? '请先在主窗口设置中配置 AI API。'
          : '回复失败或超时，请检查 API 配置后重试。',
      );
    } finally {
      setBusy(false);
    }
  };
  const gesture = useRef<{ x: number; y: number; dragging: boolean } | null>(
    null,
  );
  const interactive = useRef(true);
  const run = (request: Promise<unknown>) => {
    void request.catch(() => setError('操作未完成，请在主窗口设置中重试。'));
  };
  useEffect(() => {
    let mounted = true;
    void window.desktopPet.getState().then((value) => {
      if (mounted) setState(value);
    });
    const off = window.desktopPet.onState(setState);
    const onMove = (event: MouseEvent) => {
      const hit =
        Boolean((event.target as Element)?.closest('.pet-hit')) ||
        Boolean(gesture.current);
      if (hit !== interactive.current) {
        interactive.current = hit;
        void window.desktopPet.setInteractive(hit).catch(() => {});
      }
    };
    const release = () => {
      gesture.current = null;
      void window.desktopPet.endDrag().catch(() => {});
    };
    document.addEventListener('mousemove', onMove);
    window.addEventListener('blur', release);
    return () => {
      mounted = false;
      off();
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('blur', release);
      release();
    };
  }, []);
  if (!state) return null;
  const act = (action: PetAction) => {
    setMenu(false);
    setError('');
    run(window.desktopPet.act(action));
  };
  const isReduced = state.preferences.reducedMotion;
  return (
    <main
      className={`pet-scene activity-${state.activity} ${state.chatOpen ? 'chat-open' : ''} ${isReduced ? 'reduced-motion' : ''}`}
      style={{ zoom: state.preferences.scale }}
    >
      {state.chatOpen && (
        <section className="pet-chat pet-hit" aria-label="桌宠对话">
          <header>
            <strong>和学习伙伴聊一聊</strong>
            <button onClick={() => run(window.desktopPet.setChatOpen(false))}>
              收起
            </button>
          </header>
          <p className="pet-chat-notice">
            使用你配置的
            API；消息与人设会发送给服务商，明确求教时附相关课程摘要。近 7
            天对话仅存本机。
          </p>
          <div className="pet-chat-history" aria-live="polite">
            {!messages.length && (
              <p>想聊什么都可以，打个招呼或说说今天的心情吧。</p>
            )}
            {messages.map((message, index) => (
              <article key={index} className={message.role}>
                <strong>{message.role === 'user' ? '你' : '学习伙伴'}</strong>
                <p>{message.content}</p>
                {message.followUp && (
                  <p className="pet-followup">巩固一下：{message.followUp}</p>
                )}
                {message.recommendations?.map((item) => (
                  <div key={item.lessonId}>
                    <button
                      className="pet-course"
                      onClick={() =>
                        run(window.desktopPet.openLesson(item.lessonId))
                      }
                    >
                      📖 {item.title}
                      <small>{item.reason}</small>
                      <small>打开推荐课程 →</small>
                    </button>
                    {item.lessonId.startsWith('jlpt-') && (
                      <button
                        className="pet-course"
                        onClick={() =>
                          run(
                            window.desktopPet.openLesson(
                              `${item.lessonId}::${item.practice ?? 'matching'}`,
                            ),
                          )
                        }
                      >
                        专项练习：
                        {
                          {
                            game: '翻牌',
                            matching: '读音连线',
                            puzzle: '句子补全',
                          }[item.practice ?? 'matching']
                        }{' '}
                        →
                      </button>
                    )}
                  </div>
                ))}
              </article>
            ))}
            {busy && <p>正在思考…</p>}
            <div ref={chatEnd} />
          </div>
          {error && <p role="alert">{error}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendChat();
            }}
          >
            <textarea
              aria-label="给桌宠的消息"
              maxLength={2000}
              value={draft}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="说点什么…"
            />
            <button disabled={busy || !draft.trim()}>发送</button>
          </form>
          <button
            disabled={busy}
            onClick={() => {
              if (window.confirm('清除本机桌宠对话？'))
                run(window.desktopPet.clearChat().then(() => setMessages([])));
            }}
          >
            清除对话
          </button>
        </section>
      )}
      {(state.preferences.bubbles || error || state.persistenceError) &&
        !menu && (
          <div className="pet-bubble pet-hit" role="status">
            {error ||
              (state.persistenceError
                ? '偏好暂未保存，当前操作仍然有效。'
                : state.message)}
          </div>
        )}
      {menu && (
        <section className="pet-menu pet-hit" aria-label="桌宠菜单">
          <div className="pet-menu-title">
            HiJapan 学习伙伴
            <button aria-label="关闭菜单" onClick={() => setMenu(false)}>
              ×
            </button>
          </div>
          <div className="pet-menu-grid">
            <button onClick={() => act('walk')}>行走动作</button>
            <button onClick={() => act('listen')}>聆听动作</button>
            <button onClick={() => act('hint')}>提示动作</button>
            <button
              onClick={() => {
                setMenu(false);
                run(window.desktopPet.setChatOpen(true));
              }}
            >
              与桌宠聊天
            </button>
            <button onClick={() => act('learn')}>📖 去学习</button>
            <button onClick={() => act('conversation')}>💬 去对话</button>
            <button onClick={() => act('hello')}>👋 打招呼</button>
            <button onClick={() => act('cheer')}>✨ 鼓励我</button>
            <button
              onClick={() =>
                act(
                  state.activity === 'rest' || state.activity === 'sleep'
                    ? 'idle'
                    : 'rest',
                )
              }
            >
              {state.activity === 'rest' || state.activity === 'sleep'
                ? '☀ 唤醒'
                : '☕ 休息'}
            </button>
            <button onClick={() => act('sleep')}>☾ 睡眠</button>
            <button onClick={() => act('settings')}>⚙ 桌宠设置</button>
            <button onClick={() => act('hide')}>隐藏桌宠</button>
          </div>
        </section>
      )}
      <button
        className="pet-character pet-hit"
        aria-label="HiJapan 桌宠：点击打开菜单，拖动移动，双击进入学习"
        title={
          state.preferences.locked
            ? '位置已锁定；点击互动'
            : '拖动移动 · 点击互动'
        }
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu((value) => !value);
        }}
        onDoubleClick={() => act('learn')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenu(false);
            gesture.current = null;
            run(window.desktopPet.endDrag());
          }
        }}
        onClick={(event) => {
          if (event.detail === 0) setMenu((value) => !value);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = {
            x: event.screenX,
            y: event.screenY,
            dragging: false,
          };
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current || current.dragging || state.preferences.locked) return;
          if (
            Math.hypot(event.screenX - current.x, event.screenY - current.y) < 6
          )
            return;
          current.dragging = true;
          setMenu(false);
          run(window.desktopPet.beginDrag());
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          gesture.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          run(window.desktopPet.endDrag());
          if (current && !current.dragging) setMenu((value) => !value);
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
          run(window.desktopPet.endDrag());
        }}
        onPointerCancel={() => {
          gesture.current = null;
          run(window.desktopPet.endDrag());
        }}
      >
        <img
          style={{ display: 'none' }}
          src={petImage}
          alt="蓝紫色星饰的 Q 版日语学习伙伴"
          draggable={false}
        />
        <span
          className="pet-pose"
          role="img"
          aria-label={labels[state.activity]}
          style={{
            backgroundImage: `url(${['walk', 'listen', 'hint'].includes(state.activity) ? extraAtlas : poseAtlas})`,
            backgroundSize: ['walk', 'listen', 'hint'].includes(state.activity)
              ? '300% 100%'
              : '300% 300%',
            backgroundPosition: ['walk', 'listen', 'hint'].includes(
              state.activity,
            )
              ? `${['walk', 'listen', 'hint'].indexOf(state.activity) * 50}% 0%`
              : `${({ idle: 0, hello: 1, study: 2, think: 3, speak: 4, cheer: 5, rest: 6, sleep: 7, drag: 8, walk: 0, listen: 0, hint: 0 }[state.activity] % 3) * 50}% ${Math.floor({ idle: 0, hello: 1, study: 2, think: 3, speak: 4, cheer: 5, rest: 6, sleep: 7, drag: 8, walk: 0, listen: 0, hint: 0 }[state.activity] / 3) * 50}%`,
          }}
        />
        <span className="pet-sparkle" aria-hidden="true">
          {state.activity === 'cheer'
            ? '✦ ✧ ✦'
            : state.activity === 'sleep'
              ? 'z z Z'
              : state.activity === 'think'
                ? '⋯'
                : state.activity === 'study'
                  ? '📖'
                  : state.activity === 'rest'
                    ? '☕'
                    : state.activity === 'speak'
                      ? '♫'
                      : ''}
        </span>
      </button>
      <button
        className="pet-name pet-hit"
        onClick={() => setMenu((value) => !value)}
        aria-expanded={menu}
      >
        <span className="pet-dot" />
        {labels[state.activity]}
        <span>⌃</span>
      </button>
    </main>
  );
}
const root = document.getElementById('pet-root');
if (!root) throw new Error('Pet root missing');
createRoot(root).render(
  <StrictMode>
    <DesktopPet />
  </StrictMode>,
);
