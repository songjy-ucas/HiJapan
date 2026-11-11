import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopPetApi, PetSnapshot } from './shared/pet-contracts';
const api: DesktopPetApi = {
  setChatOpen: (open) => ipcRenderer.invoke('pet:setChatOpen', open),
  getChat: () => ipcRenderer.invoke('pet:getChat'),
  sendChat: (message) => ipcRenderer.invoke('pet:sendChat', message),
  clearChat: () => ipcRenderer.invoke('pet:clearChat'),
  openLesson: (id) => ipcRenderer.invoke('pet:openLesson', id),
  resetPosition: () => ipcRenderer.invoke('pet:resetPosition'),
  getState: () => ipcRenderer.invoke('pet:getState'),
  updatePreferences: (patch) =>
    ipcRenderer.invoke('pet:updatePreferences', patch),
  onState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: PetSnapshot) =>
      listener(state);
    ipcRenderer.on('pet:state', handler);
    return () => {
      ipcRenderer.removeListener('pet:state', handler);
    };
  },
  act: (action) => ipcRenderer.invoke('pet:act', action),
  beginDrag: () => ipcRenderer.invoke('pet:beginDrag'),
  endDrag: () => ipcRenderer.invoke('pet:endDrag'),
  setInteractive: (interactive) =>
    ipcRenderer.invoke('pet:setInteractive', interactive),
};
contextBridge.exposeInMainWorld('desktopPet', api);
