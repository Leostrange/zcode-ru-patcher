const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  detectZcode: () => ipcRenderer.invoke('detect-dir'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectAsar: () => ipcRenderer.invoke('select-asar'),
  checkZcode: (dir) => ipcRenderer.invoke('check-zcode', dir),
  patchZcode: (dir, src) => ipcRenderer.invoke('patch-zcode', dir, src),
  restoreZcode: (dir) => ipcRenderer.invoke('restore-zcode', dir),
  onProgress: (cb) => ipcRenderer.on('progress', (e, data) => cb(data)),
});
