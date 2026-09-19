// Exportación del modelo: fusión de caras visibles y coplanares y serialización a OBJ.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { cubeFaces } = SDD3D;
  const { isExposed } = SDD3D.geometry;

  const GRID_AXES = ['x', 'y', 'z'];
  // Recorridos posibles de las esquinas de un rectángulo fusionado, relativos a su
  // esquina de menor coordenada. Cuál corresponde a cada dirección de cara se calcula
  // a partir de las esquinas de la cara unidad (faceCycle), de modo que el rectángulo
  // conserva el bobinado de la cara que sustituye.
  const FORWARD_CYCLE = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const REVERSED_CYCLE = [[0, 0], [0, 1], [1, 1], [1, 0]];

  // Las esquinas de una cara unidad, proyectadas a los dos ejes de su plano, forman
  // un ciclo que pasa por la esquina menor: si desde ahí sigue por el eje u es el
  // ciclo directo y si sigue por el eje v es el inverso.
  function faceCycle(face, uAxis, vAxis) {
    const corners = face.corners.map((corner) => [corner[uAxis], corner[vAxis]]);
    const minU = Math.min(...corners.map((corner) => corner[0]));
    const minV = Math.min(...corners.map((corner) => corner[1]));
    const startIndex = corners.findIndex((corner) => corner[0] === minU && corner[1] === minV);
    const rotated = corners.slice(startIndex).concat(corners.slice(0, startIndex));
    return rotated[1][0] !== minU ? FORWARD_CYCLE : REVERSED_CYCLE;
  }

  function buildExportMesh() {
    const state = SDD3D.app.state;
    const vertices = [];
    const vertexIndices = new Map();
    const faces = [];
    const faceSignatures = new Set();

    // Huella de una cara por las coordenadas de sus puntos: dos caras con los mismos
    // puntos son la misma cara, como en model.addFace, con independencia del orden.
    const signatureOfPoints = SDD3D.app.faceSignature;

    // Todo cuadrado unidad de la superficie: las caras de bloque que la exportación ya
    // emite y las caras propias que el modelo ya tiene. Una cara deducida de las
    // aristas que coincida con uno de ellos repetiría geometría ya exportada.
    const coveredSignatures = new Set();

    // Marca las seis caras unidad del bloque de la esquina indicada. Son las caras
    // que aporta un bloque a la superficie, estén expuestas o no: una cara deducida de
    // las aristas que encaje en una de ellas no añade nada a la forma del modelo, ya
    // sea porque la exportación la emite entera o porque la fusiona en un rectángulo
    // mayor.
    function addUnitSignatures(corner) {
      for (const face of cubeFaces) {
        coveredSignatures.add(signatureOfPoints(face.corners.map((unit) => ({
          x: corner.x + unit[0],
          y: corner.y + unit[1],
          z: corner.z + unit[2]
        }))));
      }
    }

    function vertexIndex(point) {
      const key = SDD3D.names.keyOf(point);
      if (!vertexIndices.has(key)) {
        vertices.push({ x: point.x, y: point.y, z: point.z });
        vertexIndices.set(key, vertices.length);
      }
      return vertexIndices.get(key);
    }

    function addExportFace(points, skippedSignatures) {
      const signature = signatureOfPoints(points);
      if (faceSignatures.has(signature) || (skippedSignatures && skippedSignatures.has(signature))) return;
      faceSignatures.add(signature);
      faces.push(points.map(vertexIndex));
    }

    // Caras que cierran las aristas dibujadas al unir puntos. Se calculan igual que
    // para el dibujo (ver modules/scene/topology.js), de modo que lo que se ve en el
    // modelo 3D es lo que sale en el fichero, y se saltan las que repiten geometría
    // que la exportación ya incluye.
    function addBoundaryFaces() {
      for (const face of SDD3D.topology.boundaryFaces()) {
        const signature = signatureOfPoints(face.points);
        if (coveredSignatures.has(signature)) continue;
        addExportFace(face.points);
      }
    }

    // Agrupa las caras unidad expuestas en planos (misma dirección, sentido y
    // coordenada en el eje de la normal) y fusiona en cada plano las casillas
    // contiguas en rectángulos mayores: dos cubos pegados dejan de aportar dos caras
    // y pasan a aportar la una que las cubre, con solo sus cuatro vértices. La forma
    // no cambia: cada grupo de caras coplanares contiguas se sustituye por el
    // rectángulo que las contiene exactamente.
    function addMergedCubeFaces() {
      const planes = new Map();
      for (const cube of state.cubes.values()) {
        // La superficie del bloque se marca antes de fusionar: es la que descarta
        // luego las caras propias que coincidan con ella.
        addUnitSignatures(cube);
        for (const face of cubeFaces) {
          if (!isExposed(cube, face.normal)) continue;
          const axis = face.normal.findIndex((value) => value !== 0);
          const uAxis = (axis + 1) % 3;
          const vAxis = (axis + 2) % 3;
          const plane = cube[GRID_AXES[axis]] + Math.max(face.normal[axis], 0);
          const planeKey = `${axis}|${face.normal[axis]}|${plane}`;
          if (!planes.has(planeKey)) {
            planes.set(planeKey, {
              axis, uAxis, vAxis, plane,
              cycle: faceCycle(face, uAxis, vAxis),
              cells: new Set()
            });
          }
          planes.get(planeKey).cells.add(`${cube[GRID_AXES[uAxis]]},${cube[GRID_AXES[vAxis]]}`);
        }
      }
      for (const group of planes.values()) mergePlane(group);
    }

    // Fusión ávida en un plano: desde cada casilla libre crece el rectángulo todo lo
    // que puede a lo largo de u y después todo lo que puede a lo largo de v. No es
    // la partición mínima posible, pero nunca solapa rectángulos ni deja una casilla
    // del plano sin cubrir.
    function mergePlane(group) {
      const used = new Set();
      const cellKey = (u, v) => `${u},${v}`;
      const isFree = (u, v) => group.cells.has(cellKey(u, v)) && !used.has(cellKey(u, v));
      for (const cell of group.cells) {
        if (used.has(cell)) continue;
        const [u0, v0] = cell.split(',').map(Number);
        let width = 1;
        while (isFree(u0 + width, v0)) width++;
        let height = 1;
        let canGrow = true;
        while (canGrow) {
          for (let index = 0; index < width; index++) {
            if (!isFree(u0 + index, v0 + height)) {
              canGrow = false;
              break;
            }
          }
          if (canGrow) height++;
        }
        for (let du = 0; du < width; du++) {
          for (let dv = 0; dv < height; dv++) used.add(cellKey(u0 + du, v0 + dv));
        }
        addExportFace(group.cycle.map(([du, dv]) => {
          const point = { x: 0, y: 0, z: 0 };
          point[GRID_AXES[group.axis]] = group.plane;
          point[GRID_AXES[group.uAxis]] = u0 + du * width;
          point[GRID_AXES[group.vAxis]] = v0 + dv * height;
          return point;
        }));
      }
    }

    addMergedCubeFaces();
    for (const face of state.faces) addExportFace(face, coveredSignatures);
    addBoundaryFaces();
    return { vertices, faces };
  }

  // Cifras que se muestran en el aviso de exportación. "Antes" son las del modelo
  // tal y como está en la rejilla: cada bloque aporta sus 8 esquinas y sus 6 caras
  // (incluidas las que quedan ocultas entre bloques pegados). "Comprimido" son las
  // del resultado de la fusión: vértices únicos, solo caras visibles y caras
  // coplanares contiguas fusionadas en rectángulos.
  function buildCompressionReport(mesh) {
    const cubeCount = SDD3D.app.state.cubes.size;
    return {
      original: {
        vertices: cubeCount * 8,
        faces: cubeCount * 6,
        points: SDD3D.app.getModelPoints().length
      },
      compressed: {
        vertices: mesh.vertices.length,
        faces: mesh.faces.length,
        points: SDD3D.app.getModelPoints().length
      }
    };
  }

  function exportObj() {
    const mesh = buildExportMesh();
    const lines = [
      '# SDD 3D Creator',
      `# ${mesh.vertices.length} vertices, ${mesh.faces.length} faces`
    ];
    for (const vertex of mesh.vertices) lines.push(`v ${vertex.x} ${vertex.y} ${vertex.z}`);
    for (const face of mesh.faces) lines.push(`f ${face.join(' ')}`);
    const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo.obj';
    link.click();
    URL.revokeObjectURL(link.href);
    SDD3D.app.setStatus(`Exportado: ${mesh.vertices.length} vértices · ${mesh.faces.length} caras`);
    // El aviso con las cifras de la compresión lo muestra la interfaz: la
    // exportación solo calcula y devuelve el informe para no depender del DOM.
    const report = buildCompressionReport(mesh);
    SDD3D.ui.openExportModal(report);
    return report;
  }

  SDD3D.exportObj = exportObj;
  SDD3D.buildExportMesh = buildExportMesh;
})();
