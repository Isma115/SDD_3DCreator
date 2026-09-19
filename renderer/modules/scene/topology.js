// #region Deducción de caras topológicas
// Reconstruye caras planas y convexas a partir de las aristas dibujadas y de la
// superficie expuesta de los cubos, sin almacenarlas como estado independiente.
//
// Una cara no se guarda en el modelo: se deduce de las aristas cada vez que hace
// falta dibujar o exportar, de modo que al deshacer una unión la cara desaparece
// sola y el historial no necesita conocerla.
//
// El cálculo se hace sobre las casillas de la superficie del modelo, agrupadas por
// plano. Las casillas de un plano son las caras unidad de cubo que miran en un mismo
// sentido, y las aristas dibujadas las separan en zonas: una zona es una cara cuando
// queda cerrada por completo (no se puede salir de ella sin cruzar una arista) y su
// frontera es un ciclo simple. Los contornos abiertos, las zonas que se escapan del
// plano y los contornos no convexos se descartan en lugar de inventar una cara.
(() => {
  'use strict';

  const { SDD3D } = window;

  // #region Coordenadas y claves de planos
  // Traduce entre ejes del espacio 3D y coordenadas locales de cada plano, y crea
  // claves estables para lados y aristas compartidas.
  const GRID_AXES = ['x', 'y', 'z'];
  // Las dos caras de cada eje: la negativa y la positiva.
  const AXIS_SIGNS = [-1, 1];
  // Los cuatro lados de una casilla, en el mismo orden antihorario que las esquinas
  // de las caras del cubo unidad.
  const SIDES = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  function gridAxesOf(axis) {
    return { axis, uAxis: (axis + 1) % 3, vAxis: (axis + 2) % 3 };
  }

  function pointAt(axes, layer, u, v) {
    const point = { x: 0, y: 0, z: 0 };
    point[GRID_AXES[axes.axis]] = layer;
    point[GRID_AXES[axes.uAxis]] = u;
    point[GRID_AXES[axes.vAxis]] = v;
    return point;
  }

  // Clave de un lado de casilla: su esquina de menor (u, v) y la dirección que
  // recorre. Dos casillas contiguas del mismo plano comparten la misma clave.
  function sideKey(u, v, du, dv) {
    return `${u + Math.min(du, 0)},${v + Math.min(dv, 0)},${du !== 0 ? 'u' : 'v'}`;
  }

  function sideEdgeKey(axes, layer, key) {
    const [u, v, direction] = key.split(',');
    const start = pointAt(axes, layer, Number(u), Number(v));
    const end = direction === 'u'
      ? pointAt(axes, layer, Number(u) + 1, Number(v))
      : pointAt(axes, layer, Number(u), Number(v) + 1);
    return SDD3D.names.edgeKeyOf(start, end);
  }

  // #endregion Coordenadas y claves de planos
  // #region Aristas por plano y superficie
  // Agrupa las aristas por plano y filtra las casillas que realmente pertenecen a
  // la superficie visible del modelo.
  // Aristas dibujadas de cada plano. Un plano es el hueco entre dos capas de rejilla
  // visto en un sentido: las casillas de normal positiva son las que quedan por
  // debajo del hueco y las de normal negativa las que quedan por encima. Una arista
  // va en el hueco que hay por encima de su capa y en el que hay por debajo, así que
  // cuenta en los dos planos.
  function drawnEdgesByPlane(state) {
    const byPlane = new Map();
    for (const edge of state.edges) {
      const first = edge[0];
      const second = edge[1];
      const along = GRID_AXES.find((axis) => first[axis] === second[axis]);
      if (!along) continue;
      const low = first[along] < second[along] ? first : second;
      const high = low === first ? second : first;
      // Los recorridos de teclado pueden unir esquinas opuestas de una cara: esas
      // diagonales no son el lado de ninguna casilla y aquí no cuentan.
      if (high[along] - low[along] !== 1) continue;
      const axis = GRID_AXES.indexOf(along);
      const axes = gridAxesOf(axis);
      const layer = low[along];
      const u = low[GRID_AXES[axes.uAxis]];
      const v = low[GRID_AXES[axes.vAxis]];
      // La arista recorre el eje u del plano cuando su eje de rejilla es ese mismo u.
      const key = axis === axes.uAxis ? `${u},${v},u` : `${u},${v},v`;
      for (const sign of AXIS_SIGNS) {
        const planeKey = `${axis}|${layer + (sign > 0 ? -1 : 0)}|${sign}`;
        if (!byPlane.has(planeKey)) byPlane.set(planeKey, new Set());
        byPlane.get(planeKey).add(key);
      }
    }
    return byPlane;
  }

  // Una casilla del plano es de la superficie si el bloque que la ocupa no tiene
  // vecino en el sentido de la normal.
  function isSurfaceCell(plane, u, v) {
    const cubes = SDD3D.app.state.cubes;
    const behind = plane.layer;
    for (const layer of [behind, behind + 1]) {
      if (cubes.has(SDD3D.names.keyOf(pointAt(plane, layer, u, v)))) {
        const exposed = plane.sign > 0 ? behind + 1 : behind - 1;
        return !cubes.has(SDD3D.names.keyOf(pointAt(plane, exposed, u, v)));
      }
    }
    return false;
  }

  // #endregion Aristas por plano y superficie
  // #region Regiones y contornos
  // Recorre cada región cerrada y encadena sus lados para obtener un ciclo de puntos
  // candidato a cara.
  // Recorre una zona del plano: sus casillas y las aristas dibujadas de su frontera.
  // El recorrido se detiene si la zona se escapa por el borde de la superficie, que
  // es el único sitio por donde puede salir del plano.
  function collectRegion(plane, drawn, startU, startV) {
    const inside = new Set([`${startU},${startV}`]);
    const queue = [[startU, startV]];
    const boundary = new Set();
    let complete = true;
    while (queue.length) {
      const [u, v] = queue.pop();
      for (const [du, dv] of SIDES) {
        const side = sideKey(u, v, du, dv);
        if (drawn.has(side)) {
          boundary.add(side);
          continue;
        }
        const nextU = u + du;
        const nextV = v + dv;
        if (!isSurfaceCell(plane, nextU, nextV)) {
          complete = false;
          continue;
        }
        const key = `${nextU},${nextV}`;
        if (inside.has(key)) continue;
        inside.add(key);
        queue.push([nextU, nextV]);
      }
    }
    return { inside, boundary, complete };
  }

  // Encadena los lados de la frontera para formar el ciclo de la cara. Se exige que
  // cada esquina una exactamente dos lados y que el ciclo pase por ella una sola vez:
  // si no, la región se descarta.
  function orderLoop(plane, boundary) {
    const byVertex = new Map();
    for (const key of boundary) {
      for (const pointKey of sideEdgeKey(plane, plane.layer, key).split('|')) {
        if (!byVertex.has(pointKey)) byVertex.set(pointKey, []);
        byVertex.get(pointKey).push(key);
      }
    }
    for (const sides of byVertex.values()) if (sides.length !== 2) return null;
    const startKey = boundary.values().next().value;
    const startPointKey = sideEdgeKey(plane, plane.layer, startKey).split('|')[0];
    const loop = [SDD3D.names.pointFromKey(startPointKey)];
    let usedKey = startKey;
    let lastPointKey = sideEdgeKey(plane, plane.layer, startKey).split('|')[1];
    while (loop.length <= boundary.size) {
      loop.push(SDD3D.names.pointFromKey(lastPointKey));
      if (lastPointKey === startPointKey) return loop.length === boundary.size + 1 ? loop : null;
      const [firstSide, secondSide] = byVertex.get(lastPointKey);
      usedKey = firstSide === usedKey ? secondSide : firstSide;
      const ends = sideEdgeKey(plane, plane.layer, usedKey).split('|');
      lastPointKey = ends[0] === lastPointKey ? ends[1] : ends[0];
    }
    return null;
  }

  // #endregion Regiones y contornos
  // #region Validación geométrica y caras finales
  // Simplifica los contornos, comprueba orientación y convexidad, y descarta las
  // regiones abiertas o ambiguas antes de devolverlas al renderer o al exportador.
  function polygonArea(points, uAxis, vAxis) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      area += current[GRID_AXES[uAxis]] * next[GRID_AXES[vAxis]] -
        next[GRID_AXES[uAxis]] * current[GRID_AXES[vAxis]];
    }
    return area / 2;
  }

  // Las esquinas que caen en mitad de un lado recto no son esquinas de la cara: se
  // quitan de la lista, que la forma no cambia y así la comprobación de convexidad
  // mira solo los vértices que de verdad doblan.
  function smoothLoop(loop, uAxis, vAxis) {
    const smoothed = loop.filter((point, index) => {
      const previous = loop[(index - 1 + loop.length) % loop.length];
      const next = loop[(index + 1) % loop.length];
      const first = [
        point[GRID_AXES[uAxis]] - previous[GRID_AXES[uAxis]],
        point[GRID_AXES[vAxis]] - previous[GRID_AXES[vAxis]]
      ];
      const second = [
        next[GRID_AXES[uAxis]] - point[GRID_AXES[uAxis]],
        next[GRID_AXES[vAxis]] - point[GRID_AXES[vAxis]]
      ];
      return first[0] * second[1] - first[1] * second[0] !== 0;
    });
    return smoothed.length >= 3 ? smoothed : loop;
  }

  // Un ciclo solo sirve como cara si no repite esquinas y es convexo: así el abanico
  // de triángulos que lo dibuja no sale nunca por fuera de la cara.
  function isConvexLoop(loop, uAxis, vAxis) {
    if (loop.length < 4) return false;
    if (new Set(loop.map(SDD3D.names.keyOf)).size !== loop.length) return false;
    for (let index = 0; index < loop.length; index += 1) {
      const previous = loop[(index - 1 + loop.length) % loop.length];
      const current = loop[index];
      const next = loop[(index + 1) % loop.length];
      const first = [
        current[GRID_AXES[uAxis]] - previous[GRID_AXES[uAxis]],
        current[GRID_AXES[vAxis]] - previous[GRID_AXES[vAxis]]
      ];
      const second = [
        next[GRID_AXES[uAxis]] - current[GRID_AXES[uAxis]],
        next[GRID_AXES[vAxis]] - current[GRID_AXES[vAxis]]
      ];
      if (first[0] * second[1] - first[1] * second[0] <= 0) return false;
    }
    return true;
  }

  // #endregion Validación geométrica y caras finales
  // #region API de topología
  // Expone el cálculo bajo demanda de las caras deducidas.
  function boundaryFaces() {
    const state = SDD3D.app.state;
    const drawnByPlane = drawnEdgesByPlane(state);
    const faces = [];
    const visited = new Set();
    for (const [planeKey, drawn] of drawnByPlane) {
      const [axis, layer, sign] = planeKey.split('|').map(Number);
      const plane = { ...gridAxesOf(axis), layer, sign };
      for (const side of drawn) {
        const [u, v] = side.split(',').map(Number);
        if (visited.has(`${u},${v}`)) continue;
        if (!isSurfaceCell(plane, u, v)) continue;
        const region = collectRegion(plane, drawn, u, v);
        for (const key of region.inside) visited.add(key);
        if (!region.complete) continue;
        const loop = orderLoop(plane, region.boundary);
        if (!loop) continue;
        if (polygonArea(loop, plane.uAxis, plane.vAxis) <= 0) continue;
        const corners = smoothLoop(loop, plane.uAxis, plane.vAxis);
        if (!isConvexLoop(corners, plane.uAxis, plane.vAxis)) continue;
        const normal = { x: 0, y: 0, z: 0 };
        normal[GRID_AXES[axis]] = sign;
        faces.push({ normal, points: corners });
      }
    }
    return faces;
  }

  SDD3D.topology = { boundaryFaces };
})();
// #endregion API de topología
// #endregion Deducción de caras topológicas
