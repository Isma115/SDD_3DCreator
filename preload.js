// Expone al renderer únicamente las operaciones de configuración que necesita;
// el acceso a Electron y al sistema de ficheros queda aislado en el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  readConfig: () => ipcRenderer.sendSync('config:read'),
  writeConfig: (text) => ipcRenderer.sendSync('config:write', String(text)),
  saveModel: (text) => ipcRenderer.sendSync('model:save', String(text)),
  loadModel: () => ipcRenderer.sendSync('model:load'),
  confirmClose: () => ipcRenderer.sendSync('app:confirm-close'),
  onCloseRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:request-close', listener);
    return () => ipcRenderer.removeListener('app:request-close', listener);
  },
  respondClose: (shouldClose) => ipcRenderer.send('app:close-response', Boolean(shouldClose))
});
