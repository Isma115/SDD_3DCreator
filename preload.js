const { contextBridge, ipcRenderer } = require('electron');

// Puente del renderer. La configuración de la aplicación vive en un fichero que solo
// puede tocar el proceso principal: aquí se expone lo justo para leerlo y escribirlo.
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  readConfig: () => ipcRenderer.sendSync('config:read'),
  writeConfig: (text) => ipcRenderer.sendSync('config:write', String(text))
});
