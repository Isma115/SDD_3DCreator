// #region Inicialización de WebGL
// Obtiene el contexto de dibujo y deja un renderer vacío cuando el navegador no
// ofrece WebGL, para que el arranque de la aplicación siga siendo seguro.
(() => {
  'use strict';

  const { SDD3D } = window;
  const { dom } = SDD3D;
  const { camera, mesh } = SDD3D;

  const gl = dom.canvas.getContext('webgl', { antialias: true, alpha: false });

  if (!gl) {
    // Sin WebGL no hay nada que dibujar: se avisa y se dejan no-ops para que el
    // arranque de la aplicación no falle al pedir el bucle de dibujo.
    dom.status.textContent = 'WebGL no disponible';
    SDD3D.renderer = {
      start() {},
      render() {},
      resizeCanvas() {},
      uploadTexture() {}
    };
    return;
  }

  SDD3D.gl = gl;

  // #endregion Inicialización de WebGL
  // #region Shaders, programas y buffers
  // Compila los programas de superficies y líneas y resuelve sus atributos y
  // uniformes para poder reutilizarlos en todos los fotogramas.
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'No se pudo compilar el shader WebGL');
    }
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'No se pudo crear el programa WebGL');
    }
    return program;
  }

  const meshProgram = createProgram(
    `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec3 aColor;
      attribute vec2 aUv;
      uniform mat4 uViewProjection;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec2 vUv;
      void main() {
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
        vNormal = aNormal;
        vColor = aColor;
        vUv = aUv;
      }
    `,
    `
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform bool uUseTexture;
      void main() {
        vec3 lightDirection = normalize(vec3(0.45, 0.8, 0.55));
        float light = 0.45 + 0.55 * max(dot(normalize(vNormal), lightDirection), 0.0);
        vec3 textureColor = uUseTexture ? texture2D(uTexture, vUv).rgb : vec3(1.0);
        gl_FragColor = vec4(vColor * textureColor * light, 1.0);
      }
    `
  );

  const lineProgram = createProgram(
    `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      uniform mat4 uViewProjection;
      uniform float uPointSize;
      varying vec3 vColor;
      void main() {
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
        gl_PointSize = uPointSize;
        vColor = aColor;
      }
    `,
    `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `
  );

  // La rejilla es un patrón analítico: el fragmento decide si está sobre una línea a
  // partir de su posición de mundo, así que el trazo se mide en píxeles (fwidth) y no
  // se acumula por muchas líneas que caigan en el mismo píxel. La rejilla fina se apaga
  // cuando sus líneas se juntan más de unos pocos píxeles y deja paso a la gruesa; más
  // lejos, el fundido por distancia apaga también la gruesa. `fwidth` necesita la
  // extensión OES_standard_derivatives, que ofrecen todos los WebGL donde se ejecuta la
  // aplicación: si faltara, se omite la rejilla en lugar de romper el arranque.
  const standardDerivatives = gl.getExtension('OES_standard_derivatives');
  const gridProgram = standardDerivatives ? createProgram(
    `
      attribute vec3 aPosition;
      uniform mat4 uViewProjection;
      varying highp vec3 vPosition;
      void main() {
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
        vPosition = aPosition;
      }
    `,
    `
      #extension GL_OES_standard_derivatives : enable
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying highp vec3 vPosition;
      uniform int uPlane;
      uniform vec3 uColor;
      uniform float uAlpha;
      uniform float uMinorStep;
      uniform float uMajorStep;
      uniform float uFadeStart;
      uniform float uFadeEnd;
      uniform vec3 uCameraPosition;

      // Coordenadas de mundo que forman el patrón de cada plano: el suelo usa xz y los
      // planos de los ejes, xy y zy.
      vec2 planeCoordinates(vec3 position) {
        if (uPlane == 0) return position.xz;
        if (uPlane == 1) return position.xy;
        return position.zy;
      }

      // Cobertura de la rejilla de paso step: 1 en el centro de una línea y 0 al
      // alejarse de ella. La distancia se mide en píxeles (fwidth), de modo que el
      // trazo mide siempre lo mismo en pantalla, y la rejilla se apaga cuando sus
      // líneas se juntan más que spacingStart–spacingEnd píxeles, que es cuando ya
      // no se distinguen y solo quedaría una banda.
      float gridCoverage(vec2 coordinates, float step, float spacingStart, float spacingEnd) {
        vec2 cells = coordinates / step;
        vec2 derivative = max(fwidth(cells), vec2(1e-5));
        vec2 distanceInPixels = abs(fract(cells - 0.5) - 0.5) / derivative;
        float line = 1.0 - min(min(distanceInPixels.x, distanceInPixels.y), 1.0);
        float spacingInPixels = 1.0 / max(max(derivative.x, derivative.y), 1e-5);
        return line * smoothstep(spacingStart, spacingEnd, spacingInPixels);
      }

      void main() {
        vec2 coordinates = planeCoordinates(vPosition);
        float minor = gridCoverage(coordinates, uMinorStep, 3.0, 8.0);
        float major = gridCoverage(coordinates, uMajorStep, 2.0, 5.0);
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distance(uCameraPosition, vPosition));
        gl_FragColor = vec4(uColor, uAlpha * max(minor, major) * fade);
      }
    `
  ) : null;

  const meshBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
  const gridBuffer = gl.createBuffer();
  const meshLocations = {
    position: gl.getAttribLocation(meshProgram, 'aPosition'),
    normal: gl.getAttribLocation(meshProgram, 'aNormal'),
    color: gl.getAttribLocation(meshProgram, 'aColor'),
    uv: gl.getAttribLocation(meshProgram, 'aUv'),
    viewProjection: gl.getUniformLocation(meshProgram, 'uViewProjection'),
    texture: gl.getUniformLocation(meshProgram, 'uTexture'),
    useTexture: gl.getUniformLocation(meshProgram, 'uUseTexture')
  };
  const lineLocations = {
    position: gl.getAttribLocation(lineProgram, 'aPosition'),
    color: gl.getAttribLocation(lineProgram, 'aColor'),
    viewProjection: gl.getUniformLocation(lineProgram, 'uViewProjection'),
    pointSize: gl.getUniformLocation(lineProgram, 'uPointSize')
  };
  const gridLocations = gridProgram ? {
    position: gl.getAttribLocation(gridProgram, 'aPosition'),
    viewProjection: gl.getUniformLocation(gridProgram, 'uViewProjection'),
    plane: gl.getUniformLocation(gridProgram, 'uPlane'),
    color: gl.getUniformLocation(gridProgram, 'uColor'),
    alpha: gl.getUniformLocation(gridProgram, 'uAlpha'),
    minorStep: gl.getUniformLocation(gridProgram, 'uMinorStep'),
    majorStep: gl.getUniformLocation(gridProgram, 'uMajorStep'),
    fadeStart: gl.getUniformLocation(gridProgram, 'uFadeStart'),
    fadeEnd: gl.getUniformLocation(gridProgram, 'uFadeEnd'),
    cameraPosition: gl.getUniformLocation(gridProgram, 'uCameraPosition')
  } : null;

  // #endregion Shaders, programas y buffers
  // #region Textura del modelo
  // Mantiene el canvas 2D editable y sincroniza su contenido con la textura WebGL.
  // Mapa de textura 2D: lienzo base liso.
  //
  // El mapa completo se aplica a cada cara del cubo (las UV de `geometry.addQuad`
  // van de 0 a 1), así que lo que se dibuje aquí se ve repetido en todas las caras.
  // El lienzo arranca liso a propósito: una cuadrícula de referencia en el mapa se
  // estampaba sobre las caras de los cubos y volvía a verse como una rejilla de
  // minicubos, que es justo lo que no debe aparecer. Lo que se pinte o se importe
  // encima sigue funcionando igual.
  function initializeTextureCanvas() {
    const context = dom.textureContext;
    context.fillStyle = '#f4f6f7';
    context.fillRect(0, 0, dom.textureCanvas.width, dom.textureCanvas.height);
  }

  function uploadTexture() {
    gl.bindTexture(gl.TEXTURE_2D, SDD3D.app.state.webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, dom.textureCanvas);
    SDD3D.app.state.textureDirty = false;
  }

  // #endregion Textura del modelo
  // #region Dibujo y bucle de renderizado
  // Sube mallas y líneas a los buffers, ajusta el viewport y compone las capas de la
  // escena respetando profundidad, transparencia y selección.
  function drawMesh(vertices, viewProjection) {
    if (!vertices.length) return;
    gl.useProgram(meshProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    const stride = 11 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(meshLocations.position);
    gl.vertexAttribPointer(meshLocations.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(meshLocations.normal);
    gl.vertexAttribPointer(meshLocations.normal, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(meshLocations.color);
    gl.vertexAttribPointer(meshLocations.color, 3, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(meshLocations.uv);
    gl.vertexAttribPointer(meshLocations.uv, 2, gl.FLOAT, false, stride, 9 * Float32Array.BYTES_PER_ELEMENT);
    gl.uniformMatrix4fv(meshLocations.viewProjection, false, viewProjection);
    gl.uniform1i(meshLocations.texture, 0);
    gl.uniform1i(meshLocations.useTexture, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, SDD3D.app.state.webglTexture);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 11);
  }

  // La rejilla se dibuja en tres planos translúcidos, cada uno con su patrón de líneas
  // calculado en el sombreador. Los planos se centran en la cámara, así que siempre
  // cubren la zona visible y la rejilla parece infinita aunque el modelo se desplace.
  function drawGrid(viewProjection) {
    if (!gridProgram) return;
    const eye = camera.position();
    gl.useProgram(gridProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.enableVertexAttribArray(gridLocations.position);
    gl.vertexAttribPointer(gridLocations.position, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gridLocations.viewProjection, false, viewProjection);
    gl.uniform3f(gridLocations.cameraPosition, eye.x, eye.y, eye.z);
    gl.uniform3fv(gridLocations.color, SDD3D.COLORS.grid);
    gl.uniform1f(gridLocations.alpha, SDD3D.GRID_ALPHA);
    gl.uniform1f(gridLocations.minorStep, SDD3D.GRID_MINOR_STEP);
    gl.uniform1f(gridLocations.majorStep, SDD3D.GRID_MAJOR_STEP);
    gl.uniform1f(gridLocations.fadeStart, SDD3D.GRID_FADE_START);
    gl.uniform1f(gridLocations.fadeEnd, SDD3D.GRID_FADE_END);
    for (const plane of SDD3D.grid.buildPlanes(eye)) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(plane.vertices), gl.DYNAMIC_DRAW);
      gl.uniform1i(gridLocations.plane, plane.index);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, plane.vertices.length / 3);
    }
  }

  // El resto de líneas (aristas, contornos y puntos) se dibujan opacas.
  function drawLines(vertices, viewProjection, mode, pointSize) {
    if (!vertices.length) return;
    gl.useProgram(lineProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(lineLocations.position);
    gl.vertexAttribPointer(lineLocations.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(lineLocations.color);
    gl.vertexAttribPointer(lineLocations.color, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.uniformMatrix4fv(lineLocations.viewProjection, false, viewProjection);
    gl.uniform1f(lineLocations.pointSize, pointSize);
    gl.drawArrays(mode, 0, vertices.length / 6);
  }

  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(dom.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(dom.canvas.clientHeight * pixelRatio));
    if (dom.canvas.width !== width || dom.canvas.height !== height) {
      dom.canvas.width = width;
      dom.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function render() {
    const state = SDD3D.app.state;
    resizeCanvas();
    if (state.textureDirty) uploadTexture();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const viewProjection = camera.viewProjection();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawGrid(viewProjection);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    drawMesh(mesh.buildMeshVertices(), viewProjection);
    if (state.showCubeLines) drawLines(mesh.buildCubeEdgeLines(), viewProjection, gl.LINES, 1);
    drawLines(mesh.buildEdgeLines(), viewProjection, gl.LINES, 1);
    if (state.selectedCube && state.mode === 'keyboard') {
      drawLines(mesh.buildSelectionLines(), viewProjection, gl.LINES, 1);
    }
    if (state.pointsVisible) drawLines(mesh.buildPointVertices(), viewProjection, gl.POINTS, 8);
    requestAnimationFrame(render);
  }

  // #endregion Dibujo y bucle de renderizado
  // #region Arranque y API del renderer
  // Inicializa la textura, activa las pruebas de profundidad y pone en marcha el
  // ciclo de animación.
  function start() {
    initializeTextureCanvas();
    SDD3D.app.state.webglTexture = gl.createTexture();
    uploadTexture();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.063, 0.075, 0.098, 1);

    requestAnimationFrame(render);
  }

  SDD3D.renderer = { start, render, resizeCanvas, uploadTexture };
})();
// #endregion Arranque y API del renderer
