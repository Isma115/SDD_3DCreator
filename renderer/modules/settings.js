// #region Configuración persistida de la aplicación
// Guarda y recupera las opciones de vista, control y cámara, tolerando ficheros
// incompletos o inválidos sin impedir que el editor arranque.
//
// El renderer no puede escribir ficheros, así que la lectura y la escritura las hace
// el proceso principal (ver main.js y preload.js). Si la aplicación se abre fuera de
// Electron, el puente no existe y la configuración simplemente no se guarda.
(() => {
  'use strict';

  const { SDD3D } = window;

  // #region Estado, validación y valores por defecto
  // Define el formato persistido y filtra cada campo antes de incorporarlo al estado
  // activo.
  // Versión del formato guardado. Un fichero de otra versión se ignora en lugar de
  // intentar interpretarlo.
  const VERSION = 1;
  // Espera antes de escribir. Los cambios se agrupan para no escribir un fichero por
  // cada tecla o cada paso de la rueda del ratón.
  const SAVE_DELAY = 400;
  const MODES = ['mouse', 'keyboard'];
  const MOVEMENT_KEYS = ['w', 'a', 's', 'd'];

  let saveTimer = null;
  let lastWritten = '';
  let stored = null;

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  // Un punto de rejilla válido: tres coordenadas enteras.
  function isGridPoint(value) {
    return isPlainObject(value) && ['x', 'y', 'z'].every((axis) => Number.isInteger(value[axis]));
  }

  // El centro de la cámara no es un punto de rejilla: desplazarla arrastrando con el
  // click derecho lo deja en coordenadas con decimales, así que solo se exige que las
  // tres sean números finitos.
  function isFinitePoint(value) {
    return isPlainObject(value) && ['x', 'y', 'z'].every((axis) => isFiniteNumber(value[axis]));
  }

  function copyPoint(point) {
    return { x: point.x, y: point.y, z: point.z };
  }

  function defaultSettings() {
    const state = SDD3D.app.state;
    return {
      version: VERSION,
      mode: state.mode,
      showCubeLines: state.showCubeLines,
      pointsVisible: state.pointsVisible,
      camera: {
        yaw: state.camera.yaw,
        pitch: state.camera.pitch,
        distance: state.camera.distance,
        target: copyPoint(state.camera.target)
      },
      selectedCube: state.selectedCube ? copyPoint(state.selectedCube) : null,
      faces: state.faces.map((face) => face.map(copyPoint))
    };
  }

  // Comprueba lo leído y se queda solo con lo que tiene un valor válido. Cada ajuste
  // que no lo sea se descarta por separado: el resto de la configuración se aplica
  // igual. La lista de coordenadas heredada de una versión anterior se convierte en
  // caras y, si no se puede leer entera, se descarta: media lista sería otra forma.
  function sanitize(raw) {
    if (!isPlainObject(raw) || raw.version !== VERSION) return null;
    const settings = defaultSettings();
    if (MODES.includes(raw.mode)) settings.mode = raw.mode;
    if (typeof raw.showCubeLines === 'boolean') settings.showCubeLines = raw.showCubeLines;
    if (typeof raw.pointsVisible === 'boolean') settings.pointsVisible = raw.pointsVisible;
    if (isPlainObject(raw.camera)) {
      for (const key of ['yaw', 'pitch', 'distance']) {
        if (isFiniteNumber(raw.camera[key])) settings.camera[key] = raw.camera[key];
      }
      if (isFinitePoint(raw.camera.target)) settings.camera.target = copyPoint(raw.camera.target);
    }
    if (isGridPoint(raw.selectedCube)) settings.selectedCube = copyPoint(raw.selectedCube);
    if (Array.isArray(raw.faces) && raw.faces.every((face) =>
      Array.isArray(face) && face.length >= 3 && face.every(isGridPoint))) {
      settings.faces = raw.faces.map((face) => face.map(copyPoint));
    }
    return settings;
  }

  // #endregion Estado, validación y valores por defecto
  // #region Lectura y escritura de preferencias
  // Encapsula el puente con Electron y evita que un error de lectura o escritura
  // afecte al funcionamiento de la sesión.
  function readFile() {
    const bridge = window.desktop;
    if (!bridge || typeof bridge.readConfig !== 'function') return null;
    try {
      const text = bridge.readConfig();
      if (!text) return null;
      return sanitize(JSON.parse(text));
    } catch (error) {
      // Un fichero de configuración ilegible no debe impedir abrir la aplicación: se
      // arranca con los valores por defecto.
      return null;
    }
  }

  function writeFile(settings) {
    const bridge = window.desktop;
    if (!bridge || typeof bridge.writeConfig !== 'function') return;
    const text = JSON.stringify(settings);
    // Lo que ya está en el fichero no se vuelve a escribir: al arrancar, aplicar la
    // configuración guardada pide un guardado que no aportaría nada.
    if (text === lastWritten) return;
    lastWritten = text;
    try {
      bridge.writeConfig(text);
    } catch (error) {
      // Sin escritura la aplicación sigue funcionando: la configuración solo no
      // sobrevive al cierre.
    }
  }

  // Guarda la configuración actual. Los ajustes que se aplican al arrancar se
  // escriben tal cual se leyeron, para no perder lo que este código no conozca.
  function save() {
    const settings = stored || defaultSettings();
    settings.version = VERSION;
    settings.mode = SDD3D.app.state.mode;
    settings.showCubeLines = SDD3D.app.state.showCubeLines;
    settings.pointsVisible = SDD3D.app.state.pointsVisible;
    settings.camera = {
      yaw: SDD3D.app.state.camera.yaw,
      pitch: SDD3D.app.state.camera.pitch,
      distance: SDD3D.app.state.camera.distance,
      target: copyPoint(SDD3D.app.state.camera.target)
    };
    settings.selectedCube = SDD3D.app.state.selectedCube
      ? copyPoint(SDD3D.app.state.selectedCube)
      : null;
    settings.faces = SDD3D.app.state.faces.map((face) => face.map(copyPoint));
    stored = settings;
    writeFile(settings);
  }

  // Pide un guardado, agrupando los cambios seguidos. La aplicación llama a esto tras
  // cualquier acción que pueda haber cambiado la configuración.
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save();
    }, SAVE_DELAY);
  }

  function flush() {
    if (saveTimer === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    save();
  }

  // #endregion Lectura y escritura de preferencias
  // #region Aplicación e inicialización
  // Vuelve a dejar el modelo y la interfaz en el estado guardado. El orden importa:
  // primero el modelo, luego los ajustes que refrescan los botones del menú, después
  // el modo —que elige qué bloque queda seleccionado— y por último el bloque de
  // partida.
  function apply(settings) {
    const state = SDD3D.app.state;
    state.showCubeLines = settings.showCubeLines;
    state.pointsVisible = settings.pointsVisible;
    state.camera = {
      yaw: settings.camera.yaw,
      pitch: settings.camera.pitch,
      distance: settings.camera.distance,
      target: copyPoint(settings.camera.target)
    };
    SDD3D.app.setFaces(settings.faces);
    // La selección de puntos no se guarda: es un trazo a medias, no configuración.
    SDD3D.selection.setPointPath([]);
    SDD3D.ui.refreshToggleStates();
    SDD3D.ui.switchMode(settings.mode);
    // El bloque de partida se recupera solo si sigue existiendo: un fichero editado a
    // mano no debe dejar la selección en una casilla vacía.
    SDD3D.app.setSelectedCube(settings.selectedCube ? SDD3D.app.cubeAt(settings.selectedCube) : null);
  }

  function init() {
    const settings = readFile();
    if (settings) {
      stored = settings;
      // Lo que se acaba de leer cuenta como ya escrito: aplicar la configuración pide
      // un guardado que no aporta nada mientras el usuario no cambie algo.
      lastWritten = JSON.stringify(settings);
      apply(settings);
    }
    const bridge = window.desktop;
    if (bridge && typeof bridge.writeConfig === 'function') {
      // El cierre de la ventana no da tiempo a la espera del guardado agrupado.
      window.addEventListener('beforeunload', flush);
    }
    return settings;
  }

  // #endregion Aplicación e inicialización
  // #region API de configuración
  // Publica los puntos de entrada que utilizan la interfaz, la entrada y el ciclo
  // de vida de la ventana.
  SDD3D.settings = { init, save, scheduleSave, flush, apply, defaultSettings };
})();
// #endregion API de configuración
// #endregion Configuración persistida de la aplicación
