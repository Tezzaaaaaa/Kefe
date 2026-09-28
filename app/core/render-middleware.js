/* KEFE shared render middleware — one renderer, composable layers. */
(() => {
  'use strict';
  if (window.kefeRenderPipeline || typeof window.render !== 'function') return;
  const baseRender = window.render;
  const layers = [];
  const rebuild = () => {
    let render = baseRender;
    for (let i = layers.length - 1; i >= 0; i--) render = layers[i].factory(render);
    window.render = render;
  };
  window.kefeRenderPipeline = {
    use(name, factory) {
      if (!name || typeof factory !== 'function' || layers.some(layer => layer.name === name)) return false;
      layers.push({ name, factory });
      rebuild();
      return true;
    }
  };
})();
