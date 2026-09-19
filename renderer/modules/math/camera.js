// #region Cámara orbital y proyección
// Calcula la posición de la cámara, su matriz combinada y las conversiones entre
// coordenadas del puntero y del mundo 3D.
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
    const projection = SDD3D.matrices.perspective(SDD3D.CAMERA_FOV, aspect, 0.05, SDD3D.CAMERA_FAR);
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

  // #endregion Cámara orbital y proyección
  // #region Direcciones y desplazamiento de cámara
  // Obtiene ejes alineados con la vista para el control WASD y el desplazamiento
  // lateral que mantiene el modelo bajo el puntero durante un paneo.
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

  // Desplaza la cámara en el plano de la pantalla, sin girarla: mueve a la vez la
  // posición y el centro de la órbita, así que el modelo se desliza con el puntero en
  // lugar de rotar. El desplazamiento por píxel se calcula con la distancia y el campo
  // de visión, de modo que un píxel arrastrado mueve el modelo un píxel en pantalla en
  // el plano del centro de la órbita (lo que el arrastre agarra), a cualquier zoom.
  function panCamera(deltaX, deltaY) {
    const state = SDD3D.app.state;
    const rect = SDD3D.dom.canvas.getBoundingClientRect();
    const height = rect.height || SDD3D.dom.canvas.height;
    const perPixel = (2 * state.camera.distance * Math.tan(SDD3D.CAMERA_FOV / 2) / height)
      * SDD3D.PAN_SENSITIVITY;
    const { right, up } = cameraDirections();
    const target = state.camera.target;
    const horizontal = deltaX * perPixel;
    const vertical = deltaY * perPixel;
    // El modelo sigue al puntero: al arrastrar a la derecha el modelo se desplaza a la
    // derecha, así que la cámara va al lado contrario; al arrastrar hacia abajo el
    // modelo baja y la cámara sube.
    target.x += up.x * vertical - right.x * horizontal;
    target.y += up.y * vertical - right.y * horizontal;
    target.z += up.z * vertical - right.z * horizontal;
  }

  // #endregion Direcciones y desplazamiento de cámara
  // #region API de cámara
  // Publica las operaciones usadas por selección, entrada y renderizado.
  SDD3D.camera = {
    position: cameraPosition,
    viewProjection: getViewProjection,
    screenCoordinates,
    projectPoint,
    gridDirection: cameraGridDirection,
    directions: cameraDirections,
    pan: panCamera
  };
})();
// #endregion API de cámara
