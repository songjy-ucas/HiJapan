import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  type IpcMainInvokeEvent,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PetChatService } from './pet-chat';
import {
  clampPetPosition,
  defaultPetPreferences,
  petMessages,
  resolvePetActivity,
} from '../domain/pet';
import type {
  PetActivity,
  PetDestination,
  PetPreferences,
  PetSnapshot,
} from '../shared/pet-contracts';

const preferencesSchema = z
  .object({
    persona: z.enum(['buddy', 'mentor', 'whale']),
    relationship: z.enum(['friend', 'teacher', 'partner']),
    customPersona: z.string().max(2000),
    enabled: z.boolean(),
    locked: z.boolean(),
    reducedMotion: z.boolean(),
    bubbles: z.boolean(),
    scale: z.number().min(0.75).max(1.25),
  })
  .strict();
const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
const channels = [
  'pet:setChatOpen',
  'pet:getChat',
  'pet:sendChat',
  'pet:clearChat',
  'pet:openLesson',
  'pet:resetPosition',
  'pet:getState',
  'pet:updatePreferences',
  'pet:act',
  'pet:beginDrag',
  'pet:endDrag',
  'pet:setInteractive',
  'pet:setActivity',
];

export class DesktopPetController {
  private window: BrowserWindow | null = null;
  private preferences: PetPreferences = { ...defaultPetPreferences };
  private position: { x: number; y: number } | null = null;
  private base: PetActivity = 'idle';
  private reaction: PetActivity | null = 'hello';
  private reactionTimer: ReturnType<typeof setTimeout> | null = null;
  private dragTimer: ReturnType<typeof setInterval> | null = null;
  private dragDeadline: ReturnType<typeof setTimeout> | null = null;
  private persistenceError = false;
  private ready = false;
  private chatOpen = false;
  private readonly settingsPath = path.join(
    app.getPath('userData'),
    'desktop-pet.json',
  );

  constructor(
    private main: BrowserWindow,
    private load: (window: BrowserWindow) => void,
    private chat?: PetChatService,
  ) {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        this.preferences = preferencesSchema.parse({
          ...defaultPetPreferences,
          ...data.preferences,
        });
        this.position = positionSchema.nullable().parse(data.position ?? null);
      }
    } catch {
      this.persistenceError = true;
    }
    this.register();
    screen.on('display-removed', this.reposition);
    screen.on('display-metrics-changed', this.reposition);
    if (this.preferences.enabled) this.show();
  }

  private snapshot(): PetSnapshot {
    const activity = resolvePetActivity(
      this.base,
      this.reaction,
      Boolean(this.dragTimer),
    );
    return {
      chatOpen: this.chatOpen,
      preferences: { ...this.preferences },
      activity,
      message: petMessages[activity],
      persistenceError: this.persistenceError,
    };
  }

  private send() {
    for (const window of [this.main, this.window]) {
      if (window && !window.isDestroyed())
        window.webContents.send('pet:state', this.snapshot());
    }
  }

  private persist() {
    try {
      fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
      const temporary = `${this.settingsPath}.tmp`;
      fs.writeFileSync(
        temporary,
        JSON.stringify({
          preferences: this.preferences,
          position: this.position,
        }),
        'utf8',
      );
      fs.renameSync(temporary, this.settingsPath);
      this.persistenceError = false;
    } catch {
      this.persistenceError = true;
    }
  }

  private size() {
    return {
      width: Math.round((this.chatOpen ? 640 : 280) * this.preferences.scale),
      height: Math.round((this.chatOpen ? 600 : 400) * this.preferences.scale),
    };
  }

  private getPosition() {
    const size = this.size();
    const display = this.position
      ? screen.getDisplayNearestPoint(this.position)
      : screen.getPrimaryDisplay();
    const area = display.workArea;
    return clampPetPosition(
      this.position ?? {
        x: area.x + area.width - size.width - 24,
        y: area.y + area.height - size.height,
      },
      size,
      area,
    );
  }

  private reposition = () => {
    if (!this.window || this.window.isDestroyed()) return;
    this.position = this.getPosition();
    this.window.setBounds({ ...this.size(), ...this.position });
    this.persist();
  };

  private show() {
    if (this.window && !this.window.isDestroyed()) {
      this.reposition();
      if (this.ready) this.window.showInactive();
      return;
    }
    this.ready = false;
    this.window = new BrowserWindow({
      title: 'HiJapan 学习伙伴',
      ...this.size(),
      ...this.getPosition(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      show: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'pet-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', (event) =>
      event.preventDefault(),
    );
    this.window.once('ready-to-show', () => {
      this.ready = true;
      if (this.preferences.enabled) this.window?.showInactive();
      this.send();
      this.react('hello');
    });
    this.window.on('blur', () => this.endDrag());
    this.load(this.window);
  }

  private trusted(event: IpcMainInvokeEvent, mainOnly = false) {
    const allowed =
      event.sender === this.main.webContents ||
      (!mainOnly && event.sender === this.window?.webContents);
    if (!allowed || event.senderFrame !== event.sender.mainFrame)
      throw new Error('UNTRUSTED_IPC_SENDER');
  }

  private register() {
    const handle = (
      channel: string,
      callback: (event: IpcMainInvokeEvent, value: unknown) => unknown,
      mainOnly = false,
    ) => {
      ipcMain.handle(channel, (event, value) => {
        this.trusted(event, mainOnly);
        return callback(event, value);
      });
    };
    handle('pet:setChatOpen', (_event, value) => {
      this.chatOpen = z.boolean().parse(value);
      this.reposition();
      this.send();
    });
    handle('pet:getChat', () => this.chat?.history() ?? []);
    handle('pet:clearChat', () => this.chat?.clear());
    handle('pet:sendChat', async (_event, value) => {
      const message = z.string().trim().min(1).max(2000).parse(value);
      if (!this.chat) throw new Error('桌宠聊天服务不可用');
      this.setBase('think');
      try {
        return await this.chat.send(message, this.preferences);
      } finally {
        this.setBase('idle');
      }
    });
    handle('pet:openLesson', (_event, value) => {
      const id = z.string().max(140).parse(value);
      const [base, mode] = id.split('::');
      if (
        !base ||
        !this.chat?.lessonExists(base) ||
        (mode && !['game', 'matching', 'puzzle'].includes(mode))
      )
        throw new Error('课程不存在');
      this.navigate('learn');
      this.main.webContents.send('pet:lesson', id);
    });
    handle('pet:getState', () => this.snapshot());
    handle('pet:resetPosition', () => {
      this.endDrag();
      this.position = null;
      this.reposition();
    });
    handle('pet:updatePreferences', (_event, value) => {
      const patch = preferencesSchema.partial().parse(value);
      this.endDrag();
      this.preferences = { ...this.preferences, ...patch };
      if (this.preferences.enabled) this.show();
      else this.window?.hide();
      this.reposition();
      this.persist();
      this.send();
      return this.snapshot();
    });
    handle('pet:setInteractive', (event, value) => {
      if (event.sender !== this.window?.webContents)
        throw new Error('UNTRUSTED_IPC_SENDER');
      const interactive = z.boolean().parse(value);
      this.window?.setIgnoreMouseEvents(!interactive, { forward: true });
    });
    handle('pet:beginDrag', (event) => {
      if (
        event.sender !== this.window?.webContents ||
        this.preferences.locked ||
        this.dragTimer ||
        !this.window
      )
        return false;
      const origin = screen.getCursorScreenPoint();
      const bounds = this.window.getBounds();
      this.dragTimer = setInterval(() => {
        if (!this.window || this.window.isDestroyed()) return;
        const cursor = screen.getCursorScreenPoint();
        const area = screen.getDisplayNearestPoint(cursor).workArea;
        const next = clampPetPosition(
          {
            x: bounds.x + cursor.x - origin.x,
            y: bounds.y + cursor.y - origin.y,
          },
          this.size(),
          area,
        );
        this.window.setPosition(next.x, next.y);
      }, 16);
      this.dragDeadline = setTimeout(() => this.endDrag(), 30_000);
      this.send();
      return true;
    });
    handle('pet:endDrag', () => this.endDrag());
    handle(
      'pet:setActivity',
      (_event, value) =>
        this.setBase(z.enum(['idle', 'study', 'speak']).parse(value)),
      true,
    );
    handle('pet:act', (_event, value) => {
      const action = z
        .enum([
          'walk',
          'listen',
          'hint',
          'hello',
          'cheer',
          'rest',
          'sleep',
          'idle',
          'hide',
          'learn',
          'conversation',
          'settings',
          'reset-position',
        ])
        .parse(value);
      if (action === 'hide') {
        this.endDrag();
        this.preferences.enabled = false;
        this.window?.hide();
        this.persist();
        this.send();
      } else if (action === 'reset-position') {
        this.position = null;
        this.reposition();
      } else if (
        action === 'learn' ||
        action === 'conversation' ||
        action === 'settings'
      )
        this.navigate(action);
      else if (action === 'hello' || action === 'cheer') this.react(action);
      else {
        this.base = action;
        this.reaction = null;
        this.send();
      }
    });
  }

  private navigate(destination: PetDestination) {
    if (this.main.isDestroyed()) return;
    if (this.main.isMinimized()) this.main.restore();
    this.main.show();
    this.main.focus();
    this.main.webContents.send('pet:navigate', destination);
  }

  private endDrag() {
    if (!this.dragTimer) return;
    clearInterval(this.dragTimer);
    this.dragTimer = null;
    if (this.dragDeadline) clearTimeout(this.dragDeadline);
    this.dragDeadline = null;
    if (this.window && !this.window.isDestroyed()) {
      const { x, y } = this.window.getBounds();
      this.position = { x, y };
      this.persist();
    }
    this.send();
  }

  setBase(activity: PetActivity) {
    if (this.base === 'sleep' || this.base === 'rest') return;
    this.base = activity;
    this.send();
  }

  react(activity: 'hello' | 'cheer') {
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.reaction = activity;
    this.send();
    this.reactionTimer = setTimeout(() => {
      this.reaction = null;
      this.send();
    }, 2200);
  }

  reset() {
    this.chat?.clear();
    this.endDrag();
    this.preferences = { ...defaultPetPreferences, enabled: false };
    this.position = null;
    this.base = 'idle';
    this.reaction = null;
    if (fs.existsSync(this.settingsPath)) fs.unlinkSync(this.settingsPath);
    this.persistenceError = false;
    this.window?.hide();
    this.send();
  }

  dispose() {
    this.endDrag();
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    screen.removeListener('display-removed', this.reposition);
    screen.removeListener('display-metrics-changed', this.reposition);
    for (const channel of channels) ipcMain.removeHandler(channel);
    this.window?.destroy();
    this.window = null;
  }
}
