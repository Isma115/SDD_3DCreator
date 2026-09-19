// Reúne la visibilidad de superficies, la extracción de aristas y las funciones
// que escriben vértices de malla o de líneas en buffers planos.
(() => {
  'use strict';

  const { SDD3D } = window;

  // Determina qué caras y aristas de la rejilla pertenecen al exterior del modelo,
  // evitando dibujar geometría interior entre cubos contiguos.
  function isExposed(cube, normal) {
    return !SDD3D.app.state.cubes.has(SDD3D.names.keyOf({
      x: cube.x + normal[0],
      y: cube.y + normal[1],
      z: cube.z + normal[2]
    }));
  }

  // Aristas de la rejilla que forman parte de la superficie visible del modelo.
  //
  // Una arista de la rejilla es la esquina de cuatro casillas a la vez (en 2D, la
  // esquina de cuatro cuadrados). Si las cuatro están ocupadas, la arista queda
  // dentro del modelo y no debe trazarse: es la rejilla interior que se veía sobre
  // las caras. Si falta alguna de las cuatro, la arista es un borde real y se
  // traza. Al ser un conjunto de aristas de rejilla, las aristas compartidas por
  // varios cubos se cuentan una sola vez.
  //
  // Las cuatro casillas que rodean la arista son el bloque 2x2 que crece hacia los
  // dos ejes perpendiculares desde la esquina de MAYOR coordenada de la arista.
  // Ese punto es fijo para la arista, mientras que el punto de arranque depende de
  // en qué sentido la recorra el cubo que la mira: mirar desde el arranque dejaba
  // sin ocultar las aristas interiores que se recorrían desde su esquina menor (en
  // un bloque 3x3x3 solo se ocultaban 5 de las 12 aristas interiores), y esas líneas
  // volvían a dibujarse sobre las caras lisas.
  const GRID_AXES = ['x', 'y', 'z'];

  function exposedCubeEdges() {
    const cubes = SDD3D.app.state.cubes;
    const edges = new Map();
    for (const cube of cubes.values()) {
      for (const [first, second] of SDD3D.CUBE_EDGES) {
        const start = SDD3D.CUBE_CORNERS[first];
        const end = SDD3D.CUBE_CORNERS[second];
        const startPoint = { x: cube.x + start[0], y: cube.y + start[1], z: cube.z + start[2] };
        const endPoint = { x: cube.x + end[0], y: cube.y + end[1], z: cube.z + end[2] };
        // La arista va en el eje en el que sus dos esquinas coinciden; los otros
        // dos ejes son las direcciones en las que hay que mirar las cuatro casillas.
        const along = GRID_AXES.find((axis) => startPoint[axis] === endPoint[axis]);
        const around = GRID_AXES.filter((axis) => axis !== along);
        const base = {
          x: Math.max(startPoint.x, endPoint.x),
          y: Math.max(startPoint.y, endPoint.y),
          z: Math.max(startPoint.z, endPoint.z)
        };
        let surrounded = true;
        for (const firstOffset of [-1, 0]) {
          for (const secondOffset of [-1, 0]) {
            const neighbor = { x: base.x, y: base.y, z: base.z };
            neighbor[around[0]] = base[around[0]] + firstOffset;
            neighbor[around[1]] = base[around[1]] + secondOffset;
            if (!cubes.has(SDD3D.names.keyOf(neighbor))) surrounded = false;
          }
        }
        if (surrounded) continue;
        // La clave lleva los dos extremos ordenados: varias aristas comparten
        // esquina y la misma arista puede recorrerse en los dos sentidos según el
        // cubo que la mire, así que solo los dos extremos la identifican.
        const key = SDD3D.names.edgeKeyOf(startPoint, endPoint);
        if (edges.has(key)) continue;
        edges.set(key, [startPoint, endPoint]);
      }
    }
    return [...edges.values()];
  }

  // Convierte caras y segmentos en el formato intercalado que consumen los shaders
  // de WebGL.
  function addMeshVertex(target, position, normal, color, uv) {
    target.push(
      position[0], position[1], position[2],
      normal[0], normal[1], normal[2],
      color[0], color[1], color[2],
      uv[0], uv[1]
    );
  }

  // Cara convexa con sus coordenadas de textura. El abanico desde la primera esquina
  // la divide en triángulos sin salirse de sus lados, así que sirve tanto para las
  // caras de un cubo (cuatro esquinas) como para los rectángulos que cierran varias
  // aristas.
  function addQuad(target, points, normal, color, uvs) {
    const coordinates = uvs || [[0, 1], [1, 1], [1, 0], [0, 0]];
    for (let index = 1; index < points.length - 1; index += 1) {
      for (const corner of [0, index, index + 1]) {
        addMeshVertex(target, points[corner], normal, color, coordinates[corner]);
      }
    }
  }

  function addLine(target, first, second, color) {
    target.push(first[0], first[1], first[2], color[0], color[1], color[2]);
    target.push(second[0], second[1], second[2], color[0], color[1], color[2]);
  }

  // Calcula la caja global del modelo y proyecta cualquier punto a UV para que una
  // textura cubra la escena completa sin repetirse por cubo.
  const AXES = ['x', 'y', 'z'];

  // Caja que ocupa el modelo en la rejilla. Se usa para repartir la textura sobre el
  // modelo entero en vez de repetirla en cada bloque.
  function modelBounds() {
    const bounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };
    for (const cube of SDD3D.app.state.cubes.values()) {
      for (const axis of AXES) {
        bounds.min[axis] = Math.min(bounds.min[axis], cube[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], cube[axis] + 1);
      }
    }
    if (!Number.isFinite(bounds.min.x)) {
      // Sin bloques no hay modelo que texturizar: se devuelve una caja unidad para no
      // repartir por cero si alguna vez se pinta una cara suelta.
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 1 }
      };
    }
    return bounds;
  }

  // Ejes de la proyección plana de una cara: los dos ejes que no son el de su normal.
  function uvAxesOf(normal) {
    const axis = AXES.reduce((best, candidate) =>
      Math.abs(normal[AXES.indexOf(candidate)]) > Math.abs(normal[AXES.indexOf(best)]) ? candidate : best, 'x');
    const remaining = AXES.filter((candidate) => candidate !== axis);
    return { axis, uAxis: remaining[0], vAxis: remaining[1] };
  }

  // Coordenada de un punto en un eje de la rejilla. Los puntos del modelo son objetos
  // `{ x, y, z }`, pero la malla arma las esquinas de cada cara como arrays
  // `[x, y, z]` (ver modules/scene/mesh.js), así que la lectura por nombre de eje tiene
  // en cuenta las dos formas. Sin esto, un punto en array devolvía `undefined` y todas
  // las coordenadas de textura salían NaN: la textura no llegaba a verse en el modelo.
  function axisValue(point, axis) {
    return Array.isArray(point) ? point[AXES.indexOf(axis)] : point[axis];
  }

  // Coordenadas de textura de un punto vistas desde la dirección de la cara. Se
  // reparten con la caja del modelo, así que el mapa de textura cubre el modelo
  // entero: agrandar el modelo estira la textura en vez de repetirla por bloque.
  function worldUv(point, axes, bounds) {
    const width = bounds.max[axes.uAxis] - bounds.min[axes.uAxis] || 1;
    const height = bounds.max[axes.vAxis] - bounds.min[axes.vAxis] || 1;
    return [
      (axisValue(point, axes.uAxis) - bounds.min[axes.uAxis]) / width,
      (axisValue(point, axes.vAxis) - bounds.min[axes.vAxis]) / height
    ];
  }

  // Publica las primitivas consumidas por la malla, la rejilla y la exportación.
  SDD3D.geometry = {
    isExposed,
    exposedCubeEdges,
    addMeshVertex,
    addQuad,
    addLine,
    modelBounds,
    uvAxesOf,
    worldUv
  };
})();
