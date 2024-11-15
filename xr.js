let xrSession = null;
let gl = null;
let xrReferenceSpace = null;
let program = null;
let vertexBuffer = null;

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5; // Map [-1, 1] to [0, 1]
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_uv;
  void main() {
    vec2 center = vec2(0.5, 0.5); // Center of the screen
    float radius = 0.2;          // Radius of the transparent circle
    float dist = distance(v_uv, center);
    if (dist < radius) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // Transparent circle
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black overlay
    }
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

  // Set up a fullscreen quad
  const quadVertices = new Float32Array([
    -1.0, -1.0, // Bottom-left
     1.0, -1.0, // Bottom-right
    -1.0,  1.0, // Top-left
     1.0,  1.0  // Top-right
  ]);
  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
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
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (const view of pose.views) {
      const viewport = session.renderState.baseLayer.getViewport(view);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

      renderOverlay();
    }
  }
}

function renderOverlay() {
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
