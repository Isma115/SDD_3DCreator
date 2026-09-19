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

  // Coordenada de la cara de un plano. Un plano es la cara común de dos capas de
  // rejilla, y sus casillas están en la capa siguiente a su capa inferior, tanto si
  // son las de abajo (signo positivo) como si son las de arriba (signo negativo).
  function faceCoordinate(plane) {
    return plane.layer + 1;
  }

  function pointAt(axes, coordinate, u, v) {
    const point = { x: 0, y: 0, z: 0 };
    point[GRID_AXES[axes.axis]] = coordinate;
    point[GRID_AXES[axes.uAxis]] = u;
    point[GRID_AXES[axes.vAxis]] = v;
    return point;
  }

  // Clave de un lado de casilla: su esquina de menor (u, v) y el eje que recorre. El
  // lado que cruza una casilla al avanzar en u es el que va en v, y al revés. Dos
  // casillas contiguas del mismo plano comparten la misma clave.
  function sideKey(u, v, du, dv) {
    return `${u + Math.max(du, 0)},${v + Math.max(dv, 0)},${du !== 0 ? 'v' : 'u'}`;
  }

  // Arista de rejilla del lado, en la coordenada de cara del plano.
  function sideEdgeKey(axes, coordinate, key) {
    const [u, v, direction] = key.split(',');
    const start = pointAt(axes, coordinate, Number(u), Number(v));
    const end = direction === 'u'
      ? pointAt(axes, coordinate, Number(u) + 1, Number(v))
      : pointAt(axes, coordinate, Number(u), Number(v) + 1);
    return SDD3D.names.edgeKeyOf(start, end);
  }

  // Agrupa las aristas por plano y filtra las casillas que realmente pertenecen a
  // la superficie visible del modelo.
  // Aristas dibujadas de cada plano. Una arista de rejilla es el lado de las
  // casillas de los dos planos que la contienen: los de normal los otros dos ejes.
  // En cada uno de esos planos la arista está en la cara de la capa que le da
  // coordenada, así que cuenta en las dos vistas de esa cara: la del bloque de abajo
  // (signo positivo) y la del bloque de arriba (signo negativo). Un trazo largo
  // aporta un lado por cada tramo unidad que recorre; las diagonales no son el lado
  // de ninguna casilla y no cuentan.
  function drawnEdgesByPlane(state) {
    const byPlane = new Map();
    for (const edge of state.edges) {
      const first = edge[0];
      const second = edge[1];
      const alongAxes = GRID_AXES.filter((axis) => first[axis] !== second[axis]);
      if (alongAxes.length !== 1) continue;
      const along = alongAxes[0];
      const edgeAxis = GRID_AXES.indexOf(along);
      const start = first[along] < second[along] ? first : second;
      const end = start === first ? second : first;
      for (let step = start[along]; step < end[along]; step += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
          if (axis === edgeAxis) continue;
          const planeAxes = gridAxesOf(axis);
          const layer = start[GRID_AXES[axis]] - 1;
          const key = edgeAxis === planeAxes.uAxis
            ? `${step},${start[GRID_AXES[planeAxes.vAxis]]},u`
            : `${start[GRID_AXES[planeAxes.uAxis]]},${step},v`;
          for (const sign of AXIS_SIGNS) {
            const planeKey = `${axis}|${layer}|${sign}`;
            if (!byPlane.has(planeKey)) byPlane.set(planeKey, new Set());
            byPlane.get(planeKey).add(key);
          }
        }
      }
    }
    return byPlane;
  }

  // Una casilla del plano es de la superficie si el bloque que la ocupa no tiene
  // vecino al otro lado de la cara: el de debajo en las casillas de normal positiva
  // y el de arriba en las de normal negativa.
  function isSurfaceCell(plane, u, v) {
    const cubes = SDD3D.app.state.cubes;
    const cellLayer = plane.sign > 0 ? plane.layer : plane.layer + 1;
    const neighborLayer = plane.sign > 0 ? plane.layer + 1 : plane.layer;
    if (!cubes.has(SDD3D.names.keyOf(pointAt(plane, cellLayer, u, v)))) return false;
    return !cubes.has(SDD3D.names.keyOf(pointAt(plane, neighborLayer, u, v)));
  }

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
  // si no, la región se descarta. El ciclo no repite la esquina inicial.
  function orderLoop(plane, boundary) {
    const coordinate = faceCoordinate(plane);
    const byVertex = new Map();
    for (const key of boundary) {
      for (const pointKey of sideEdgeKey(plane, coordinate, key).split('|')) {
        if (!byVertex.has(pointKey)) byVertex.set(pointKey, []);
        byVertex.get(pointKey).push(key);
      }
    }
    for (const sides of byVertex.values()) if (sides.length !== 2) return null;
    const startKey = boundary.values().next().value;
    const [startPointKey, nextPointKey] = sideEdgeKey(plane, coordinate, startKey).split('|');
    const loop = [SDD3D.names.pointFromKey(startPointKey)];
    let usedKey = startKey;
    let lastPointKey = nextPointKey;
    while (loop.length <= boundary.size) {
      if (lastPointKey === startPointKey) return loop.length === boundary.size ? loop : null;
      loop.push(SDD3D.names.pointFromKey(lastPointKey));
      const [firstSide, secondSide] = byVertex.get(lastPointKey);
      usedKey = firstSide === usedKey ? secondSide : firstSide;
      const ends = sideEdgeKey(plane, coordinate, usedKey).split('|');
      lastPointKey = ends[0] === lastPointKey ? ends[1] : ends[0];
    }
    return null;
  }

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
  // de triángulos que lo dibuja no sale nunca por fuera de la cara. El ciclo debe
  // llegar en sentido antihorario en los ejes del plano.
  function isConvexLoop(loop, uAxis, vAxis) {
    if (loop.length < 3) return false;
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

  // Expone el cálculo bajo demanda de las caras deducidas.
  function boundaryFaces() {
    const state = SDD3D.app.state;
    const drawnByPlane = drawnEdgesByPlane(state);
    const faces = [];
    for (const [planeKey, drawn] of drawnByPlane) {
      const [axis, layer, sign] = planeKey.split('|').map(Number);
      const plane = { ...gridAxesOf(axis), layer, sign };
      // Las casillas se marcan por plano: la misma coordenada local no es la misma
      // casilla en dos planos distintos.
      const visited = new Set();
      for (const side of drawn) {
        const [u, v] = side.split(',').map(Number);
        if (visited.has(`${u},${v}`)) continue;
        if (!isSurfaceCell(plane, u, v)) continue;
        const region = collectRegion(plane, drawn, u, v);
        for (const key of region.inside) visited.add(key);
        if (!region.complete) continue;
        const loop = orderLoop(plane, region.boundary);
        if (!loop) continue;
        const area = polygonArea(loop, plane.uAxis, plane.vAxis);
        if (area === 0) continue;
        // El contorno se ordena en sentido antihorario en los ejes del plano para que
        // la convexidad se mida siempre igual, y al final se invierte si la cara mira
        // al sentido negativo del eje, de modo que el bobinado de los puntos coincida
        // con la normal.
        const oriented = area > 0 ? loop : [...loop].reverse();
        const corners = smoothLoop(oriented, plane.uAxis, plane.vAxis);
        if (!isConvexLoop(corners, plane.uAxis, plane.vAxis)) continue;
        const normal = { x: 0, y: 0, z: 0 };
        normal[GRID_AXES[axis]] = sign;
        faces.push({ normal, points: sign > 0 ? corners : [...corners].reverse() });
      }
    }
    return faces;
  }

  SDD3D.topology = { boundaryFaces };
})();
