// #region Construcción de la rejilla 3D
// Calcula el radio visible a partir del modelo y genera las líneas del suelo y de
// los dos planos auxiliares.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { addLine } = SDD3D.geometry;

  function gridRadius() {
    let radius = SDD3D.GRID_EXTENT;
    for (const cube of SDD3D.app.state.cubes.values()) {
      radius = Math.max(radius, Math.abs(cube.x) + 3, Math.abs(cube.y) + 3, Math.abs(cube.z) + 3);
    }
    return radius;
  }

  function buildGridLines() {
    const lines = [];
    const radius = gridRadius();
    const floor = -0.003;
    for (let index = -radius; index <= radius; index += 1) {
      addLine(lines, [-radius, floor, index], [radius, floor, index], SDD3D.COLORS.grid);
      addLine(lines, [index, floor, -radius], [index, floor, radius], SDD3D.COLORS.grid);
      addLine(lines, [-radius, index, 0], [radius, index, 0], SDD3D.COLORS.grid);
      addLine(lines, [index, -radius, 0], [index, radius, 0], SDD3D.COLORS.grid);
      addLine(lines, [0, index, -radius], [0, index, radius], SDD3D.COLORS.grid);
      addLine(lines, [0, -radius, index], [0, radius, index], SDD3D.COLORS.grid);
    }
    return lines;
  }

  // #endregion Construcción de la rejilla 3D
  // #region API de rejilla
  // Expone los constructores que consume el bucle de renderizado.
  SDD3D.grid = { radius: gridRadius, buildLines: buildGridLines };
})();
// #endregion API de rejilla
