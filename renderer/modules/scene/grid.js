// Rejilla 3D del entorno: extensión dinámica según los cubos colocados y
// geometría de las líneas del suelo y de los planos auxiliares.
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

  SDD3D.grid = { radius: gridRadius, buildLines: buildGridLines };
})();
