import { contextBridge, ipcRenderer } from 'electron';
import type { HiJapanApi } from './shared/contracts';
import type { PetSnapshot, PetDestination } from './shared/pet-contracts';

const api: HiJapanApi = {
  companion: {
    onLesson: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string) =>
        listener(id);
      ipcRenderer.on('pet:lesson', handler);
      return () => {
        ipcRenderer.removeListener('pet:lesson', handler);
      };
    },
    resetPosition: () => ipcRenderer.invoke('pet:resetPosition'),
    getState: () => ipcRenderer.invoke('pet:getState'),
    updatePreferences: (patch) =>
      ipcRenderer.invoke('pet:updatePreferences', patch),
    setActivity: (activity) => ipcRenderer.invoke('pet:setActivity', activity),
    onState: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: PetSnapshot) =>
        listener(state);
      ipcRenderer.on('pet:state', handler);
      return () => {
        ipcRenderer.removeListener('pet:state', handler);
      };
    },
    onNavigate: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        destination: PetDestination,
      ) => listener(destination);
      ipcRenderer.on('pet:navigate', handler);
      return () => {
        ipcRenderer.removeListener('pet:navigate', handler);
      };
    },
  },
  app: {
    getSnapshot: () => ipcRenderer.invoke('app:getSnapshot'),
    saveProfile: (input) => ipcRenderer.invoke('app:saveProfile', input),
    resetAllData: () => ipcRenderer.invoke('app:resetAllData'),
  },
  learning: {
    getTodayPlan: () => ipcRenderer.invoke('learning:getTodayPlan'),
    listLessons: (scene) => ipcRenderer.invoke('learning:listLessons', scene),
    getLesson: (lessonId) => ipcRenderer.invoke('learning:getLesson', lessonId),
    completeLesson: (lessonId, difficultIds) =>
      ipcRenderer.invoke('learning:completeLesson', lessonId, difficultIds),
    listDialogues: (scene) =>
      ipcRenderer.invoke('learning:listDialogues', scene),
    getKanaProgress: () => ipcRenderer.invoke('learning:getKanaProgress'),
    completeKanaLesson: (lessonId, gameCompleted) =>
      ipcRenderer.invoke(
        'learning:completeKanaLesson',
        lessonId,
        gameCompleted,
      ),
    listJlptLessons: (level) =>
      ipcRenderer.invoke('learning:listJlptLessons', level),
    getJlptLesson: (lessonId) =>
      ipcRenderer.invoke('learning:getJlptLesson', lessonId),
    getJlptProgress: () => ipcRenderer.invoke('learning:getJlptProgress'),
    completeJlptLesson: (input) =>
      ipcRenderer.invoke('learning:completeJlptLesson', input),
    getJlptCumulativeLesson: (level) =>
      ipcRenderer.invoke('learning:getJlptCumulativeLesson', level),
  },
  review: {
    getDue: (limit) => ipcRenderer.invoke('review:getDue', limit),
    grade: (contentId, grade) =>
      ipcRenderer.invoke('review:grade', contentId, grade),
  },
  ai: {
    getSettings: () => ipcRenderer.invoke('ai:getSettings'),
    saveAndTest: (input) => ipcRenderer.invoke('ai:saveAndTest', input),
    deleteSettings: () => ipcRenderer.invoke('ai:deleteSettings'),
    sendTurn: (input) => ipcRenderer.invoke('ai:sendTurn', input),
    finishConversation: (sessionId) =>
      ipcRenderer.invoke('ai:finishConversation', sessionId),
    listHistory: () => ipcRenderer.invoke('ai:listHistory'),
    getHistory: (sessionId) => ipcRenderer.invoke('ai:getHistory', sessionId),
    deleteHistory: (sessionId) =>
      ipcRenderer.invoke('ai:deleteHistory', sessionId),
    deleteAllHistory: () => ipcRenderer.invoke('ai:deleteAllHistory'),
  },
  backup: {
    exportData: () => ipcRenderer.invoke('backup:exportData'),
    importData: () => ipcRenderer.invoke('backup:importData'),
  },
};

contextBridge.exposeInMainWorld('hiJapan', api);
