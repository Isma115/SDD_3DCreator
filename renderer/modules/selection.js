// Gestiona el trazo temporal de puntos, las aristas resultantes y la creación de
// caras cuando se completa el número de vértices requerido.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { samePoint } = SDD3D.app;

  // Cambia la selección de puntos en curso. Se centraliza en la misma forma que el
  // bloque seleccionado para que el historial y la interfaz tengan un solo camino.
  function setPointPath(points) {
    SDD3D.app.state.pointPath = points;
    SDD3D.ui.updatePointSelectionUi();
    return SDD3D.app.state.pointPath;
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
    setPointPath([...state.pointPath, point]);
    if (state.pointPath.length === 4) {
      SDD3D.app.addFace(state.pointPath);
      setPointPath([]);
      SDD3D.app.setStatus('Cara creada con 4 puntos');
      return;
    }
    if (previous) {
      // Al terminar de unir dos puntos ambos quedan deseleccionados.
      SDD3D.app.addEdge(previous, point);
      setPointPath([]);
      SDD3D.app.setStatus('Puntos unidos');
      return;
    }
    SDD3D.app.setStatus('Selecciona otro punto');
  }

  function clearPointSelection() {
    const state = SDD3D.app.state;
    if (state.pointPath.length === 0) return;
    setPointPath([]);
    SDD3D.app.setStatus('Puntos deseleccionados');
  }

  // Expone la selección por doble click, el borrado del trazo y la restauración que
  // utiliza el historial.
  SDD3D.selection = { selectPoint, clearPointSelection, setPointPath };
})();
