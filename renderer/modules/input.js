// Entrada del usuario sobre el lienzo 3D: órbita con click izquierdo, colocación
// y borrado de bloques, selección de puntos, zoom y atajos de teclado.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { dom } = SDD3D;
  const { camera } = SDD3D;

  // Coloca un bloque en la dirección de la cámara a partir del bloque seleccionado.
  // Tras colocar, el bloque de partida pasa a ser el bloque nuevo: así se pueden
  // encadenar bloques con WASD sin tener que volver a seleccionar un bloque a mano.
  function keyboardPlace(key) {
    const state = SDD3D.app.state;
    if (state.mode !== 'keyboard') return;
    if (!state.selectedCube) {
      // La aplicación ya abre con el bloque central, así que este caso solo se da
      // si el usuario ha borrado todos los bloques durante la sesión: la primera
      // tecla vuelve a crear el cubo central y lo deja seleccionado para seguir.
      if (state.cubes.size > 0) {
        SDD3D.app.setStatus('Selecciona un bloque');
        return;
      }
      const origin = { x: 0, y: 0, z: 0 };
      if (!SDD3D.app.addCube(origin)) return;
      SDD3D.app.setSelectedCube(origin);
      SDD3D.app.setStatus(`Bloque colocado: ${key.toUpperCase()}`);
      return;
    }
    const directions = camera.directions();
    const right = camera.gridDirection(directions.right);
    const up = camera.gridDirection(directions.up);
    const directionByKey = {
      w: up,
      s: { x: -up.x, y: -up.y, z: -up.z },
      a: { x: -right.x, y: -right.y, z: -right.z },
      d: right
    };
    const offset = directionByKey[key];
    if (!offset) return;
    const point = {
      x: state.selectedCube.x + offset.x,
      y: state.selectedCube.y + offset.y,
      z: state.selectedCube.z + offset.z
    };
    // Si en esa casilla ya hay un bloque no se coloca uno nuevo: ese bloque pasa a ser
    // el punto de partida, de modo que se puede seguir añadiendo desde él.
    const occupied = SDD3D.app.cubeAt(point);
    if (occupied) {
      SDD3D.app.setSelectedCube(occupied);
      SDD3D.app.setStatus('Ese espacio ya está ocupado: bloque seleccionado');
      return;
    }
    // Colocar y mover el punto de partida cuentan como una sola acción: el bloque
    // nuevo pasa a ser el origen desde el que seguir encadenando con WASD.
    const placed = SDD3D.history.runAsOneChange(() => {
      if (!SDD3D.app.addCube(point)) return false;
      SDD3D.app.setSelectedCube(point);
      return true;
    });
    // Si la casilla se ha ocupado entre medias addCube ya ha avisado y la selección se
    // queda donde estaba.
    if (!placed) return;
    SDD3D.app.setStatus(`Bloque colocado: ${key.toUpperCase()}`);
  }

  // Un click sin arrastre elimina (modo Mouse) o selecciona (modo Teclado) el bloque
  // apuntado. Se retrasa para no dispararse al inicio de un doble click de puntos.
  function scheduleCanvasClick(event) {
    if (SDD3D.app.state.pointer?.moved) return;
    clearTimeout(scheduleCanvasClick.timer);
    scheduleCanvasClick.timer = setTimeout(() => {
      const hit = SDD3D.picking.pickCube(event.clientX, event.clientY);
      if (!hit) return;
      if (SDD3D.app.state.mode === 'keyboard') {
        SDD3D.app.setSelectedCube(hit.cube);
        SDD3D.app.setStatus('Bloque seleccionado');
      } else if (SDD3D.app.removeCube(hit.cube)) {
        SDD3D.app.setStatus('Bloque eliminado');
      }
    }, 220);
  }

  function init() {
    const state = SDD3D.app.state;
    const canvas = dom.canvas;

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      const orbit = event.button === 0 || (event.button === 2 && event.shiftKey);
      state.pointer = {
        id: event.pointerId,
        button: event.button,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        orbit
      };
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!state.pointer || state.pointer.id !== event.pointerId) return;
      const deltaX = event.clientX - state.pointer.x;
      const deltaY = event.clientY - state.pointer.y;
      if (Math.hypot(deltaX, deltaY) > SDD3D.CLICK_THRESHOLD) state.pointer.moved = true;
      // La cámara solo gira cuando el arrastre supera el umbral de click, para que
      // un click izquierdo sobre un bloque siga eliminándolo o seleccionándolo.
      if (state.pointer.orbit && state.pointer.moved) {
        state.camera.yaw -= deltaX * SDD3D.ORBIT_SENSITIVITY;
        // Arrastre vertical invertido: subir el puntero sube la cámara y bajarlo la baja.
        state.camera.pitch = Math.max(-1.35, Math.min(1.35, state.camera.pitch + deltaY * SDD3D.ORBIT_SENSITIVITY));
        state.pointer.x = event.clientX;
        state.pointer.y = event.clientY;
      }
    });

    canvas.addEventListener('pointerup', (event) => {
      if (!state.pointer || state.pointer.id !== event.pointerId) return;
      const pointer = state.pointer;
      state.pointer = null;
      // Un arrastre movió la cámara y un click cambió el modelo: las dos cosas forman
      // parte de la configuración que se guarda.
      SDD3D.settings.scheduleSave();
      // Arrastrar con el click izquierdo mueve la cámara; solo un click sin arrastre
      // elimina (modo Mouse) o selecciona (modo Teclado) el bloque apuntado.
      if (pointer.moved) return;
      if (pointer.button === 0) scheduleCanvasClick(event);
      if (pointer.button === 2 && !pointer.orbit) {
        const hit = SDD3D.picking.pickCube(event.clientX, event.clientY);
        if (!hit) return;
        const adjacent = {
          x: hit.cube.x + hit.normal.x,
          y: hit.cube.y + hit.normal.y,
          z: hit.cube.z + hit.normal.z
        };
        if (SDD3D.app.addCube(adjacent)) SDD3D.app.setStatus('Bloque colocado');
      }
    });

    canvas.addEventListener('pointercancel', () => {
      state.pointer = null;
    });

    canvas.addEventListener('dblclick', (event) => {
      clearTimeout(scheduleCanvasClick.timer);
      if (!state.pointsVisible) return;
      SDD3D.selection.selectPoint(event);
      // Unir puntos puede crear una cara, y las caras forman parte de lo que se
      // guarda entre sesiones.
      SDD3D.settings.scheduleSave();
    });

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      state.camera.distance = Math.max(2.5, Math.min(50, state.camera.distance * Math.exp(event.deltaY * 0.001)));
      SDD3D.settings.scheduleSave();
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
      // Los atajos de historial tienen prioridad: funcionan en los dos controles y
      // también con el aviso de exportación abierto. Ctrl+Mayús+Z se acepta como
      // rehacer además de Ctrl+Y.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        SDD3D.history.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        SDD3D.history.redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        SDD3D.history.redo();
        return;
      }
      if (event.key === 'Escape' && !dom.textureModal.hidden) {
        SDD3D.ui.closeTextureModal();
        return;
      }
      if (event.key === 'Escape' && !dom.exportModal.hidden) {
        SDD3D.ui.closeExportModal();
        return;
      }
      const modalOpen = !dom.textureModal.hidden || !dom.exportModal.hidden;
      if (!modalOpen && state.mode === 'keyboard' && ['w', 'a', 's', 'd'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        keyboardPlace(event.key.toLowerCase());
        SDD3D.settings.scheduleSave();
      }
    });
  }

  SDD3D.input = { init, keyboardPlace };
})();
