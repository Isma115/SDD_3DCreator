// Interfaz: menús desplegables, botones de la barra, mapa de textura y cierre de menús.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { dom } = SDD3D;

  function switchMode(mode) {
    const state = SDD3D.app.state;
    state.mode = mode;
    SDD3D.app.setSelectedCube(null);
    dom.modeLabel.textContent = mode === 'keyboard' ? 'Teclado' : 'Mouse';
    dom.controlsMenu.hidden = true;
    dom.controlsMenuButton.setAttribute('aria-expanded', 'false');
    dom.canvas.style.cursor = mode === 'keyboard' ? 'pointer' : 'crosshair';
    if (mode === 'keyboard' && state.cubes.size === 0) {
      // Sin cubos todavía: la primera tecla WASD crea el cubo central.
      SDD3D.app.setStatus('Pulsa WASD para crear el cubo central');
    } else {
      SDD3D.app.setStatus(mode === 'keyboard' ? 'Selecciona un bloque' : 'Mouse activo');
    }
    SDD3D.settings.scheduleSave();
  }

  function toggleControlsMenu() {
    dom.controlsMenu.hidden = !dom.controlsMenu.hidden;
    dom.controlsMenuButton.setAttribute('aria-expanded', String(!dom.controlsMenu.hidden));
  }

  function toggleViewMenu() {
    dom.viewMenu.hidden = !dom.viewMenu.hidden;
    dom.viewMenuButton.setAttribute('aria-expanded', String(!dom.viewMenu.hidden));
  }

  // Opciones del menú "Ver". Solo las líneas limitantes entre cubos.
  function toggleCubeLines() {
    const state = SDD3D.app.state;
    state.showCubeLines = !state.showCubeLines;
    dom.cubeLinesItem.setAttribute('aria-pressed', String(state.showCubeLines));
    SDD3D.app.setStatus(state.showCubeLines ? 'Líneas de cubos visibles' : 'Líneas de cubos ocultas');
    SDD3D.settings.scheduleSave();
  }

  function togglePoints() {
    const state = SDD3D.app.state;
    state.pointsVisible = !state.pointsVisible;
    dom.pointsButton.setAttribute('aria-pressed', String(state.pointsVisible));
    dom.pointsButton.textContent = state.pointsVisible ? 'Ocultar puntos' : 'Ver puntos';
    if (!state.pointsVisible) {
      state.pointPath = [];
      updatePointSelectionUi();
    }
    SDD3D.app.setStatus(state.pointsVisible ? 'Puntos visibles' : 'Puntos ocultos');
    SDD3D.settings.scheduleSave();
  }

  // El botón de deseleccionar solo se muestra mientras haya algún punto seleccionado.
  function updatePointSelectionUi() {
    dom.clearPointsButton.hidden = SDD3D.app.state.pointPath.length === 0;
  }

  // Pone los botones de las opciones de vista en el estado que tiene el modelo. Lo usa
  // la configuración guardada al arrancar, para que lo que se ve en el menú coincida
  // con lo que se está dibujando.
  function refreshToggleStates() {
    const state = SDD3D.app.state;
    dom.cubeLinesItem.setAttribute('aria-pressed', String(state.showCubeLines));
    dom.pointsButton.setAttribute('aria-pressed', String(state.pointsVisible));
    dom.pointsButton.textContent = state.pointsVisible ? 'Ocultar puntos' : 'Ver puntos';
    updatePointSelectionUi();
  }

  function drawTextureAt(event) {
    const context = dom.textureContext;
    const canvas = dom.textureCanvas;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const size = Number(dom.brushSize.value);
    context.fillStyle = dom.paintColor.value;
    context.beginPath();
    context.arc(x, y, size / 2, 0, Math.PI * 2);
    context.fill();
    SDD3D.app.state.textureDirty = true;
  }

  function openTextureModal() {
    dom.textureModal.hidden = false;
    dom.textureCanvas.focus();
  }

  function closeTextureModal() {
    dom.textureModal.hidden = true;
    if (SDD3D.app.state.textureDirty) SDD3D.renderer.uploadTexture();
  }

  // Aviso informativo posterior a la exportación. Muestra, por cada dato, la cifra
  // resultante de la compresión y la que tenía el modelo antes de comprimirlo.
  function openExportModal(report) {
    const metrics = [
      { label: 'Vértices', compressed: report.compressed.vertices, original: report.original.vertices },
      { label: 'Caras', compressed: report.compressed.faces, original: report.original.faces },
      { label: 'Puntos', compressed: report.compressed.points, original: report.original.points }
    ];
    dom.exportSummary.textContent =
      `Se han exportado ${report.compressed.vertices} vértices, ${report.compressed.faces} caras y ` +
      `${report.compressed.points} puntos.`;
    const rows = [];
    const heading = document.createElement('dt');
    heading.className = 'stats-heading';
    heading.textContent = 'Dato';
    const compressedHeading = document.createElement('dt');
    compressedHeading.className = 'stats-heading';
    compressedHeading.textContent = 'Comprimido';
    const originalHeading = document.createElement('dt');
    originalHeading.className = 'stats-heading';
    originalHeading.textContent = 'Antes';
    rows.push(heading, compressedHeading, originalHeading);
    for (const metric of metrics) {
      const label = document.createElement('dt');
      label.textContent = metric.label;
      const compressed = document.createElement('dd');
      compressed.textContent = String(metric.compressed);
      const original = document.createElement('dd');
      original.textContent = String(metric.original);
      rows.push(label, compressed, original);
    }
    // Se reemplaza el contenido entero: el aviso puede abrirse varias veces.
    dom.exportStats.replaceChildren(...rows);
    dom.exportModal.hidden = false;
    dom.closeExportButton.focus();
  }

  function closeExportModal() {
    dom.exportModal.hidden = true;
  }

  function init() {
    dom.controlsMenuButton.addEventListener('click', toggleControlsMenu);
    dom.controlsMenu.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => switchMode(button.dataset.mode));
    });
    dom.viewMenuButton.addEventListener('click', toggleViewMenu);
    dom.cubeLinesItem.addEventListener('click', toggleCubeLines);
    dom.pointsButton.addEventListener('click', togglePoints);
    dom.clearPointsButton.addEventListener('click', SDD3D.selection.clearPointSelection);
    dom.textureButton.addEventListener('click', openTextureModal);
    dom.closeTextureButton.addEventListener('click', closeTextureModal);
    dom.textureModal.addEventListener('click', (event) => {
      if (event.target === dom.textureModal) closeTextureModal();
    });
    dom.closeExportButton.addEventListener('click', closeExportModal);
    dom.exportModal.addEventListener('click', (event) => {
      if (event.target === dom.exportModal) closeExportModal();
    });

    dom.textureCanvas.addEventListener('pointerdown', (event) => {
      dom.textureCanvas.setPointerCapture(event.pointerId);
      drawTextureAt(event);
    });
    dom.textureCanvas.addEventListener('pointermove', (event) => {
      if (dom.textureCanvas.hasPointerCapture(event.pointerId)) drawTextureAt(event);
    });
    dom.textureCanvas.addEventListener('pointerup', (event) => {
      if (dom.textureCanvas.hasPointerCapture(event.pointerId)) {
        dom.textureCanvas.releasePointerCapture(event.pointerId);
      }
    });

    dom.textureFile.addEventListener('change', () => {
      const file = dom.textureFile.files && dom.textureFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const image = new Image();
        image.addEventListener('load', () => {
          dom.textureContext.clearRect(0, 0, dom.textureCanvas.width, dom.textureCanvas.height);
          dom.textureContext.drawImage(image, 0, 0, dom.textureCanvas.width, dom.textureCanvas.height);
          SDD3D.app.state.textureDirty = true;
          SDD3D.app.setStatus('Textura importada');
        });
        image.src = String(reader.result);
      });
      reader.readAsDataURL(file);
      dom.textureFile.value = '';
    });

    dom.exportButton.addEventListener('click', SDD3D.exportObj);

    document.addEventListener('click', (event) => {
      const insideMenu = event.target.closest('.menu-wrap');
      if (!insideMenu || !insideMenu.contains(dom.controlsMenuButton)) {
        dom.controlsMenu.hidden = true;
        dom.controlsMenuButton.setAttribute('aria-expanded', 'false');
      }
      if (!insideMenu || !insideMenu.contains(dom.viewMenuButton)) {
        dom.viewMenu.hidden = true;
        dom.viewMenuButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  SDD3D.ui = {
    init,
    switchMode,
    toggleControlsMenu,
    toggleViewMenu,
    toggleCubeLines,
    togglePoints,
    updatePointSelectionUi,
    refreshToggleStates,
    openTextureModal,
    closeTextureModal,
    openExportModal,
    closeExportModal,
    drawTextureAt
  };
})();
