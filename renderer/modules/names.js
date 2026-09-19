// Convierte puntos enteros entre su representación de objeto y una clave estable
// para mapas y conjuntos.
(() => {
  'use strict';

  const { SDD3D } = window;

  function keyOf(point) {
    return `${point.x},${point.y},${point.z}`;
  }

  function pointFromKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  }

  // Ordena los extremos de cada arista para que una misma conexión tenga la misma
  // identidad aunque se recorra en sentidos opuestos.
  // Clave de una arista de rejilla. Los dos extremos se ordenan para que la misma
  // arista dé la misma clave la mire el cubo que la mire: es lo que permite contar
  // una sola vez las aristas compartidas por varios cubos.
  function edgeKeyOf(first, second) {
    const firstKey = keyOf(first);
    const secondKey = keyOf(second);
    return firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
  }

  SDD3D.names = { keyOf, pointFromKey, edgeKeyOf };
})();
