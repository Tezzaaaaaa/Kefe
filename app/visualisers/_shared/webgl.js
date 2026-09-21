/* KEFE — shared WebGL capability/context helpers */
(function () {
  'use strict';
  var root = window.kefeVisualiserShared || (window.kefeVisualiserShared = {});
  root.webgl = Object.freeze({
    supported: function (canvas, prefer2) {
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      return canvas.getContext(prefer2 !== false ? 'webgl2' : 'webgl', { alpha: true, antialias: false, powerPreference: 'high-performance' }) || canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'high-performance' });
    },
    compile: function (gl, type, source) {
      var shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { var error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error || 'WebGL shader compilation failed.'); }
      return shader;
    },
    program: function (gl, vertexSource, fragmentSource) {
      var program = gl.createProgram();
      gl.attachShader(program, root.webgl.compile(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, root.webgl.compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { var error = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(error || 'WebGL program link failed.'); }
      return program;
    }
  });
})();
