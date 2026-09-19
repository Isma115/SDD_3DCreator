// Agrupa las operaciones escalares y geométricas mínimas que comparten la cámara,
// la selección y la construcción de normales.
(() => {
  'use strict';

  const { SDD3D } = window;

  function vec3Subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function vec3Cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  function vec3Dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function vec3Normalize(vector) {
    const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
  }

  SDD3D.vec3 = { subtract: vec3Subtract, cross: vec3Cross, dot: vec3Dot, normalize: vec3Normalize };
})();
