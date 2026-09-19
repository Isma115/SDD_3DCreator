// #region Dependencias y estado del proceso principal
// Carga Electron y las utilidades de sistema necesarias para crear la ventana y
// persistir la configuración fuera del renderer.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

let mainWindow;
// #endregion Dependencias y estado del proceso principal

// #region Persistencia de la configuración
// Centraliza la ubicación y las operaciones de lectura/escritura del JSON de
// preferencias. El renderer no puede escribir ficheros directamente.
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    return fs.readFileSync(configPath(), 'utf8');
  } catch (error) {
    // La primera vez que se abre la aplicación el fichero no existe todavía.
    return '';
  }
}

function writeConfig(text) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), text, 'utf8');
  } catch (error) {
    // Si no se puede guardar, la sesión sigue: solo se pierde la configuración.
    console.error('No se pudo guardar la configuración:', error.message);
  }
}
// #endregion Persistencia de la configuración

// #region Puente IPC de configuración
// Registra los canales síncronos que utiliza el preload para solicitar y guardar
// la configuración en el proceso principal.
function registerConfigHandlers() {
  ipcMain.on('config:read', (event) => {
    event.returnValue = readConfig();
  });
  ipcMain.on('config:write', (event, text) => {
    writeConfig(text);
    event.returnValue = true;
  });
}
// #endregion Puente IPC de configuración

// #region Creación y ciclo de vida de la ventana
// Crea la ventana principal y conserva el ciclo de vida estándar de Electron,
// incluida la recreación de la ventana al reactivar la aplicación.
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#101319',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Modo ventana ocupando todo el espacio disponible del escritorio.
  mainWindow.maximize();

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  registerConfigHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
// #endregion Creación y ciclo de vida de la ventana
