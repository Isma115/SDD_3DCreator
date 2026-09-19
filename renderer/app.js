// Inicializa los subsistemas en un orden estable: modelo, historial, interfaz,
// entrada, configuración persistida y finalmente el bucle de dibujo.
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
  // La configuración guardada se aplica la última, cuando la interfaz ya está
  // enlazada: puede refrescar los botones del menú y volver a poner el modo y el
  // bloque de partida de la sesión anterior.
  SDD3D.settings.init();
  SDD3D.renderer.start();
})();
