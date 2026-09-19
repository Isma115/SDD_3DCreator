// Referencias a los nodos del DOM y contexto 2D del mapa de textura.
(() => {
  'use strict';

  const { SDD3D } = window;

  const canvas = document.getElementById('viewport');
  const textureCanvas = document.getElementById('textureCanvas');

  SDD3D.dom = {
    canvas,
    status: document.getElementById('status'),
    modeLabel: document.getElementById('modeLabel'),
    controlsMenuButton: document.getElementById('controlsMenuButton'),
    controlsMenu: document.getElementById('controlsMenu'),
    viewMenuButton: document.getElementById('viewMenuButton'),
    viewMenu: document.getElementById('viewMenu'),
    cubeLinesItem: document.getElementById('cubeLinesItem'),
    pointsButton: document.getElementById('pointsButton'),
    clearPointsButton: document.getElementById('clearPointsButton'),
    textureButton: document.getElementById('textureButton'),
    closeTextureButton: document.getElementById('closeTextureButton'),
    textureModal: document.getElementById('textureModal'),
    textureCanvas,
    textureContext: textureCanvas.getContext('2d', { willReadFrequently: true }),
    textureFile: document.getElementById('textureFile'),
    paintColor: document.getElementById('paintColor'),
    brushSize: document.getElementById('brushSize'),
    exportButton: document.getElementById('exportButton'),
    exportModal: document.getElementById('exportModal'),
    exportSummary: document.getElementById('exportSummary'),
    exportStats: document.getElementById('exportStats'),
    closeExportButton: document.getElementById('closeExportButton')
  };
})();
