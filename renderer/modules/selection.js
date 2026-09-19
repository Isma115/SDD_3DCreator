// Gestiona el trazo temporal de puntos, las aristas resultantes y la creación de
// caras cuando se completa el número de vértices requerido.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { samePoint } = SDD3D.app;
  // La selección visible se limpia después de cada unión de dos puntos. Esta lista
  // independiente conserva los puntos ya unidos para poder crear una cara al llegar
  // a tres o cuatro, sin dejar los puntos anteriores resaltados.
  let facePath = [];
  let pendingTriangle = null;
  let pendingTriangleCreated = false;
  const FACE_EPSILON = 1e-9;

  // Cambia la selección de puntos en curso. Se centraliza en la misma forma que el
  // bloque seleccionado para que el historial y la interfaz tengan un solo camino.
  function setPointPath(points) {
    SDD3D.app.state.pointPath = points;
    SDD3D.ui.updatePointSelectionUi();
    return SDD3D.app.state.pointPath;
  }

  function subtract(first, second) {
    return {
      x: first.x - second.x,
      y: first.y - second.y,
      z: first.z - second.z
    };
  }

  function cross(first, second) {
    return {
      x: first.y * second.z - first.z * second.y,
      y: first.z * second.x - first.x * second.z,
      z: first.x * second.y - first.y * second.x
    };
  }

  function dot(first, second) {
    return first.x * second.x + first.y * second.y + first.z * second.z;
  }

  // Ordena tres o cuatro puntos coplanares alrededor de su centro y rechaza los
  // conjuntos colineales, no coplanares o cóncavos. Así la cara no depende de que el
  // usuario recorra sus esquinas en el sentido exacto que necesita el abanico.
  function orderFacePoints(points) {
    if ((points.length !== 3 && points.length !== 4) ||
        new Set(points.map(SDD3D.names.keyOf)).size !== points.length) return null;
    const origin = points[0];
    let normal = null;
    for (let firstIndex = 1; firstIndex < points.length && !normal; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < points.length; secondIndex += 1) {
        const candidate = cross(
          subtract(points[firstIndex], origin),
          subtract(points[secondIndex], origin)
        );
        if (dot(candidate, candidate) > FACE_EPSILON) {
          normal = candidate;
          break;
        }
      }
    }
    if (!normal) return null;
    for (const point of points.slice(1)) {
      if (Math.abs(dot(normal, subtract(point, origin))) > FACE_EPSILON) return null;
    }

    const axes = ['x', 'y', 'z'];
    const droppedAxis = axes.reduce((best, axis) =>
      Math.abs(normal[axis]) > Math.abs(normal[best]) ? axis : best, 'x');
    const projectedAxes = axes.filter((axis) => axis !== droppedAxis);
    const center = projectedAxes.map((axis) =>
      points.reduce((sum, point) => sum + point[axis], 0) / points.length
    );
    const ordered = [...points].sort((first, second) => {
      const firstAngle = Math.atan2(first[projectedAxes[1]] - center[1], first[projectedAxes[0]] - center[0]);
      const secondAngle = Math.atan2(second[projectedAxes[1]] - center[1], second[projectedAxes[0]] - center[0]);
      return firstAngle - secondAngle;
    });

    let orientation = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      const previous = ordered[(index - 1 + ordered.length) % ordered.length];
      const current = ordered[index];
      const next = ordered[(index + 1) % ordered.length];
      const firstU = current[projectedAxes[0]] - previous[projectedAxes[0]];
      const firstV = current[projectedAxes[1]] - previous[projectedAxes[1]];
      const secondU = next[projectedAxes[0]] - current[projectedAxes[0]];
      const secondV = next[projectedAxes[1]] - current[projectedAxes[1]];
      const turn = firstU * secondV - firstV * secondU;
      if (Math.abs(turn) <= FACE_EPSILON) return null;
      if (orientation === 0) orientation = Math.sign(turn);
      else if (orientation !== Math.sign(turn)) return null;
    }
    return ordered;
  }

  function rememberFacePoint(point) {
    if (!facePath.some((item) => samePoint(item, point))) facePath.push({ ...point });
  }

  function resetFacePath() {
    facePath = [];
    pendingTriangle = null;
    pendingTriangleCreated = false;
  }

  function hasFacePath() {
    return facePath.length > 0;
  }

  // Intenta crear una cara al llegar a tres puntos. El triángulo se conserva como
  // provisional durante la siguiente selección: si llega un cuarto punto válido se
  // sustituye por el cuadrilátero, de modo que siguen funcionando ambos tamaños sin
  // introducir una espera en la interfaz.
  function completeFaceIfReady() {
    if (facePath.length < 3) return false;
    const points = orderFacePoints(facePath);
    if (facePath.length === 3) {
      if (!points) {
        SDD3D.app.setStatus('Los 3 puntos están alineados');
        return true;
      }
      facePath = points.map((point) => ({ ...point }));
      pendingTriangle = facePath.map((point) => ({ ...point }));
      pendingTriangleCreated = SDD3D.app.addFace(points);
      setPointPath([]);
      SDD3D.app.setStatus(pendingTriangleCreated ? 'Cara creada con 3 puntos' : 'La cara ya existe');
      return true;
    }
    const triangle = pendingTriangle;
    const triangleCreated = pendingTriangleCreated;
    resetFacePath();
    setPointPath([]);
    if (!points) {
      if (triangleCreated) SDD3D.app.removeFace(triangle);
      SDD3D.app.setStatus('Los 4 puntos no forman una cara');
      return true;
    }
    if (triangleCreated && SDD3D.app.replaceFace(triangle, points)) {
      SDD3D.app.setStatus('Cara creada con 4 puntos');
    } else if (SDD3D.app.addFace(points)) {
      SDD3D.app.setStatus('Cara creada con 4 puntos');
    } else {
      SDD3D.app.setStatus('La cara ya existe');
    }
    return true;
  }

  function selectPoint(event) {
    const point = SDD3D.picking.nearestPoint(event.clientX, event.clientY);
    if (!point) {
      SDD3D.app.setStatus('Apunta a un punto de unión');
      return;
    }
    const state = SDD3D.app.state;
    if (state.pointPath.some((item) => samePoint(item, point))) {
      SDD3D.app.setStatus('El punto ya está en la selección');
      return;
    }
    const previous = state.pointPath[state.pointPath.length - 1];
    rememberFacePoint(point);
    if (previous) {
      // Al terminar de unir dos puntos ambos quedan deseleccionados. Se limpia antes
      // de guardar la arista para que el historial conserve el estado visible final.
      setPointPath([]);
      SDD3D.app.addEdge(previous, point);
    } else {
      setPointPath([point]);
    }
    if (completeFaceIfReady()) return;
    if (previous) {
      SDD3D.app.setStatus('Puntos unidos');
      return;
    }
    SDD3D.app.setStatus('Selecciona otro punto');
  }

  function clearPointSelection() {
    const state = SDD3D.app.state;
    if (state.pointPath.length === 0 && facePath.length === 0) return;
    resetFacePath();
    setPointPath([]);
    SDD3D.app.setStatus('Puntos deseleccionados');
  }

  // Expone la selección por doble click, el borrado del trazo y la restauración que
  // utiliza el historial.
  SDD3D.selection = {
    selectPoint,
    clearPointSelection,
    setPointPath,
    resetFacePath,
    hasFacePath
  };
})();
