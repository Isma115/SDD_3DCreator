// Cámara orbital: posición, matrices de vista/proyección, proyección a pantalla
// y direcciones de rejilla usadas por el control de teclado.
(() => {
  'use strict';

  const { SDD3D } = window;

  function cameraPosition() {
    const { yaw, pitch, distance, target } = SDD3D.app.state.camera;
    const horizontal = Math.cos(pitch) * distance;
    return {
      x: target.x + horizontal * Math.sin(yaw),
      y: target.y + Math.sin(pitch) * distance,
      z: target.z + horizontal * Math.cos(yaw)
    };
  }

  function getViewProjection() {
    const canvas = SDD3D.dom.canvas;
    const aspect = canvas.width / Math.max(canvas.height, 1);
    const projection = SDD3D.matrices.perspective(Math.PI / 3, aspect, 0.05, SDD3D.CAMERA_FAR);
    const view = SDD3D.matrices.lookAt(cameraPosition(), SDD3D.app.state.camera.target, { x: 0, y: 1, z: 0 });
    return SDD3D.matrices.multiply(projection, view);
  }

  function screenCoordinates(clientX, clientY) {
    const canvas = SDD3D.dom.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function projectPoint(point, viewProjection) {
    const canvas = SDD3D.dom.canvas;
    const clip = SDD3D.matrices.transformVector(viewProjection, [point.x, point.y, point.z, 1]);
    if (clip[3] <= 0) return null;
    return {
      x: (clip[0] / clip[3] * 0.5 + 0.5) * canvas.width,
      y: (1 - (clip[1] / clip[3] * 0.5 + 0.5)) * canvas.height
    };
  }

  function cameraGridDirection(vector) {
    const components = [
      { axis: 'x', value: vector.x },
      { axis: 'y', value: vector.y },
      { axis: 'z', value: vector.z }
    ].sort((first, second) => Math.abs(second.value) - Math.abs(first.value));
    const dominant = components[0];
    const direction = { x: 0, y: 0, z: 0 };
    direction[dominant.axis] = Math.sign(dominant.value) || 1;
    return direction;
  }

  function cameraDirections() {
    const forward = SDD3D.vec3.normalize(SDD3D.vec3.subtract(SDD3D.app.state.camera.target, cameraPosition()));
    const right = SDD3D.vec3.normalize(SDD3D.vec3.cross(forward, { x: 0, y: 1, z: 0 }));
    const up = SDD3D.vec3.normalize(SDD3D.vec3.cross(right, forward));
    return { right, up };
  }

  SDD3D.camera = {
    position: cameraPosition,
    viewProjection: getViewProjection,
    screenCoordinates,
    projectPoint,
    gridDirection: cameraGridDirection,
    directions: cameraDirections
  };
})();
