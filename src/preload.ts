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
  },
  backup: {
    exportData: () => ipcRenderer.invoke('backup:exportData'),
    importData: () => ipcRenderer.invoke('backup:importData'),
  },
};

contextBridge.exposeInMainWorld('hiJapan', api);
