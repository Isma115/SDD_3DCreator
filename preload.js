// #region Puente seguro entre procesos
// Expone al renderer únicamente las operaciones de configuración que necesita;
// el acceso a Electron y al sistema de ficheros queda aislado en el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  readConfig: () => ipcRenderer.sendSync('config:read'),
  writeConfig: (text) => ipcRenderer.sendSync('config:write', String(text))
});
// #endregion Puente seguro entre procesos
