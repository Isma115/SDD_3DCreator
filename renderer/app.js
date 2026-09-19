// Punto de entrada del renderer: arranca el bucle de dibujo y enlaza los eventos.
(() => {
  'use strict';

  const { SDD3D } = window;

  // El modelo se inicializa antes de arrancar el dibujo: la aplicación abre
  // siempre con el bloque central ya presente en el primer fotograma.
  SDD3D.app.init();
  // El historial arranca después: el bloque central es el estado de partida, no
  // una acción que se pueda deshacer.
  SDD3D.history.init();
  SDD3D.ui.init();
  SDD3D.input.init();

  SDD3D.app.updateCountStatus();
  SDD3D.renderer.start();
})();
