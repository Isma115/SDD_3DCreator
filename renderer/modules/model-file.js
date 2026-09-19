// Serializa el modelo 3D en un fichero elegido por el usuario y lo recupera solo
// cuando se solicita explícitamente. El modelo no forma parte de la configuración
// de la interfaz, por lo que abrir la aplicación siempre parte del cubo inicial.
(() => {
  'use strict';

  const { SDD3D } = window;
  const MODEL_VERSION = 1;
  const MODEL_OPERATIONS = ['addCube', 'removeCube', 'addEdge', 'addFace', 'removeFace', 'replaceFace'];
  let dirty = true;
  let wrapped = false;

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isGridPoint(value) {
    return isPlainObject(value) && ['x', 'y', 'z'].every((axis) => Number.isInteger(value[axis]));
  }

  function copyPoint(point) {
    return { x: point.x, y: point.y, z: point.z };
  }

  // El fichero conserva geometría (cubos, aristas y caras). Cámara, preferencias de
  // vista y textura quedan fuera del modelo y siguen siendo estado de la aplicación.
  function copyModel() {
    const state = SDD3D.app.state;
    return {
      version: MODEL_VERSION,
      cubes: [...state.cubes.values()].map(copyPoint),
      edges: state.edges.map((edge) => [copyPoint(edge[0]), copyPoint(edge[1])]),
      faces: state.faces.map((face) => face.map(copyPoint))
    };
  }

  // Rechaza el fichero completo si su estructura no representa un modelo de rejilla
  // válido. Así una carga parcial nunca deja una escena a medio actualizar.
  function sanitize(raw) {
    if (!isPlainObject(raw) || raw.version !== MODEL_VERSION) return null;
    if (!Array.isArray(raw.cubes) || raw.cubes.some((cube) => !isGridPoint(cube))) return null;
    const cubes = raw.cubes.map(copyPoint);
    const cubeKeys = new Set(cubes.map(SDD3D.names.keyOf));
    if (cubeKeys.size !== cubes.length) return null;

    if (!Array.isArray(raw.edges) || raw.edges.some((edge) =>
      !Array.isArray(edge) || edge.length !== 2 ||
      !edge.every(isGridPoint) || SDD3D.app.samePoint(edge[0], edge[1]))) return null;
    const edges = raw.edges.map((edge) => [copyPoint(edge[0]), copyPoint(edge[1])]);

    if (!Array.isArray(raw.faces) || raw.faces.some((face) =>
      !Array.isArray(face) || face.length < 3 ||
      face.some((point) => !isGridPoint(point)) ||
      new Set(face.map(SDD3D.names.keyOf)).size !== face.length)) return null;
    const faces = raw.faces.map((face) => face.map(copyPoint));

    return { cubes, edges, faces };
  }

  function applyModel(model) {
    const state = SDD3D.app.state;
    state.cubes = new Map(model.cubes.map((cube) => [SDD3D.names.keyOf(cube), copyPoint(cube)]));
    state.edges = model.edges.map((edge) => [copyPoint(edge[0]), copyPoint(edge[1])]);
    SDD3D.app.setFaces(model.faces);
    SDD3D.app.setSelectedCube(null);
    SDD3D.selection.resetFacePath();
    SDD3D.selection.setPointPath([]);
    SDD3D.history.init();
    SDD3D.app.updateCountStatus();
  }

  function saveModel() {
    const bridge = window.desktop;
    if (!bridge || typeof bridge.saveModel !== 'function') return false;
    try {
      const result = bridge.saveModel(JSON.stringify(copyModel(), null, 2));
      if (!result || result.saved !== true) return false;
      dirty = false;
      SDD3D.app.setStatus('Modelo guardado');
      return true;
    } catch (error) {
      SDD3D.app.setStatus('No se pudo guardar el modelo');
      return false;
    }
  }

  function loadModel() {
    const bridge = window.desktop;
    if (!bridge || typeof bridge.loadModel !== 'function') return false;
    let result;
    try {
      result = bridge.loadModel();
    } catch (error) {
      SDD3D.app.setStatus('No se pudo cargar el modelo');
      return false;
    }
    if (!result || result.loaded !== true) return false;

    let model;
    try {
      model = sanitize(JSON.parse(String(result.text)));
    } catch (error) {
      model = null;
    }
    if (!model) {
      SDD3D.app.setStatus('El archivo de modelo no es válido');
      return false;
    }

    applyModel(model);
    dirty = false;
    SDD3D.app.setStatus('Modelo cargado');
    return true;
  }

  function markDirty() {
    dirty = true;
  }

  // Marca cualquier cambio efectivo del modelo, incluidos deshacer y rehacer, sin
  // hacer que la selección o los ajustes de vista vuelvan sucio el fichero.
  function wrapModelChanges() {
    if (wrapped) return;
    wrapped = true;
    for (const name of MODEL_OPERATIONS) {
      const original = SDD3D.app[name];
      SDD3D.app[name] = function wrappedModelOperation(...parameters) {
        const result = original.apply(SDD3D.app, parameters);
        if (result) markDirty();
        return result;
      };
    }
    for (const name of ['undo', 'redo']) {
      const original = SDD3D.history[name];
      SDD3D.history[name] = function wrappedHistoryOperation(...parameters) {
        const result = original.apply(SDD3D.history, parameters);
        if (result) markDirty();
        return result;
      };
    }
  }

  function handleCloseRequest() {
    const bridge = window.desktop;
    if (!bridge || typeof bridge.respondClose !== 'function') return;
    if (!dirty) {
      bridge.respondClose(true);
      return;
    }

    let choice;
    try {
      choice = typeof bridge.confirmClose === 'function' ? bridge.confirmClose() : 2;
    } catch (error) {
      bridge.respondClose(false);
      return;
    }
    if (choice === 0) {
      bridge.respondClose(saveModel());
    } else {
      bridge.respondClose(choice === 1);
    }
  }

  function init() {
    wrapModelChanges();
    const bridge = window.desktop;
    if (bridge && typeof bridge.onCloseRequest === 'function') {
      bridge.onCloseRequest(handleCloseRequest);
    }
  }

  SDD3D.modelFile = {
    init,
    saveModel,
    loadModel,
    markDirty,
    isDirty: () => dirty
  };
})();
