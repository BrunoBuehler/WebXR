let xrSession = null;
let gl = null;
let xrReferenceSpace = null;
let program = null;
let vertexBuffer = null;
let indexBuffer = null;

const vertexShaderSource = `
  attribute vec3 a_position;
  uniform mat4 u_projectionMatrix;
  uniform mat4 u_viewMatrix;
  void main() {
    gl_Position = u_projectionMatrix * u_viewMatrix * vec4(a_position, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); // Blue color
  }
`;

document.getElementById('startButton').addEventListener('click', () => {
  if (!navigator.xr) {
    alert("WebXR not supported");
    return;
  }
  navigator.xr.requestSession("immersive-ar").then((session) => {
    xrSession = session;
    setupWebGL();
    onSessionStarted();
    document.getElementById('startButton').style.display = 'none';
  });
});

function setupWebGL() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  gl = canvas.getContext("webgl", { xrCompatible: true });
  xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, gl) });

  // Compile shaders and link program
  program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  // Set up the cube geometry
  const cubeVertices = new Float32Array([
    -0.1, -0.1, -0.1,
     0.1, -0.1, -0.1,
     0.1,  0.1, -0.1,
    -0.1,  0.1, -0.1,
    -0.1, -0.1,  0.1,
     0.1, -0.1,  0.1,
     0.1,  0.1,  0.1,
    -0.1,  0.1,  0.1
  ]);

  const cubeIndices = new Uint16Array([
    0, 1, 2, 0, 2, 3, // front
    4, 5, 6, 4, 6, 7, // back
    0, 1, 5, 0, 5, 4, // bottom
    2, 3, 7, 2, 7, 6, // top
    0, 3, 7, 0, 7, 4, // left
    1, 2, 6, 1, 6, 5  // right
  ]);

  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);
}

function onSessionStarted() {
  xrSession.requestReferenceSpace("local").then((refSpace) => {
    xrReferenceSpace = refSpace;
    xrSession.requestAnimationFrame(onXRFrame);
  });
}

function onXRFrame(time, frame) {
  const session = frame.session;
  session.requestAnimationFrame(onXRFrame);

  const pose = frame.getViewerPose(xrReferenceSpace);
  if (pose) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const view of pose.views) {
      const viewport = session.renderState.baseLayer.getViewport(view);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

      renderCube(view);
    }
  }
}

function renderCube(view) {
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  const projectionMatrixLocation = gl.getUniformLocation(program, "u_projectionMatrix");
  const viewMatrixLocation = gl.getUniformLocation(program, "u_viewMatrix");

  gl.uniformMatrix4fv(projectionMatrixLocation, false, view.projectionMatrix);
  gl.uniformMatrix4fv(viewMatrixLocation, false, view.transform.inverse.matrix);

  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

// Helper functions to create shaders and program
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
