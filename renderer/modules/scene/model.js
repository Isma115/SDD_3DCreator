// Estado del modelo 3D: cubos, aristas, caras y puntos seleccionados, junto con
// las operaciones básicas sobre ellos y el texto de estado de la interfaz.
(() => {
  'use strict';

  const { SDD3D } = window;

  const state = {
    mode: 'mouse',
    pointsVisible: false,
    showCubeLines: true,
    selectedCube: null,
    pointPath: [],
    edges: [],
    faces: [],
    // El modelo arranca con el cubo central ya colocado (ver init()).
    cubes: new Map(),
    camera: {
      yaw: 0.72,
      pitch: 0.56,
      distance: 10,
      target: { x: 0, y: 0, z: 0 }
    },
    pointer: null,
    textureDirty: true,
    webglTexture: null
  };

  function cubeAt(point) {
    return state.cubes.get(SDD3D.names.keyOf(point));
  }

  // Punto único de cambio del bloque seleccionado. Se centraliza aquí para que el
  // historial de deshacer/rehacer pueda observar la selección sin interceptar cada
  // sitio que la modifica (entrada, selección por click y cambio de control).
  function setSelectedCube(point) {
    state.selectedCube = point ? { x: point.x, y: point.y, z: point.z } : null;
    return state.selectedCube;
  }

  function setStatus(message) {
    SDD3D.dom.status.textContent = message;
  }

  function updateCountStatus() {
    const cubeCount = state.cubes.size;
    const pointCount = getModelPoints().length;
    setStatus(`${cubeCount} ${cubeCount === 1 ? 'bloque' : 'bloques'} · ${pointCount} puntos`);
  }

  // Estado inicial del modelo: cada vez que se abre la aplicación debe existir un
  // bloque en el centro de la rejilla, del que poder partir con cualquiera de los
  // dos controles. Se apoya en addCube para no duplicar la validación de ocupación.
  function init() {
    addCube({ x: 0, y: 0, z: 0 }, 'Bloque central creado');
  }

  function addCube(point, sourceMessage) {
    const key = SDD3D.names.keyOf(point);
    if (state.cubes.has(key)) {
      setStatus('Ese espacio ya está ocupado');
      return false;
    }
    state.cubes.set(key, { x: point.x, y: point.y, z: point.z });
    if (sourceMessage) setStatus(sourceMessage);
    else updateCountStatus();
    return true;
  }

  function removeCube(point) {
    const key = SDD3D.names.keyOf(point);
    if (!state.cubes.delete(key)) return false;
    if (state.selectedCube && SDD3D.names.keyOf(state.selectedCube) === key) setSelectedCube(null);
    updateCountStatus();
    return true;
  }

  function getModelPoints() {
    const points = new Map();
    for (const cube of state.cubes.values()) {
      for (const corner of [
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
      ]) {
        const point = { x: cube.x + corner[0], y: cube.y + corner[1], z: cube.z + corner[2] };
        points.set(SDD3D.names.keyOf(point), point);
      }
    }
    for (const edge of state.edges) {
      points.set(SDD3D.names.keyOf(edge[0]), edge[0]);
      points.set(SDD3D.names.keyOf(edge[1]), edge[1]);
    }
    for (const face of state.faces) {
      for (const point of face) points.set(SDD3D.names.keyOf(point), point);
    }
    return [...points.values()];
  }

  function samePoint(first, second) {
    return first.x === second.x && first.y === second.y && first.z === second.z;
  }

  // Devuelve true solo cuando la arista es nueva. El historial usa ese valor para
  // no guardar fotogramas de cambios que no han modificado nada.
  function addEdge(first, second) {
    const exists = state.edges.some((edge) =>
      (samePoint(edge[0], first) && samePoint(edge[1], second)) ||
      (samePoint(edge[0], second) && samePoint(edge[1], first))
    );
    if (exists) return false;
    state.edges.push([first, second]);
    return true;
  }

  // Igual que addEdge: solo devuelve true cuando la cara es nueva.
  function addFace(points) {
    const signature = points.map(SDD3D.names.keyOf).sort().join('|');
    const exists = state.faces.some((face) => face.map(SDD3D.names.keyOf).sort().join('|') === signature);
    if (exists) return false;
    state.faces.push(points.map((point) => ({ ...point })));
    return true;
  }

  SDD3D.app = {
    state,
    init,
    cubeAt,
    setSelectedCube,
    setStatus,
    updateCountStatus,
    addCube,
    removeCube,
    getModelPoints,
    samePoint,
    addEdge,
    addFace
  };
})();
