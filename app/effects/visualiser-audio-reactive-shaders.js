/* KEFE — Audio Reactive Shaders preset group.
   Adapted from TjardoOrtan/audio-reactive-shaders (MIT).
   The upstream scene modules are loaded lazily; KEFE supplies its existing
   master-audio analysis to the same audioLow/audioMid/audioHigh uniforms.

   Deterministic for export: draw() takes an authoritative timestamp and
   the shader's `time` uniform and audio uniforms are both derived purely
   from that timestamp and the precomputed analysis. No audio.currentTime,
   no performance.now(), no Math.random().
*/
(function(){
  'use strict';
  if (window.kefeAudioReactiveShaders) return;

  var BASE = 'https://cdn.jsdelivr.net/gh/TjardoOrtan/audio-reactive-shaders@master/src/shaders/scenes/';
  var FILES = [
    ['abyssalFractals.js','Abyssal Fractals'],
    ['audioMatrix.js','Audio Matrix'],
    ['audioRipples.js','Audio Ripples'],
    ['audioVortex.js','Audio Vortex'],
    ['audioWaves.js','Audio Waves'],
    ['bassVortex.js','Bass Vortex'],
    ['cosmicStorm.js','Cosmic Storm'],
    ['fractalSphere.js','Fractal Sphere'],
    ['gyroidPulse.js','Gyroid Pulse'],
    ['kaleidoscope.js','Kaleidoscope'],
    ['neonGrid.js','Neon Grid'],
    ['rainyDays.js','Rainy Days'],
    ['raveLasers.js','Rave Lasers'],
    ['sacredGeometry.js','Sacred Geometry'],
    ['shaytanRevived.js','Shaytan Revived']
  ];

  var VERTEX = [
    'varying vec2 vUv;',
    'varying vec3 vPosition;',
    'void main(){',
    '  vUv = uv;',
    '  vPosition = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var state = {
    loading:null, scenes:[], index:0, renderer:null, material:null, geometry:null,
    canvas:null, host:null, width:0, height:0, lastTime:-1, running:false,
    scene:null, camera:null, renderScene:null,
    simTime:0, explicitTime:false
  };

  function frameAt(time, analysis){
    if (!analysis || !analysis.frameHopMs || !analysis.energy || !analysis.energy.length) {
      return {low:0, mid:0, high:0, energy:0};
    }
    var hop = analysis.frameHopMs / 1000;
    var idx = Math.max(0, Math.min(analysis.energy.length - 1, Math.floor(time / hop)));
    var bands = analysis.bands || [];
    var b = bands[idx] || {};

    var maxB = 0.0001, maxM = 0.0001, maxT = 0.0001;
    var lo = Math.max(0, idx - 4);
    var hi = Math.min(bands.length - 1, idx + 4);
    for (var i = lo; i <= hi; i++) {
      var x = bands[i] || {};
      if ((x.bass || 0) > maxB) maxB = x.bass || 0;
      if ((x.mids || 0) > maxM) maxM = x.mids || 0;
      if ((x.treble || 0) > maxT) maxT = x.treble || 0;
    }
    var peak = Number(analysis.summary && analysis.summary.peakRms) || 0.0001;
    var e = Number(analysis.energy[idx]) || 0;

    return {
      low: Math.min(1, (b.bass || 0) / maxB),
      mid: Math.min(1, (b.mids || 0) / maxM),
      high: Math.min(1, (b.treble || 0) / maxT),
      energy: Math.min(1, e / peak)
    };
  }

  function ensureCanvas(w,h){
    if(!state.host){
      state.host=document.createElement('div');
      state.host.style.position='fixed';
      state.host.style.left='-10000px';
      state.host.style.top='0';
      state.host.style.width='1px';
      state.host.style.height='1px';
      state.host.style.visibility='hidden';
      state.host.style.pointerEvents='none';
      document.body.appendChild(state.host);
    }
    if(!state.canvas){
      state.canvas=document.createElement('canvas');
      state.host.appendChild(state.canvas);
    }
    state.width=Math.max(1,Math.floor(w));
    state.height=Math.max(1,Math.floor(h));
    state.canvas.width=state.width;
    state.canvas.height=state.height;
  }

  async function load(){
    if(state.loading)return state.loading;
    state.loading=Promise.all(FILES.map(function(item){
      return import(BASE+item[0]).then(function(mod){
        return {name:mod.name||item[1],fragmentShader:mod.fragmentShader};
      });
    })).then(function(scenes){
      state.scenes=scenes.filter(function(s){return s.fragmentShader;});
      return state.scenes;
    }).catch(function(err){
      state.loading=null;
      throw err;
    });
    return state.loading;
  }

  function destroyRenderer(){
    if(state.renderer){try{state.renderer.dispose();}catch(_){}}
    if(state.geometry){try{state.geometry.dispose();}catch(_){}}
    if(state.material){try{state.material.dispose();}catch(_){}}
    state.renderer=null;state.geometry=null;state.material=null;
    state.scene=null;state.camera=null;state.renderScene=null;
    if(state.host){state.host.remove();state.host=null;state.canvas=null;}
  }

  function reset(){
    state.lastTime = -1;
    if (state.material && state.material.uniforms) {
      state.material.uniforms.time.value = 0;
      state.material.uniforms.audioLow.value = 0;
      state.material.uniforms.audioMid.value = 0;
      state.material.uniforms.audioHigh.value = 0;
    }
  }

  function start(w,h){
    return load().then(function(){
      if(typeof THREE==='undefined') throw new Error('Three.js is unavailable.');
      ensureCanvas(w,h);
      destroyRenderer();
      ensureCanvas(w,h);
      var sceneDef=state.scenes[state.index]||state.scenes[0];
      if(!sceneDef) throw new Error('No Audio Reactive Shaders scenes loaded.');

      state.renderer=new THREE.WebGLRenderer({canvas:state.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      state.renderer.setPixelRatio(1);
      state.renderer.setSize(state.width,state.height,false);
      state.renderer.setClearColor(0x000000,1);
      state.material=new THREE.ShaderMaterial({
        vertexShader:VERTEX,
        fragmentShader:sceneDef.fragmentShader,
        uniforms:{
          time:{value:0},
          audioLow:{value:0},
          audioMid:{value:0},
          audioHigh:{value:0}
        }
      });
      state.geometry=new THREE.PlaneGeometry(2,2);
      var scene=new THREE.Scene();
      var camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      scene.add(new THREE.Mesh(state.geometry,state.material));
      state.scene=scene;
      state.camera=camera;
      state.lastTime=-1;
      state.running=true;

      state.renderScene=function(seconds){
        var analysis = window.kefeVisualiser && window.kefeVisualiser.data;
        var f = frameAt(seconds, analysis);
        state.material.uniforms.time.value = seconds;
        state.material.uniforms.audioLow.value = f.low;
        state.material.uniforms.audioMid.value = f.mid;
        state.material.uniforms.audioHigh.value = f.high;
        state.renderer.render(state.scene, state.camera);
      };
      return true;
    });
  }

  function selectPreset(index,w,h){
    state.index=Math.max(0,Math.min(state.scenes.length-1,Number(index)||0));
    state.lastTime = -1;
    return start(w||state.width||1,h||state.height||1);
  }

  function draw(ctx, w, h, time){
    if(!state.running || !state.renderer){
      start(w,h).catch(function(err){console.warn('[KEFE Audio Reactive Shaders]',err);});
      return false;
    }
    if(state.width !== Math.floor(w) || state.height !== Math.floor(h)){
      start(w,h).catch(function(err){console.warn('[KEFE Audio Reactive Shaders]',err);});
      return false;
    }

    var seconds;
    if (Number.isFinite(time)) {
      seconds = Number(time);
      state.explicitTime = true;
    } else {
      var audio = window.kefeAudioElement;
      seconds = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    }

    if (state.lastTime >= 0 && seconds < state.lastTime - 1e-6) {
      reset();
    }
    state.lastTime = seconds;

    state.renderScene(seconds);

    ctx.save();
    ctx.drawImage(state.canvas, 0, 0, w, h);
    ctx.restore();
    return true;
  }

  function stop(){state.running=false;state.lastTime=-1;destroyRenderer();}

  window.kefeAudioReactiveShaders={
    version: 2,
    load: load,
    start: start,
    stop: stop,
    reset: reset,
    draw: draw,
    selectPreset: selectPreset,
    isReady: function(){ return state.running === true && state.renderer !== null; },
    presetNames: function(){ return state.scenes.map(function(s){ return s.name; }); },
    get activePreset(){ return state.scenes[state.index] ? state.scenes[state.index].name : ''; }
  };
})();
