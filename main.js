// Carga Electron y las utilidades de sistema necesarias para crear la ventana y
// persistir la configuración fuera del renderer.
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

let mainWindow;
let closeRequestPending = false;

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

function saveModelFile(text) {
  const filePath = dialog.showSaveDialogSync(mainWindow, {
    title: 'Guardar modelo',
    defaultPath: 'modelo.sdd3d',
    filters: [{ name: 'Modelo 3D', extensions: ['sdd3d'] }]
  });
  if (!filePath) return { saved: false, canceled: true };
  try {
    fs.writeFileSync(filePath, text, 'utf8');
    return { saved: true };
  } catch (error) {
    console.error('No se pudo guardar el modelo:', error.message);
    dialog.showMessageBoxSync(mainWindow, {
      type: 'error',
      title: 'No se pudo guardar el modelo',
      message: 'No se pudo guardar el modelo.',
      detail: error.message
    });
    return { saved: false };
  }
}

function loadModelFile() {
  const result = dialog.showOpenDialogSync(mainWindow, {
    title: 'Cargar modelo',
    properties: ['openFile'],
    filters: [{ name: 'Modelo 3D', extensions: ['sdd3d'] }]
  });
  if (!result || result.length === 0) return { loaded: false, canceled: true };
  try {
    return { loaded: true, text: fs.readFileSync(result[0], 'utf8') };
  } catch (error) {
    console.error('No se pudo cargar el modelo:', error.message);
    dialog.showMessageBoxSync(mainWindow, {
      type: 'error',
      title: 'No se pudo cargar el modelo',
      message: 'No se pudo cargar el modelo.',
      detail: error.message
    });
    return { loaded: false };
  }
}

function registerModelHandlers() {
  ipcMain.on('model:save', (event, text) => {
    event.returnValue = saveModelFile(String(text));
  });
  ipcMain.on('model:load', (event) => {
    event.returnValue = loadModelFile();
  });
  ipcMain.on('app:confirm-close', (event) => {
    event.returnValue = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      title: 'Guardar modelo',
      message: '¿Quieres guardar el modelo actual antes de cerrar?',
      buttons: ['Guardar', 'No guardar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });
  });
  ipcMain.on('app:close-response', (_event, shouldClose) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    closeRequestPending = false;
    if (!shouldClose) return;
    // La confirmación ya se resolvió en el renderer. Destruir la ventana evita
    // volver a entrar en el interceptor de "close" y deja finalizar su ciclo.
    mainWindow.destroy();
  });
}

// Crea la ventana principal y conserva el ciclo de vida estándar de Electron,
// incluida la recreación de la ventana al reactivar la aplicación.
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#303030',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Modo ventana ocupando todo el espacio disponible del escritorio.
  mainWindow.maximize();

  mainWindow.on('close', (event) => {
    event.preventDefault();
    if (closeRequestPending) return;
    closeRequestPending = true;
    mainWindow.webContents.send('app:request-close');
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  registerConfigHandlers();
  registerModelHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
