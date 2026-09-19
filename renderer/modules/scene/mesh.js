// Construcción de la geometría de dibujo del modelo: superficies y líneas.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { addLine, addQuad, isExposed, exposedCubeEdges, modelBounds, uvAxesOf, worldUv } = SDD3D.geometry;
  const { CUBE_CORNERS, CUBE_EDGES, COLORS, cubeFaces } = SDD3D;

  // Cuadrilátero del modelo con la textura repartida por la caja del modelo entero:
  // el mismo mapa cubre todos los bloques en vez de repetirse en cada uno.
  function addWorldQuad(vertices, points, normal, color, bounds) {
    const axes = uvAxesOf(normal);
    addQuad(vertices, points, normal, color, points.map((point) => worldUv(point, axes, bounds)));
  }

  // Normal de una cara por sus puntos, en el mismo sentido que usa la exportación.
  function faceNormalOf(points) {
    const first = SDD3D.vec3.subtract(
      { x: points[1][0], y: points[1][1], z: points[1][2] },
      { x: points[0][0], y: points[0][1], z: points[0][2] }
    );
    const second = SDD3D.vec3.subtract(
      { x: points[2][0], y: points[2][1], z: points[2][2] },
      { x: points[0][0], y: points[0][1], z: points[0][2] }
    );
    const normal = SDD3D.vec3.normalize(SDD3D.vec3.cross(first, second));
    return [normal.x, normal.y, normal.z];
  }

  function signatureOf(points) {
    return points.map(SDD3D.names.keyOf).sort().join('|');
  }

  // Caras propias del modelo: las creadas al unir cuatro puntos y las que cierran las
  // aristas dibujadas (ver modules/scene/topology.js). Una cara que repite otra —por
  // ejemplo el cuadrado que cierran las cuatro aristas de unión de una cara de
  // bloque— no se dibuja dos veces.
  function modelFaces() {
    const state = SDD3D.app.state;
    const drawn = new Set();
    const faces = [];
    for (const face of state.faces) {
      drawn.add(signatureOf(face));
      faces.push({ points: face });
    }
    for (const face of SDD3D.topology.boundaryFaces()) {
      const signature = signatureOf(face.points);
      if (drawn.has(signature)) continue;
      drawn.add(signature);
      faces.push(face);
    }
    return faces;
  }

  function buildMeshVertices() {
    const state = SDD3D.app.state;
    const vertices = [];
    const bounds = modelBounds();
    for (const cube of state.cubes.values()) {
      const selected = state.selectedCube && SDD3D.app.samePoint(state.selectedCube, cube);
      const color = selected ? COLORS.selected : COLORS.cube;
      for (const face of cubeFaces) {
        if (!isExposed(cube, face.normal)) continue;
        const points = face.corners.map((corner) => [
          cube.x + corner[0], cube.y + corner[1], cube.z + corner[2]
        ]);
        addWorldQuad(vertices, points, face.normal, color, bounds);
      }
    }
    for (const face of modelFaces()) {
      const points = face.points.map((point) => [point.x, point.y, point.z]);
      const normal = face.normal || faceNormalOf(points);
      addWorldQuad(vertices, points, normal, COLORS.customFace, bounds);
    }
    return vertices;
  }

  // Líneas de unión entre puntos y trazo provisional de la selección en curso.
  function buildEdgeLines() {
    const state = SDD3D.app.state;
    const lines = [];
    for (const edge of state.edges) {
      addLine(lines,
        [edge[0].x, edge[0].y, edge[0].z],
        [edge[1].x, edge[1].y, edge[1].z],
        COLORS.edge
      );
    }
    if (state.pointPath.length > 1) {
      for (let index = 1; index < state.pointPath.length; index += 1) {
        addLine(lines,
          [state.pointPath[index - 1].x, state.pointPath[index - 1].y, state.pointPath[index - 1].z],
          [state.pointPath[index].x, state.pointPath[index].y, state.pointPath[index].z],
          COLORS.pointSelected
        );
      }
    }
    return lines;
  }

  // Vértices de los puntos de unión, coloreados según estén seleccionados o no.
  function buildPointVertices() {
    const state = SDD3D.app.state;
    const vertices = [];
    const selectedKeys = new Set(state.pointPath.map(SDD3D.names.keyOf));
    for (const point of SDD3D.app.getModelPoints()) {
      const color = selectedKeys.has(SDD3D.names.keyOf(point)) ? COLORS.pointSelected : COLORS.point;
      vertices.push(point.x, point.y, point.z, color[0], color[1], color[2]);
    }
    return vertices;
  }

  // Líneas limitantes entre cubos. Solo se trazan las aristas que están en la
  // superficie visible del modelo, así que las caras de los cubos se ven lisas y
  // sin la rejilla que formaban las aristas interiores.
  function buildCubeEdgeLines() {
    const lines = [];
    for (const edge of exposedCubeEdges()) {
      addLine(lines,
        [edge[0].x, edge[0].y, edge[0].z],
        [edge[1].x, edge[1].y, edge[1].z],
        COLORS.cubeLine
      );
    }
    return lines;
  }

  // Contorno del bloque seleccionado en modo teclado.
  function buildSelectionLines() {
    const cube = SDD3D.app.state.selectedCube;
    if (!cube) return [];
    const corners = CUBE_CORNERS.map((corner) => [
      cube.x + corner[0], cube.y + corner[1], cube.z + corner[2]
    ]);
    const lines = [];
    for (const [first, second] of CUBE_EDGES) addLine(lines, corners[first], corners[second], COLORS.selected);
    return lines;
  }

  SDD3D.mesh = {
    buildMeshVertices,
    buildEdgeLines,
    buildPointVertices,
    buildCubeEdgeLines,
    buildSelectionLines
  };
})();
