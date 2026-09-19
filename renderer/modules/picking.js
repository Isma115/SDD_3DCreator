// #region Picking desde el puntero
// Convierte la posición del puntero en un rayo 3D y resuelve intersecciones con
// cubos o puntos de unión visibles.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { vec3, matrices, camera } = SDD3D;

  // #region Construcción e intersección del rayo
  // Reconstruye un rayo desde la matriz inversa de cámara y aplica el algoritmo de
  // intersección por intervalos para cada cubo unidad.
  function screenRay(clientX, clientY) {
    const canvas = SDD3D.dom.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    const inverse = matrices.invert(camera.viewProjection());
    if (!inverse) return null;
    const near = matrices.transformVector(inverse, [x, y, -1, 1]);
    const far = matrices.transformVector(inverse, [x, y, 1, 1]);
    const nearPoint = {
      x: near[0] / near[3],
      y: near[1] / near[3],
      z: near[2] / near[3]
    };
    const farPoint = {
      x: far[0] / far[3],
      y: far[1] / far[3],
      z: far[2] / far[3]
    };
    return {
      origin: nearPoint,
      direction: vec3.normalize(vec3.subtract(farPoint, nearPoint))
    };
  }

  function rayBoxIntersection(ray, point) {
    const min = point;
    const max = { x: point.x + 1, y: point.y + 1, z: point.z + 1 };
    let nearDistance = -Infinity;
    let farDistance = Infinity;
    let nearNormal = { x: 0, y: 0, z: 0 };
    const axes = ['x', 'y', 'z'];

    for (const axis of axes) {
      const origin = ray.origin[axis];
      const direction = ray.direction[axis];
      if (Math.abs(direction) < 0.000001) {
        if (origin < min[axis] || origin > max[axis]) return null;
        continue;
      }
      let first = (min[axis] - origin) / direction;
      let second = (max[axis] - origin) / direction;
      let normalSign = -1;
      if (first > second) {
        [first, second] = [second, first];
        normalSign = 1;
      }
      if (first > nearDistance) {
        nearDistance = first;
        nearNormal = { x: 0, y: 0, z: 0 };
        nearNormal[axis] = normalSign;
      }
      farDistance = Math.min(farDistance, second);
      if (nearDistance > farDistance) return null;
    }

    if (farDistance < 0) return null;
    return {
      distance: nearDistance < 0 ? farDistance : nearDistance,
      normal: nearDistance < 0 ? { x: 0, y: 0, z: 0 } : nearNormal
    };
  }

  // #endregion Construcción e intersección del rayo
  // #region Resolución de objetivos en pantalla
  // Elige el cubo más cercano al puntero o el punto proyectado más próximo dentro
  // del umbral visual de selección.
  function pickCube(clientX, clientY) {
    const ray = screenRay(clientX, clientY);
    if (!ray) return null;
    let hit = null;
    for (const cube of SDD3D.app.state.cubes.values()) {
      const intersection = rayBoxIntersection(ray, cube);
      if (intersection && (!hit || intersection.distance < hit.distance)) {
        hit = { cube, ...intersection };
      }
    }
    return hit;
  }

  function nearestPoint(clientX, clientY) {
    const viewProjection = camera.viewProjection();
    const screen = camera.screenCoordinates(clientX, clientY);
    const threshold = 19 * window.devicePixelRatio;
    let result = null;
    for (const point of SDD3D.app.getModelPoints()) {
      const projected = camera.projectPoint(point, viewProjection);
      if (!projected) continue;
      const distance = Math.hypot(projected.x - screen.x, projected.y - screen.y);
      if (distance <= threshold && (!result || distance < result.distance)) {
        result = { point, distance };
      }
    }
    return result && result.point;
  }

  // #endregion Resolución de objetivos en pantalla
  // #region API de picking
  // Publica las consultas usadas por los manejadores de entrada y selección.
  SDD3D.picking = { screenRay, rayBoxIntersection, pickCube, nearestPoint };
})();
// #endregion API de picking
// #endregion Picking desde el puntero
