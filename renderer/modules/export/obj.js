// Exportación del modelo: fusión de caras visibles y serialización a OBJ.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { cubeFaces } = SDD3D;
  const { isExposed } = SDD3D.geometry;

  function buildExportMesh() {
    const state = SDD3D.app.state;
    const vertices = [];
    const vertexIndices = new Map();
    const faces = [];
    const faceSignatures = new Set();

    function vertexIndex(point) {
      const key = SDD3D.names.keyOf(point);
      if (!vertexIndices.has(key)) {
        vertices.push({ x: point.x, y: point.y, z: point.z });
        vertexIndices.set(key, vertices.length);
      }
      return vertexIndices.get(key);
    }

    function addExportFace(points) {
      const indices = points.map(vertexIndex);
      const signature = [...indices].sort((a, b) => a - b).join('/');
      if (!faceSignatures.has(signature)) {
        faceSignatures.add(signature);
        faces.push(indices);
      }
    }

    for (const cube of state.cubes.values()) {
      for (const face of cubeFaces) {
        if (!isExposed(cube, face.normal)) continue;
        addExportFace(face.corners.map((corner) => ({
          x: cube.x + corner[0],
          y: cube.y + corner[1],
          z: cube.z + corner[2]
        })));
      }
    }
    for (const face of state.faces) addExportFace(face);
    return { vertices, faces };
  }

  // Cifras que se muestran en el aviso de exportación. "Antes" son las del modelo
  // tal y como está en la rejilla: cada bloque aporta sus 8 esquinas y sus 6 caras
  // (incluidas las que quedan ocultas entre bloques pegados). "Comprimido" son las
  // del resultado de la fusión: vértices únicos y solo caras visibles.
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
