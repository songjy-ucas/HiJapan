import { contextBridge, ipcRenderer } from 'electron';
import type { HiJapanApi } from './shared/contracts';

const api: HiJapanApi = {
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
