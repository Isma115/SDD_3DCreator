// Núcleo WebGL: contexto, shaders, buffers, textura del modelo y bucle de dibujo.
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
      varying highp vec3 vPosition;
      void main() {
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
        gl_PointSize = uPointSize;
        vColor = aColor;
        vPosition = aPosition;
      }
    `,
    `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec3 vColor;
      varying highp vec3 vPosition;
      uniform float uAlpha;
      uniform vec3 uCameraPosition;
      uniform float uFadeStart;
      uniform float uFadeEnd;
      void main() {
        float distanceToCamera = length(uCameraPosition - vPosition);
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distanceToCamera);
        gl_FragColor = vec4(vColor, uAlpha * fade);
      }
    `
  );

  const meshBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
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
    pointSize: gl.getUniformLocation(lineProgram, 'uPointSize'),
    alpha: gl.getUniformLocation(lineProgram, 'uAlpha'),
    cameraPosition: gl.getUniformLocation(lineProgram, 'uCameraPosition'),
    fadeStart: gl.getUniformLocation(lineProgram, 'uFadeStart'),
    fadeEnd: gl.getUniformLocation(lineProgram, 'uFadeEnd')
  };

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

  // El fundido por distancia solo se aplica al grid; el resto de líneas se dibujan opacas.
  function drawLines(vertices, viewProjection, mode, pointSize, fade) {
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
    gl.uniform1f(lineLocations.alpha, fade ? SDD3D.GRID_ALPHA : 1);
    gl.uniform1f(lineLocations.fadeStart, fade ? SDD3D.GRID_FADE_START : SDD3D.CAMERA_FAR);
    gl.uniform1f(lineLocations.fadeEnd, fade ? SDD3D.GRID_FADE_END : SDD3D.CAMERA_FAR + 1);
    const eye = camera.position();
    gl.uniform3f(lineLocations.cameraPosition, eye.x, eye.y, eye.z);
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
    drawLines(SDD3D.grid.buildLines(), viewProjection, gl.LINES, 1, true);
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
