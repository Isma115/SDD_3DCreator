// Guarda fotogramas completos del modelo en lugar de operaciones inversas, de modo
// que cualquier cambio efectivo pueda deshacerse aunque lo origine otro módulo.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { app, names } = SDD3D;

  // Mantiene el límite de memoria, el cursor activo y las copias independientes
  // que permiten restaurar un estado sin compartir referencias mutables.
  // Tope de fotogramas guardados. Se conservan los más recientes para acotar la
  // memoria si la sesión se alarga; el más antiguo pasa a ser el nuevo suelo.
  const MAX_ENTRIES = 100;

  const history = {
    // Fotogramas del modelo en orden. El primero es el estado de partida y cada
    // uno siguiente es el estado resultante de un cambio.
    entries: [],
    // Fotograma que se está mostrando: el estado activo es entries[index].
    index: -1,
    // Bloquea el registro mientras se restaura un fotograma, para que las propias
    // llamadas del historial no generen entradas nuevas.
    recording: true
  };

  // Copia profunda del modelo. Los puntos se copian uno a uno a propósito: los
  // objetos que hay dentro del estado se reutilizan y mutan entre operaciones, y
  // un fotograma que compartiera esas referencias se iría modificando solo.
  function copyPoint(point) {
    return { x: point.x, y: point.y, z: point.z };
  }

  function collect() {
    const state = app.state;
    return {
      cubes: [...state.cubes.values()].map(copyPoint),
      edges: state.edges.map((edge) => [copyPoint(edge[0]), copyPoint(edge[1])]),
      faces: state.faces.map((face) => face.map(copyPoint)),
      selectedCube: state.selectedCube ? copyPoint(state.selectedCube) : null,
      pointPath: state.pointPath.map(copyPoint)
    };
  }

  function restore(snapshot) {
    const state = app.state;
    state.cubes = new Map(snapshot.cubes.map((cube) => [names.keyOf(cube), copyPoint(cube)]));
    state.edges = snapshot.edges.map((edge) => [copyPoint(edge[0]), copyPoint(edge[1])]);
    state.faces = snapshot.faces.map((face) => face.map(copyPoint));
    app.setSelectedCube(snapshot.selectedCube);
    SDD3D.selection.setPointPath(snapshot.pointPath.map(copyPoint));
  }

  // Registra cambios efectivos, descarta la rama rehacible al crear una acción nueva
  // y ofrece navegación agrupada para operaciones compuestas.
  // Guarda el estado actual como último fotograma. La llama la envoltura después de
  // cada cambio efectivo.
  function commit() {
    history.recording = false;
    try {
      // Una acción nueva descarta el futuro que se hubiera deshecho.
      history.entries.length = history.index + 1;
      history.entries.push(collect());
      if (history.entries.length > MAX_ENTRIES) history.entries.shift();
      history.index = history.entries.length - 1;
    } finally {
      history.recording = true;
    }
  }

  function goTo(target, action) {
    if (target < 0 || target >= history.entries.length) {
      app.setStatus(`Nada que ${action}`);
      return false;
    }
    history.recording = false;
    try {
      history.index = target;
      restore(history.entries[target]);
    } finally {
      history.recording = true;
    }
    app.updateCountStatus();
    return true;
  }

  // Agrupa varios cambios para que cuenten como una sola acción: uso interno para
  // poder mover el cursor del modelo y colocar el bloque en el mismo fotograma.
  // No es para la interfaz.
  function runAsOneChange(action) {
    const wasRecording = history.recording;
    history.recording = false;
    try {
      return action();
    } finally {
      history.recording = wasRecording;
      if (wasRecording) commit();
    }
  }

  // Arranca el historial en el estado inicial, conecta las operaciones del modelo y
  // publica los controles de deshacer/rehacer para la entrada de usuario.
  // Arranca el historial tomando el modelo ya inicializado como estado de partida:
  // el bloque central con el que abre la aplicación no es una acción que se deshaga.
  function init() {
    history.entries = [collect()];
    history.index = 0;
    history.recording = true;
  }

  function undo() {
    return goTo(history.index - 1, 'deshacer');
  }

  function redo() {
    return goTo(history.index + 1, 'rehacer');
  }

  // Envuelve un método del modelo para guardar el fotograma resultante después de
  // cada cambio efectivo. Si el método no hace nada (espacio ocupado, arista o cara
  // repetida, bloque inexistente) devuelve un valor falso y no se guarda nada.
  function wrapModelChange(name) {
    const original = app[name];
    app[name] = function wrapped(...parameters) {
      const result = original.apply(app, parameters);
      if (result && history.recording) commit();
      return result;
    };
  }

  // El modelo no avisa de sus cambios, así que sus operaciones se envuelven aquí.
  // Las cuatro son la única vía de modificación del modelo, de modo que un fotograma
  // por operación basta para deshacer y rehacer bloques, aristas y caras. Elegir el
  // bloque de partida no genera entrada propia: es un cursor, y cada fotograma ya
  // guarda cuál estaba seleccionado, así que deshacer deja la selección de antes.
  // El historial no cubre la cámara ni el mapa de textura: las Specs solo piden
  // deshacer y rehacer los cambios del modelo 3D.
  ['addCube', 'removeCube', 'addEdge', 'addFace'].forEach(wrapModelChange);

  SDD3D.history = {
    init,
    undo,
    redo,
    runAsOneChange,
    canUndo: () => history.index > 0,
    canRedo: () => history.index < history.entries.length - 1
  };
})();
