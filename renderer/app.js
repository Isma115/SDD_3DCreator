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
  // La configuración de interfaz se aplica cuando el DOM ya está enlazado. El fichero
  // de modelo solo se recupera mediante la acción explícita "Cargar".
  SDD3D.settings.init();
  SDD3D.modelFile.init();
  SDD3D.renderer.start();
})();
