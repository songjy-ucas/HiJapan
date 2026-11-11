import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, value?: unknown) => unknown>(),
  writes: vi.fn(),
  exists: vi.fn(() => false),
  read: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock('node:fs', () => ({
  default: {
    existsSync: mocks.exists,
    readFileSync: mocks.read,
    writeFileSync: mocks.writes,
    renameSync: mocks.rename,
    unlinkSync: mocks.unlink,
    mkdirSync: vi.fn(),
  },
}));
class FakeWindow extends EventEmitter {
  webContents = {
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
    mainFrame: {},
  };
  showInactive = vi.fn();
  hide = vi.fn();
  show = vi.fn();
  focus = vi.fn();
  restore = vi.fn();
  setBounds = vi.fn();
  setPosition = vi.fn();
  setIgnoreMouseEvents = vi.fn();
  destroy = vi.fn();
  isDestroyed = () => false;
  isMinimized = () => false;
  getBounds = () => ({ x: 1600, y: 640, width: 280, height: 400 });
}
vi.mock('electron', () => ({
  app: { getPath: () => '/test-only/hijapan' },
  BrowserWindow: class {
    webContents = {
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      mainFrame: {},
    };
    showInactive = vi.fn();
    hide = vi.fn();
    setBounds = vi.fn();
    setPosition = vi.fn();
    setIgnoreMouseEvents = vi.fn();
    destroy = vi.fn();
    once = vi.fn();
    on = vi.fn();
    isDestroyed = () => false;
    getBounds = () => ({ x: 1600, y: 640, width: 280, height: 400 });
  },
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, value?: unknown) => unknown,
    ) => mocks.handlers.set(channel, handler),
    removeHandler: (channel: string) => mocks.handlers.delete(channel),
  },
  screen: {
    on: vi.fn(),
    removeListener: vi.fn(),
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    }),
    getDisplayNearestPoint: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    }),
    getCursorScreenPoint: () => ({ x: 1700, y: 700 }),
  },
}));
import { DesktopPetController } from '../src/main/desktop-pet';

describe('desktop pet IPC and local preferences', () => {
  let main: FakeWindow;
  let pet: FakeWindow;
  let controller: DesktopPetController;
  const call = (channel: string, sender: FakeWindow, value?: unknown) =>
    mocks.handlers.get(channel)?.(
      {
        sender: sender.webContents,
        senderFrame: sender.webContents.mainFrame,
      } as unknown as IpcMainInvokeEvent,
      value,
    );
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exists.mockReturnValue(false);
    main = new FakeWindow();
    controller = new DesktopPetController(
      main as unknown as BrowserWindow,
      (window) => {
        pet = window as unknown as FakeWindow;
      },
    );
  });
  afterEach(() => controller.dispose());
  it('denies other windows and limits the pet to its own controls', () => {
    expect(() => call('pet:getState', new FakeWindow())).toThrow('UNTRUSTED');
    expect(() => call('pet:setActivity', pet, 'study')).toThrow('UNTRUSTED');
    expect(() =>
      mocks.handlers.get('pet:getState')?.({
        sender: main.webContents,
        senderFrame: {},
      }),
    ).toThrow('UNTRUSTED');
    expect(() => call('pet:updatePreferences', main, { scale: 9 })).toThrow();
    expect(() =>
      call('pet:updatePreferences', main, { apiKey: 'never-allowed' }),
    ).toThrow();
  });
  it('saves preferences, hides the pet and permits reopening from settings', () => {
    call('pet:updatePreferences', main, { enabled: false, locked: true });
    expect(pet.hide).toHaveBeenCalled();
    expect(mocks.writes).toHaveBeenCalled();
    expect(call('pet:beginDrag', pet)).toBe(false);
    call('pet:updatePreferences', main, { enabled: true });
    expect(call('pet:getState', main)).toMatchObject({
      preferences: { enabled: true, locked: true },
    });
  });
  it('does not let learning events wake a manually sleeping pet', () => {
    call('pet:act', pet, 'sleep');
    controller.setBase('think');
    controller.react('cheer');
    expect(call('pet:getState', main)).toMatchObject({ activity: 'sleep' });
    call('pet:act', pet, 'idle');
    expect(call('pet:getState', main)).toMatchObject({ activity: 'idle' });
    call('pet:act', pet, 'learn');
    expect(main.webContents.send).toHaveBeenCalledWith('pet:navigate', 'learn');
  });
  it('clears preferences and removes handlers on shutdown', () => {
    mocks.exists.mockReturnValue(true);
    controller.reset();
    expect(mocks.unlink).toHaveBeenCalled();
    expect(call('pet:getState', main)).toMatchObject({
      preferences: { enabled: false },
    });
    controller.dispose();
    expect(mocks.handlers.size).toBe(0);
  });
});
